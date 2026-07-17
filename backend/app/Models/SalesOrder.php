<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class SalesOrder extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'total' => 'float',
        'items' => 'integer',
        'date' => 'date:Y-m-d',
        'dispatch_date' => 'date:Y-m-d',
    ];

    public function lines()
    {
        return $this->hasMany(SalesOrderLine::class);
    }

    /** Next unique sales-order code (e.g. "SO-1001"). */
    public static function nextCode(): string
    {
        $max = (int) static::query()
            ->where('code', 'like', 'SO-%')
            ->max(DB::raw('CAST(SUBSTRING(code, 4) AS UNSIGNED)'));

        return 'SO-' . (max(1000, $max) + 1);
    }

    /** Next unique dispatch-note number (e.g. "DN-1001"). */
    public static function nextDispatchNo(): string
    {
        $max = (int) static::query()
            ->where('dispatch_no', 'like', 'DN-%')
            ->max(DB::raw('CAST(SUBSTRING(dispatch_no, 4) AS UNSIGNED)'));

        return 'DN-' . (max(1000, $max) + 1);
    }
}
