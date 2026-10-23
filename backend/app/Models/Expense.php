<?php

namespace App\Models;

use App\Models\Concerns\HasRunningCode;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasFactory, HasRunningCode;

    public static function nextCode(): string
    {
        return static::runningCode('EXP-', 2100);
    }

    protected $guarded = [];

    protected $casts = ['amount' => 'float', 'date' => 'date:Y-m-d'];
}
