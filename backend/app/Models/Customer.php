<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'limit' => 'float',
        'outstanding' => 'float',
        'credit' => 'integer',
    ];

    /**
     * Move a customer's outstanding by $delta (+ invoiced, − paid / returned)
     * and refresh the credit-risk flag. Unknown customer names are ignored.
     */
    public static function adjustOutstanding(?string $name, float $delta): void
    {
        $customer = $name ? static::where('name', $name)->first() : null;
        if (! $customer || round($delta, 2) == 0) {
            return;
        }
        $customer->outstanding = max(0, round($customer->outstanding + $delta, 2));
        $customer->status = $customer->limit > 0 && $customer->outstanding > $customer->limit * 0.7 ? 'risk' : 'ok';
        $customer->save();
    }
}
