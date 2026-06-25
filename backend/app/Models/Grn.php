<?php

namespace App\Models;

use App\Models\Concerns\HasTwoStepApproval;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Grn extends Model
{
    use HasFactory, HasTwoStepApproval;

    protected $guarded = [];

    protected $appends = ['approvals_count', 'approvals_required'];

    protected $casts = [
        'total' => 'float',
        'items' => 'integer',
        'date' => 'date:Y-m-d',
        'approver1_at' => 'datetime',
        'approver2_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function lines()
    {
        return $this->hasMany(GrnLine::class);
    }

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }
}
