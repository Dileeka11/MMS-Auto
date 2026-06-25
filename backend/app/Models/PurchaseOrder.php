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
}
