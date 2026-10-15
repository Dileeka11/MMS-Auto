<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountCategory extends Model
{
    protected $table = 'account_categories';

    protected $fillable = [
        'code',
        'name',
        'normal_balance',
        'statement_type',
    ];

    /** Groups belonging to this category. */
    public function groups()
    {
        return $this->hasMany(AccountGroup::class, 'category_id');
    }
}
