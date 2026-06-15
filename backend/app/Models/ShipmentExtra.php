<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShipmentExtra extends Model
{
    protected $guarded = [];

    protected $casts = ['amount' => 'float'];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }
}
