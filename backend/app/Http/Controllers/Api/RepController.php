<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\SalesOrder;
use App\Models\SalesRep;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Rep-facing endpoints for the mobile app. All actions are scoped to the
 * authenticated sales rep (resolved from the Sanctum token).
 */
class RepController extends Controller
{
    /** Dashboard summary + chart data for the logged-in rep. */
    public function dashboard(Request $request)
    {
        /** @var SalesRep $rep */
        $rep = $request->user();

        $orders = Invoice::where('rep', $rep->name)
            ->orWhere('rep', $rep->code)
            ->orderByDesc('date');

        $all = (clone $orders)->get();

        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();

        $salesThisMonth = $all->where('date', '>=', $monthStart)->sum('total');
        $salesToday = $all->where('date', $today)->sum('total');
        $outstanding = $all->sum('due');

        // Last 6 months trend
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = now()->subMonths($i);
            $label = $m->format('M');
            $sum = $all->filter(fn ($o) => \Illuminate\Support\Carbon::parse($o->date)->isSameMonth($m))
                ->sum('total');
            $trend[] = ['label' => $label, 'value' => round($sum, 2)];
        }

        // Last 7 days
        $daily = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = now()->subDays($i);
            $label = $d->format('D');
            $sum = $all->where('date', $d->toDateString())->sum('total');
            $daily[] = ['label' => $label, 'value' => round($sum, 2)];
        }

        $target = (float) $rep->target ?: 1;

        return [
            'rep' => $rep->only(['id', 'code', 'name', 'zone', 'avatar', 'target', 'achieved']),
            'stats' => [
                'target' => round($target, 2),
                'achieved' => round($salesThisMonth, 2),
                'progress' => round(min(100, ($salesThisMonth / $target) * 100), 1),
                'sales_today' => round($salesToday, 2),
                'orders_count' => $all->count(),
                'outstanding' => round($outstanding, 2),
            ],
            'monthly_trend' => $trend,
            'daily_sales' => $daily,
            'recent_orders' => $all->take(8)->map(fn ($o) => [
                'code' => $o->code,
                'customer' => $o->customer,
                'total' => (float) $o->total,
                'status' => $o->status,
                'date' => $o->date,
            ])->values(),
        ];
    }

    /** Live stock — searchable list of items with current quantity. */
    public function stock(Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        $items = Item::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%")
                    ->orWhere('code', 'like', "%{$q}%")
                    ->orWhere('brand', 'like', "%{$q}%");
            })
            ->orderBy('name')
            ->limit(400)
            ->get(['id', 'code', 'name', 'brand', 'category', 'unit', 'price', 'qty', 'reserved', 'reorder', 'status', 'rack']);

        // `available` = on-hand minus stock already reserved by pending dispatch
        // notes — reps must not sell what is spoken for.
        $items->each(function ($it) {
            $it->available = max(0, (int) $it->qty - (int) $it->reserved);
        });

        return $items;
    }

    /** Customers for the rep (own customers first, then unassigned). */
    public function customers(Request $request)
    {
        $rep = $request->user();

        return Customer::query()
            ->orderByRaw('CASE WHEN rep = ? THEN 0 ELSE 1 END', [$rep->name])
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'contact', 'city', 'limit', 'outstanding', 'rep', 'status']);
    }

    /** The rep's own sales orders (pending → dispatched → invoiced). */
    public function orders(Request $request)
    {
        $rep = $request->user();

        return SalesOrder::with('lines')
            ->where(function ($q) use ($rep) {
                $q->where('rep', $rep->name)->orWhere('rep', $rep->code);
            })
            ->orderByDesc('id')
            ->limit(200)
            ->get();
    }

    /**
     * Create a sales order for the logged-in rep. This does NOT post an
     * invoice or touch stock — the order is dispatched and invoiced later
     * from the admin panel.
     */
    public function storeOrder(Request $request)
    {
        $rep = $request->user();

        $data = $request->validate([
            'customer' => 'required|string',
            'date' => 'nullable|date',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.name' => 'required|string',
            'lines.*.qty' => 'required|integer|min:1',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.method' => 'nullable|in:FIFO,Average',
        ]);

        return DB::transaction(function () use ($data, $rep) {
            $total = 0;
            foreach ($data['lines'] as $l) {
                $total += $l['qty'] * $l['rate'];
            }

            $order = SalesOrder::create([
                'code' => SalesOrder::nextCode(),
                'customer' => $data['customer'],
                'rep' => $rep->name,
                'source' => 'app',
                'date' => $data['date'] ?? now()->toDateString(),
                'total' => $total,
                'items' => count($data['lines']),
                'status' => 'pending',
            ]);

            foreach ($data['lines'] as $l) {
                $item = ! empty($l['code']) ? Item::where('code', $l['code'])->first() : null;
                $order->lines()->create([
                    'code' => $l['code'] ?? null,
                    'name' => $l['name'],
                    'qty' => $l['qty'],
                    'rate' => $l['rate'],
                    'fifo_cost' => $item->fifo_cost ?? 0,
                    'avg_cost' => $item->avg_cost ?? 0,
                    'method' => $l['method'] ?? 'FIFO',
                ]);
            }

            return response()->json($order->load('lines'), 201);
        });
    }
}
