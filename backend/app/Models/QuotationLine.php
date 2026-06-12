<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuotationLine extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = ['rate' => 'float', 'qty' => 'integer'];

    public function quotation()
    {
        return $this->belongsTo(Quotation::class);
    }
}
