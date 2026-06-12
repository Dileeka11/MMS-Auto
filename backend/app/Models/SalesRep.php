<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesRep extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'target' => 'float',
        'achieved' => 'float',
        'visits' => 'integer',
        'invoices' => 'integer',
        'app_enabled' => 'boolean',
    ];
}
