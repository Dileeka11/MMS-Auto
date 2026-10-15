<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountGroup extends Model
{
    protected $table = 'account_groups';

    protected $fillable = [
        'category_id',
        'code',
        'name',
    ];

    protected $casts = [
        'category_id' => 'integer',
    ];

    /** Parent category. */
    public function category()
    {
        return $this->belongsTo(AccountCategory::class, 'category_id');
    }

    /** Ledger accounts under this group. */
    public function accounts()
    {
        return $this->hasMany(Account::class, 'group_id');
    }
}
