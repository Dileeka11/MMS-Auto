<?php

namespace App\Models;

use App\Models\Concerns\HasRunningCode;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    use HasFactory, HasRunningCode;

    public static function nextCode(): string
    {
        return static::runningCode('ADJ-', 100);
    }

    protected $guarded = [];

    protected $casts = ['qty' => 'integer', 'date' => 'date:Y-m-d'];
}
