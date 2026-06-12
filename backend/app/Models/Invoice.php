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
    ];

    public function lines()
    {
        return $this->hasMany(InvoiceLine::class);
    }
}
