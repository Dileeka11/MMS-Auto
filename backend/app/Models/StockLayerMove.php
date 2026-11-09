<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockLayerMove extends Model
{
    protected $guarded = [];

    protected $casts = [
        'qty' => 'integer',
        'unit_cost' => 'float',
    ];
}
