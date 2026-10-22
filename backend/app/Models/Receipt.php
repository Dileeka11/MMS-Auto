<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Receipt extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = ['amount' => 'float', 'date' => 'date:Y-m-d'];

    /**
     * Next unique receipt code (e.g. "RCP-6601"), from the highest existing
     * number — a row count reuses a code after a delete and hits the unique key.
     */
    public static function nextCode(): string
    {
        $max = (int) static::query()
            ->where('code', 'like', 'RCP-%')
            ->max(\Illuminate\Support\Facades\DB::raw('CAST(SUBSTRING(code, 5) AS UNSIGNED)'));

        return 'RCP-' . (max(6600, $max) + 1);
    }
}
