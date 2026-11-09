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
        'vat_applied' => 'boolean', 'vat_pct' => 'float', 'vat_amount' => 'float',
        'credit_days' => 'integer', 'due_date' => 'date:Y-m-d',
    ];

    /** True for credit terms ("Credit Sale", "Credit (30 days)", ...). */
    public static function isCredit(?string $terms): bool
    {
        return $terms !== null && stripos($terms, 'credit') !== false;
    }

    /**
     * Credit period for an invoice: [credit_days, due_date].
     * Cash / card terms give [null, null]. For credit, an explicit due date
     * wins; otherwise due = invoice date + days, where days come from the
     * request, then the terms text ("Credit (30 days)"), then the customer's
     * credit period, then 30.
     */
    public static function creditTerms(?string $terms, string $date, $days = null, $dueDate = null, ?string $customer = null): array
    {
        if (! static::isCredit($terms)) {
            return [null, null];
        }
        $start = \Carbon\Carbon::parse($date)->startOfDay();
        if ($dueDate) {
            $due = \Carbon\Carbon::parse($dueDate)->startOfDay();

            return [max(0, $start->diffInDays($due, false)), $due->toDateString()];
        }
        if ($days === null || $days === '') {
            if (preg_match('/(\d+)\s*day/i', (string) $terms, $m)) {
                $days = (int) $m[1];
            } elseif ($customer && ($c = Customer::where('name', $customer)->first()) && $c->credit) {
                $days = (int) $c->credit;
            } else {
                $days = 30;
            }
        }
        $days = max(0, (int) $days);

        return [$days, $start->copy()->addDays($days)->toDateString()];
    }

    /**
     * VAT on a value of supply at the company-profile rate.
     * Returns [vat_pct, vat_amount]; both zero when VAT is not applied.
     */
    public static function vatFor(float $supply, bool $apply): array
    {
        if (! $apply) {
            return [0, 0];
        }
        $pct = (float) (CompanyProfile::find(1)->vat_pct ?? 18);

        return [$pct, round($supply * $pct / 100, 2)];
    }

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

    /**
     * IRD Tax Invoice serial (SEC/2026/E/03 clause 4.4): YYMMM_QQQQ_XXXXX,
     * e.g. "26NOV_VAT_00001". YYMMM comes from the invoice date, QQQQ is the
     * company-profile invoice class, and XXXXX runs on from the last tax
     * invoice issued (it does not restart each month). Call inside the
     * invoice transaction; the unique index stops a duplicate.
     */
    public static function nextTaxNo($date): string
    {
        $d = \Carbon\Carbon::parse($date ?: now());
        $class = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) (CompanyProfile::find(1)->invoice_class ?? ''))) ?: 'VAT';

        $max = (int) static::query()
            ->whereNotNull('tax_invoice_no')
            ->lockForUpdate()
            ->max(\Illuminate\Support\Facades\DB::raw("CAST(SUBSTRING_INDEX(tax_invoice_no, '_', -1) AS UNSIGNED)"));

        return $d->format('y') . strtoupper($d->format('M')) . '_' . substr($class, 0, 15) . '_'
            . str_pad((string) ($max + 1), 5, '0', STR_PAD_LEFT);
    }
}
