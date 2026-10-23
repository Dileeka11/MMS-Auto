<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesReturnLine extends Model
{
    protected $guarded = [];

    protected $casts = ['qty' => 'integer', 'rate' => 'float', 'unit_cost' => 'float'];

    public function salesReturn()
    {
        return $this->belongsTo(SalesReturn::class);
    }
}
