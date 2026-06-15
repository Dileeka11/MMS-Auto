<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Models\SalesRep;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        return Cache::remember('dashboard:summary', 60, function () {
            $itemAgg = DB::table('items')->selectRaw('
                COUNT(*)                                           AS total_skus,
                SUM(CASE WHEN status = "out" THEN 1 ELSE 0 END)    AS out_of_stock,
                SUM(CASE WHEN status = "low" THEN 1 ELSE 0 END)    AS low_stock,
                COALESCE(SUM(avg_cost * qty), 0)                   AS stock_value
            ')->first();

            return [
                'kpis' => [
                    'sales_month'  => (float) Invoice::sum('total'),
                    'receivables'  => (float) Customer::sum('outstanding'),
                    'stock_value'  => (float) ($itemAgg->stock_value ?? 0),
                    'total_skus'   => (int)   ($itemAgg->total_skus ?? 0),
                    'out_of_stock' => (int)   ($itemAgg->out_of_stock ?? 0),
                    'low_stock'    => (int)   ($itemAgg->low_stock ?? 0),
                ],
                'low_stock' => Item::where('status', '!=', 'in')
                    ->orderByRaw('FIELD(status, "out", "low")')
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
