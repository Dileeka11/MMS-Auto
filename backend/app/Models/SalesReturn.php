<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesReturn extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = ['amount' => 'float', 'items' => 'integer', 'date' => 'date:Y-m-d'];
}
