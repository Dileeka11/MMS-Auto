<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OpeningBalance extends Model
{
    protected $table = 'opening_balances';

    protected $fillable = [
        'financial_year_id',
        'account_id',
        'debit',
        'credit',
    ];

    protected $casts = [
        'debit'  => 'decimal:2',
        'credit' => 'decimal:2',
    ];

    /** The financial year this balance belongs to. */
    public function financialYear()
    {
        return $this->belongsTo(FinancialYear::class, 'financial_year_id');
    }

    /** The chart-of-accounts entry this balance belongs to. */
    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
