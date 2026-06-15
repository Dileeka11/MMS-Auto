<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GrnLine extends Model
{
    protected $guarded = [];

    protected $casts = [
        'qty' => 'integer',
        'cost' => 'float',
        'total' => 'float',
        'unit_cost_wo_vat' => 'float',
        'unit_cost_with_vat' => 'float',
        'selling_price_wo_vat' => 'float',
        'selling_price_with_vat' => 'float',
    ];

    public function grn()
    {
        return $this->belongsTo(Grn::class);
    }
}
