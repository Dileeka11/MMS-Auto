<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Quotation extends Model
{
    use HasFactory;

    const OPEN = 'Open';
    const CONVERTED = 'Converted';
    const EXPIRED = 'Expired';

    protected $guarded = [];

    protected $casts = ['total' => 'float', 'items' => 'integer', 'date' => 'date:Y-m-d', 'valid_until' => 'date:Y-m-d'];

    public function lines()
    {
        return $this->hasMany(QuotationLine::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::OPEN;
    }

    /**
     * Mark Open quotations whose validity date has passed as Expired.
     * There is no scheduler on the host, so this runs whenever quotations
     * are read or converted. A quote stays valid through its Valid Until day.
     */
    public static function expireStale(): int
    {
        return static::where('status', self::OPEN)
            ->whereNotNull('valid_until')
            ->where('valid_until', '<', now()->toDateString())
            ->update(['status' => self::EXPIRED]);
    }
}
