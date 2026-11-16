<?php

namespace App\Models;

use App\Models\Concerns\HasTwoStepApproval;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory, HasTwoStepApproval;

    protected $guarded = [];

    protected $casts = [
        'total' => 'float',
        'date' => 'date:Y-m-d',
        'pi_date' => 'date:Y-m-d',
        'approver1_at' => 'datetime',
        'approver2_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    protected $appends = ['approvals_count', 'approvals_required'];

    public function lines()
    {
        return $this->hasMany(PurchaseOrderLine::class);
    }

    public function shipments()
    {
        return $this->hasMany(Shipment::class);
    }

    /**
     * Local purchases bought Ex-Showroom carry no freight, duty or clearance,
     * so they skip Costing & Shipment and go straight to GRN. Matches
     * "Ex-Showroom", "ExShowroom", "Ex Showroom", … in any case.
     */
    public function isExShowroom(): bool
    {
        return strtolower(preg_replace('/[^a-z]/i', '', (string) $this->inco_terms)) === 'exshowroom';
    }
}
