<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockLayer extends Model
{
    protected $guarded = [];

    protected $casts = [
        'qty_in' => 'integer',
        'qty_left' => 'integer',
        'unit_cost' => 'float',
        'date' => 'date:Y-m-d',
    ];
}
