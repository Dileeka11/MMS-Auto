<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Models\SalesRep;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        return Cache::remember('dashboard:summary', 60, function () {
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
    }
}
