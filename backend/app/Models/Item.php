<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'stock_by_branch' => 'array',
        'avg_cost' => 'float',
        'fifo_cost' => 'float',
        'price' => 'float',
        'selling_price_wo_vat' => 'float',
        'selling_price_with_vat' => 'float',
        'qty' => 'integer',
        'reorder' => 'integer',
    ];

    /** Put stock back / receive it at $unitCost, re-weighting the average cost. Saves. */
    public function addStock(int $qty, float $unitCost): void
    {
        $newQty = $this->qty + $qty;
        if ($newQty > 0) {
            $this->avg_cost = round(($this->qty * $this->avg_cost + $qty * $unitCost) / $newQty, 2);
        }
        $this->qty = $newQty;
        $this->refreshStatus();
        $this->save();
    }

    /** Take back stock that was received at $unitCost (undoing addStock). Saves. */
    public function removeStock(int $qty, float $unitCost): void
    {
        $newQty = $this->qty - $qty;
        if ($newQty > 0) {
            $avg = ($this->qty * $this->avg_cost - $qty * $unitCost) / $newQty;
            if ($avg >= 0) {
                $this->avg_cost = round($avg, 2);
            }
        }
        $this->qty = max(0, $newQty);
        $this->refreshStatus();
        $this->save();
    }

    public function refreshStatus(): void
    {
        $this->status = $this->qty <= 0 ? 'out' : ($this->qty <= $this->reorder ? 'low' : 'in');
    }
}
