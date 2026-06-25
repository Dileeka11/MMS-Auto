<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrderLine extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'cost' => 'float',
        'total' => 'float',
        'qty' => 'integer',
        'balance_qty' => 'integer',
        'received_qty' => 'integer',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
