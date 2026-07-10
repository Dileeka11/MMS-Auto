<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'total' => 'float', 'paid' => 'float', 'due' => 'float',
        'items' => 'integer', 'date' => 'date:Y-m-d',
    ];

    public function lines()
    {
        return $this->hasMany(InvoiceLine::class);
    }

    /**
     * Next unique invoice code (e.g. "INV-5504").
     *
     * Derived from the highest existing numeric code rather than the row
     * count, so deleting an invoice never causes a new one to reuse an old
     * code. Reusing a code made two separate orders look like the same one.
     */
    public static function nextCode(): string
    {
        $max = (int) static::query()
            ->where('code', 'like', 'INV-%')
            ->max(\Illuminate\Support\Facades\DB::raw('CAST(SUBSTRING(code, 5) AS UNSIGNED)'));

        return 'INV-' . (max(5500, $max) + 1);
    }
}
