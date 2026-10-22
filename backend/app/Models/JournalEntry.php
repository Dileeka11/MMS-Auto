<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model
{
    protected $table = 'journal_entries';

    protected $fillable = [
        'entry_date',
        'posting_date',
        'reference',
        'source_type',
        'source_id',
        'currency',
        'branch',
        'memo',
        'financial_year_id',
        'invoice_number',
        'customer_name',
        'payment_method',
        'payment_account_id',
    ];

    protected $casts = [
        'entry_date' => 'date:Y-m-d',
        'posting_date' => 'date:Y-m-d',
    ];

    protected $appends = ['source_label'];

    /** "Sales Invoice", "GRN", … for auto-posted entries; "Manual" otherwise. */
    public function getSourceLabelAttribute(): string
    {
        return \App\Services\Accounting\Posting::SOURCE_LABELS[$this->source_type] ?? 'Manual';
    }

    /** Debit/credit legs of this entry. */
    public function lines()
    {
        return $this->hasMany(JournalLine::class, 'entry_id');
    }
}
