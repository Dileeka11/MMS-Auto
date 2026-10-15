<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    protected $table = 'accounts';

    protected $fillable = [
        'group_id',
        'parent_id',
        'code',
        'name',
        'is_active',
        'is_default',
        'created_by',
    ];

    protected $casts = [
        'group_id' => 'integer',
        'parent_id' => 'integer',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
    ];

    /** Parent group. */
    public function group()
    {
        return $this->belongsTo(AccountGroup::class, 'group_id');
    }

    /** Parent account (null for a top-level account under a group). */
    public function parent()
    {
        return $this->belongsTo(Account::class, 'parent_id');
    }

    /** Sub-accounts nested under this one. */
    public function children()
    {
        return $this->hasMany(Account::class, 'parent_id');
    }

    /** Journal lines that post to this account. */
    public function lines()
    {
        return $this->hasMany(JournalLine::class, 'account_id');
    }
}
