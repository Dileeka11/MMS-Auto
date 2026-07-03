<?php

namespace App\Models;

use App\Models\Concerns\HasTwoStepApproval;
use Illuminate\Database\Eloquent\Model;

class Shipment extends Model
{
    use HasTwoStepApproval;

    protected $guarded = [];

    protected $appends = ['approvals_count', 'approvals_required'];

    // The original costing Excel is stored base64-encoded (can be hundreds of KB)
    // but is never read back by the client — it's write-only. Keep it out of every
    // JSON response so shipment/PO lists and details stay lightweight and fast.
    protected $hidden = ['cost_file_data'];

    protected $casts = [
        'approver1_at' => 'datetime',
        'approver2_at' => 'datetime',
        'rejected_at' => 'datetime',
        'date' => 'date:Y-m-d',
        'etd' => 'date:Y-m-d',
        'eta_date' => 'date:Y-m-d',
        'cusdec_date' => 'date:Y-m-d',
        'duty_date' => 'date:Y-m-d',
        'items_total' => 'float',
        'extras_total' => 'float',
        'landed_total' => 'float',
        'items_total_usd' => 'float',
        'items_total_lkr' => 'float',
        'charges_total_lkr' => 'float',
        'banking_rate' => 'float',
        'custom_rate' => 'float',
        'settlement_rate' => 'float',
        'cid_amount' => 'float',
        'pal_amount' => 'float',
        'duty_amount' => 'float',
        'cess_amount' => 'float',
        'vat_amount' => 'float',
        'sscl_amount' => 'float',
        'other1_amount' => 'float',
        'other2_amount' => 'float',
        'other3_amount' => 'float',
        'gross_weight' => 'float',
        'net_weight' => 'float',
        'no_of_packages' => 'integer',
        'freight' => 'array',
        'insurance' => 'array',
        'banking' => 'array',
        'clearance' => 'array',
        'slpa' => 'array',
        'demurrage' => 'array',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function lines()
    {
        return $this->hasMany(ShipmentLine::class);
    }

    public function extras()
    {
        return $this->hasMany(ShipmentExtra::class);
    }
}
