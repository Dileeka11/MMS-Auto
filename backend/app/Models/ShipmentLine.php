<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShipmentLine extends Model
{
    protected $guarded = [];

    protected $casts = [
        'qty' => 'integer',
        'cost' => 'float',
        'total' => 'float',
        'landed_cost' => 'float',
        'landed_total' => 'float',
        'fob_lkr' => 'float',
        'freight_lkr' => 'float',
        'insurance_lkr' => 'float',
        'cid' => 'float',
        'pal' => 'float',
        'cess' => 'float',
        'vat' => 'float',
        'sscl' => 'float',
        'duty' => 'float',
        'other1' => 'float',
        'other2' => 'float',
        'other3' => 'float',
        'banking_alloc' => 'float',
        'clearance_alloc' => 'float',
        'slpa_alloc' => 'float',
        'demurrage_alloc' => 'float',
        'total_price_wo_vat' => 'float',
        'total_price_with_vat' => 'float',
        'unit_cost_wo_vat' => 'float',
        'unit_cost_with_vat' => 'float',
        'selling_price_wo_vat' => 'float',
        'selling_price_with_vat' => 'float',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function purchaseOrderLine()
    {
        return $this->belongsTo(PurchaseOrderLine::class);
    }
}
