<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\DB;

/**
 * Document codes like "EXP-2101": next number after the highest one in use.
 * Counting rows instead reuses a code after a delete and hits the unique key.
 */
trait HasRunningCode
{
    /** e.g. runningCode('EXP-', 2100) → "EXP-2101" on an empty table. */
    protected static function runningCode(string $prefix, int $start): string
    {
        $max = (int) static::query()
            ->where('code', 'like', $prefix . '%')
            ->max(DB::raw('CAST(SUBSTRING(code, ' . (strlen($prefix) + 1) . ') AS UNSIGNED)'));

        return $prefix . (max($start, $max) + 1);
    }
}
