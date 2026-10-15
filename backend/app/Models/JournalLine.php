<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalLine extends Model
{
    protected $table = 'journal_lines';

    public $timestamps = false;

    protected $fillable = [
        'entry_id',
        'account_id',
        'debit',
        'credit',
        'memo',
    ];

    protected $casts = [
        'entry_id' => 'integer',
        'account_id' => 'integer',
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
    ];

    /** Parent journal entry. */
    public function entry()
    {
        return $this->belongsTo(JournalEntry::class, 'entry_id');
    }

    /** Account this line posts to. */
    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
