<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashVoucher extends Model
{
    public const PREFIX = ['receipt' => 'CR', 'payment' => 'CP', 'transfer' => 'CT'];

    protected $guarded = [];

    protected $casts = [
        'amount' => 'float',
        'date' => 'date:Y-m-d',
        'account_id' => 'integer',
        'counter_account_id' => 'integer',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function counterAccount()
    {
        return $this->belongsTo(Account::class, 'counter_account_id');
    }

    /** Next code for a voucher type, from the highest existing number (e.g. "CP-0007"). */
    public static function nextCode(string $type): string
    {
        $prefix = static::PREFIX[$type];
        $max = (int) static::query()
            ->where('code', 'like', "{$prefix}-%")
            ->max(\Illuminate\Support\Facades\DB::raw('CAST(SUBSTRING(code, 4) AS UNSIGNED)'));

        return $prefix . '-' . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }
}
