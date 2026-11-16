<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Models\SalesRep;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $summary = Cache::remember('dashboard:summary', 60, function () {
            $monthStart = Carbon::now()->startOfMonth();
            $monthEnd   = Carbon::now()->endOfMonth();

            // ---- Items aggregate (single query) -----------------------------
            $itemAgg = DB::table('items')->selectRaw('
                COUNT(*)                                          AS total_skus,
                SUM(CASE WHEN status = "out" THEN 1 ELSE 0 END)   AS out_of_stock,
                SUM(CASE WHEN status = "low" THEN 1 ELSE 0 END)   AS low_stock,
                COALESCE(SUM(avg_cost * qty), 0)                  AS stock_value
            ')->first();

            // ---- Sales this month -------------------------------------------
            $salesMonth = (float) Invoice::whereBetween('date', [$monthStart, $monthEnd])
                ->sum('total');

            // ---- Real gross profit this month (rate - avg_cost) * qty -------
            $grossProfit = (float) DB::table('invoice_lines')
                ->join('invoices', 'invoices.id', '=', 'invoice_lines.invoice_id')
                ->whereBetween('invoices.date', [$monthStart, $monthEnd])
                ->selectRaw('COALESCE(SUM((invoice_lines.rate - invoice_lines.avg_cost) * invoice_lines.qty), 0) AS gp')
                ->value('gp');

            // ---- Real receivables (sum of unpaid invoice balances) ----------
            $receivables = (float) Invoice::sum('due');
            if ($receivables <= 0) {
                // fallback to customer outstanding column if invoice 'due' isn't tracked
                $receivables = (float) Customer::sum('outstanding');
            }

            // ---- Stock-by-category aggregation across ALL items -------------
            $stockByCategory = DB::table('items')
                ->selectRaw('COALESCE(category, "Uncategorized") AS label, COALESCE(SUM(avg_cost * qty), 0) AS value')
                ->groupBy('category')
                ->havingRaw('SUM(avg_cost * qty) > 0')
                ->orderByDesc('value')
                ->limit(8)
                ->get();

            // ---- 12-month sales trend ---------------------------------------
            // DATE_FORMAT is MySQL-only; SQLite (local dev) needs strftime.
            /** @var \Illuminate\Database\Connection $conn */
            $conn = DB::connection();
            $ymExpr = $conn->getDriverName() === 'sqlite'
                ? "strftime('%Y-%m', date)"
                : 'DATE_FORMAT(date, "%Y-%m")';
            $trendRows = DB::table('invoices')
                ->selectRaw("$ymExpr AS ym, SUM(total) AS total")
                ->where('date', '>=', Carbon::now()->subMonths(11)->startOfMonth())
                ->groupBy('ym')
                ->orderBy('ym')
                ->pluck('total', 'ym');

            $trend = [];
            for ($i = 11; $i >= 0; $i--) {
                $key = Carbon::now()->subMonths($i)->format('Y-m');
                $trend[] = [
                    'label' => Carbon::now()->subMonths($i)->format('M'),
                    'value' => (float) ($trendRows[$key] ?? 0),
                ];
            }

            return [
                'kpis' => [
                    'sales_month'  => $salesMonth,
                    'gross_profit' => $grossProfit,
                    'receivables'  => $receivables,
                    'stock_value'  => (float) ($itemAgg->stock_value ?? 0),
                    'total_skus'   => (int)   ($itemAgg->total_skus ?? 0),
                    'out_of_stock' => (int)   ($itemAgg->out_of_stock ?? 0),
                    'low_stock'    => (int)   ($itemAgg->low_stock ?? 0),
                ],
                'stock_by_category' => $stockByCategory,
                'sales_trend' => $trend,
                'low_stock' => Item::where('status', '!=', 'in')
                    ->orderByRaw("CASE status WHEN 'out' THEN 0 WHEN 'low' THEN 1 ELSE 2 END")
                    ->limit(6)
                    ->get(),
                'top_items' => Item::orderByRaw('(price * qty) DESC')
                    ->limit(5)
                    ->get(),
                'reps' => SalesRep::all(),
                'pending_returns' => SalesReturn::where('status', 'Pending Approval')->count(),
            ];
        });

        // Pending work is per-user (who has already approved what) and must be
        // fresh after every approve/reject, so it is never part of the cache.
        $user = $request->user();
        if ($user && $user->role === 'admin') {
            $summary['pending'] = $this->pendingFor($user->id);
        }

        return $summary;
    }

    /**
     * Everything currently waiting on an admin, grouped by document type.
     * Two-step documents (PO / Shipment / GRN) report how many still need
     * *this* admin's signature, since the same admin cannot approve twice.
     */
    private function pendingFor(int $userId): array
    {
        $limit = 5;
        // $currencyCol: documents kept in their own currency (POs) report it so
        // the amount is shown as USD / LKR rather than silently as LKR.
        $twoStep = function (string $table, string $partyCol, string $amountCol, $currencyCol = null) use ($userId, $limit) {
            $base = DB::table($table)->where('status', 'Awaiting Approval');
            $mine = (clone $base)->where(function ($q) use ($userId) {
                $q->whereNull('approver1_id')->orWhere('approver1_id', '!=', $userId);
            })->where(function ($q) use ($userId) {
                $q->whereNull('approver2_id')->orWhere('approver2_id', '!=', $userId);
            });
            $rows = (clone $base)
                ->select('id', 'code', 'date', 'approver1_id', 'approver2_id',
                    DB::raw("$partyCol AS party"), DB::raw("$amountCol AS amount"),
                    DB::raw($currencyCol ? "$currencyCol AS currency" : "'LKR' AS currency"))
                ->orderBy('date')->orderBy('id')
                ->limit($limit)->get()
                ->map(function ($r) use ($userId) {
                    return [
                        'id' => $r->id,
                        'code' => $r->code,
                        'party' => $r->party,
                        'date' => $r->date,
                        'amount' => (float) $r->amount,
                        'currency' => $r->currency ?: 'LKR',
                        'approvals' => ($r->approver1_id ? 1 : 0) + ($r->approver2_id ? 1 : 0),
                        'approved_by_me' => $r->approver1_id == $userId || $r->approver2_id == $userId,
                    ];
                });
            return ['count' => $base->count(), 'needs_me' => $mine->count(), 'items' => $rows];
        };
        $simple = function ($query, string $partyCol, string $amountCol) use ($limit) {
            $rows = (clone $query)
                ->select('id', 'code', 'date', DB::raw("$partyCol AS party"), DB::raw("$amountCol AS amount"))
                ->orderBy('date')->orderBy('id')
                ->limit($limit)->get()
                ->map(function ($r) {
                    return [
                        'id' => $r->id,
                        'code' => $r->code,
                        'party' => $r->party,
                        'date' => $r->date,
                        'amount' => (float) $r->amount,
                    ];
                });
            $count = $query->count();
            return ['count' => $count, 'needs_me' => $count, 'items' => $rows];
        };

        $groups = [
            array_merge(['key' => 'po', 'label' => 'Purchase Orders', 'route' => 'dc/po', 'two_step' => true],
                $twoStep('purchase_orders', 'supplier', 'total', 'currency')),
            array_merge(['key' => 'shipment', 'label' => 'Costing & Shipments', 'route' => 'dc/costing', 'two_step' => true],
                $twoStep('shipments', 'po_code', 'landed_total')),
            array_merge(['key' => 'grn', 'label' => 'GRNs', 'route' => 'dc/grn', 'two_step' => true],
                $twoStep('grns', 'supplier', 'total')),
            array_merge(['key' => 'return', 'label' => 'Sales Returns', 'route' => 'dc/return', 'two_step' => false],
                $simple(DB::table('sales_returns')->where('status', 'Pending Approval'), 'customer', 'amount')),
            array_merge(['key' => 'discount', 'label' => 'Invoice Discounts', 'route' => 'dc/invoice', 'two_step' => false],
                $simple(DB::table('invoices')->where('discount_status', 'pending'), 'customer', 'total')),
            array_merge(['key' => 'dispatch', 'label' => 'Sales Orders to Dispatch', 'route' => 'dc/dispatch', 'two_step' => false],
                $simple(DB::table('sales_orders')->where('status', 'pending'), 'customer', 'total')),
        ];

        return [
            'total' => array_sum(array_column($groups, 'needs_me')),
            'groups' => $groups,
        ];
    }
}
