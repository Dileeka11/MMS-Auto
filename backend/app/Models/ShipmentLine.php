<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShipmentLine extends Model
{
    protected $guarded = [];

    protected $casts = [
        'qty' => 'integer',
        'cost' => 'float',
        'total' => 'float',
        'landed_cost' => 'float',
        'landed_total' => 'float',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function purchaseOrderLine()
    {
        return $this->belongsTo(PurchaseOrderLine::class);
    }
}
