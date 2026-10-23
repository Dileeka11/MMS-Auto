<?php

namespace App\Models;

use App\Models\Concerns\HasRunningCode;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesReturn extends Model
{
    use HasFactory, HasRunningCode;

    public static function nextCode(): string
    {
        return static::runningCode('SR-', 3300);
    }

    protected $guarded = [];

    protected $casts = [
        'amount' => 'float', 'vat_amount' => 'float', 'items' => 'integer',
        'restocked' => 'boolean', 'date' => 'date:Y-m-d',
    ];

    /** Returned invoice lines (empty for older amount-only returns). */
    public function lines()
    {
        return $this->hasMany(SalesReturnLine::class);
    }
}
