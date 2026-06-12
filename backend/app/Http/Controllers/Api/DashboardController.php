<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Models\SalesRep;

class DashboardController extends Controller
{
    public function index()
    {
        $items = Item::all();
        $stockValue = $items->sum(fn ($i) => $i->avg_cost * $i->qty);

        return [
            'kpis' => [
                'sales_month' => Invoice::sum('total'),
                'receivables' => Customer::sum('outstanding'),
                'stock_value' => $stockValue,
                'total_skus' => $items->count(),
                'out_of_stock' => $items->where('status', 'out')->count(),
                'low_stock' => $items->where('status', 'low')->count(),
            ],
            'low_stock' => $items->where('status', '!=', 'in')->take(6)->values(),
            'top_items' => $items->sortByDesc(fn ($i) => $i->price * $i->qty)->take(5)->values(),
            'reps' => SalesRep::all(),
            'pending_returns' => SalesReturn::where('status', 'Pending Approval')->count(),
        ];
    }
}
