<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shipment extends Model
{
    protected $guarded = [];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'items_total' => 'float',
        'extras_total' => 'float',
        'landed_total' => 'float',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function lines()
    {
        return $this->hasMany(ShipmentLine::class);
    }

    public function extras()
    {
        return $this->hasMany(ShipmentExtra::class);
    }
}
