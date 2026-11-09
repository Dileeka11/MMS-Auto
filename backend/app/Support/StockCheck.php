<?php

namespace App\Support;

use App\Models\Item;
use Illuminate\Validation\ValidationException;

/**
 * Stops a sale or dispatch from taking stock that is not there.
 * Lines are arrays with code / name / qty; lines without a matching item
 * code (services, free-text lines) are not stock and are skipped. The same
 * item on several lines is checked against its combined quantity. Items are
 * row-locked, so call this inside the transaction that moves the stock.
 */
class StockCheck
{
    /** Free stock = on hand less what dispatched orders already hold. */
    public static function assertAvailable(array $lines): void
    {
        static::check($lines, true);
    }

    /** Physical stock only (for invoicing an order whose stock is already reserved). */
    public static function assertOnHand(array $lines): void
    {
        static::check($lines, false);
    }

    protected static function check(array $lines, bool $lessReserved): void
    {
        $want = [];
        $names = [];
        foreach ($lines as $l) {
            $code = trim((string) ($l['code'] ?? ''));
            if ($code === '') {
                continue;
            }
            $key = mb_strtolower($code);
            $want[$key] = ($want[$key] ?? 0) + (int) $l['qty'];
            $names[$key] = $l['name'] ?? $code;
        }
        if (! $want) {
            return;
        }

        $problems = [];
        $items = Item::whereIn('code', array_keys($want))->lockForUpdate()->get();
        foreach ($items as $item) {
            $key = mb_strtolower(trim((string) $item->code));
            if (! isset($want[$key])) {
                continue;
            }
            $free = (int) $item->qty - ($lessReserved ? (int) $item->reserved : 0);
            if ($want[$key] > $free) {
                $held = $lessReserved && (int) $item->reserved > 0 ? " ({$item->reserved} of {$item->qty} reserved for dispatch)" : '';
                $problems[] = "{$item->code} {$item->name}: asked {$want[$key]}, only " . max(0, $free) . " available{$held}.";
            }
        }

        if ($problems) {
            throw ValidationException::withMessages(['lines' => array_merge(['Not enough stock:'], $problems)]);
        }
    }
}
