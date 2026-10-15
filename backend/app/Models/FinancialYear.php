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

    /** Opening balances recorded for this financial year. */
    public function openingBalances()
    {
        return $this->hasMany(OpeningBalance::class, 'financial_year_id');
    }
}
