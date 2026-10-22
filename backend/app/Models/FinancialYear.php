<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialYear extends Model
{
    protected $table = 'financial_years';

    protected $fillable = [
        'year_name',
        'start_date',
        'end_date',
        'is_active',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date'   => 'date:Y-m-d',
        'is_active'  => 'boolean',
    ];

    /** The year whose date range contains $date (the active one wins on overlap). */
    public static function forDate(string $date): ?self
    {
        return static::where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->orderByDesc('is_active')
            ->first();
    }

    /** Opening balances recorded for this financial year. */
    public function openingBalances()
    {
        return $this->hasMany(OpeningBalance::class, 'financial_year_id');
    }
}
