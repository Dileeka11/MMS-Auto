<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountMapping extends Model
{
    protected $table = 'account_mappings';

    protected $fillable = [
        'key',
        'account_id',
    ];

    protected $casts = [
        'account_id' => 'integer',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
