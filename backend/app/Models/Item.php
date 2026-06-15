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
}
