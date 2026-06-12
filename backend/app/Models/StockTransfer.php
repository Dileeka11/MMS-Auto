<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockTransfer extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = ['items' => 'integer', 'qty' => 'integer', 'date' => 'date:Y-m-d'];
}
