<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvoiceLine extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'rate' => 'float', 'qty' => 'integer',
        'fifo_cost' => 'float', 'avg_cost' => 'float',
    ];

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }
}
