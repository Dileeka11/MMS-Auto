<?php

namespace App\Models\Concerns;

use App\Models\User;

/**
 * Two-admin approval workflow shared by PurchaseOrder, Shipment, and Grn.
 *
 * Requires the host table to have these columns:
 *   approver1_id, approver1_at, approver2_id, approver2_at,
 *   rejected_by_id, rejected_at, reject_reason
 */
trait HasTwoStepApproval
{
    public function approver1()
    {
        return $this->belongsTo(User::class, 'approver1_id');
    }

    public function approver2()
    {
        return $this->belongsTo(User::class, 'approver2_id');
    }

    public function rejectedBy()
    {
        return $this->belongsTo(User::class, 'rejected_by_id');
    }

    public function getApprovalsCountAttribute(): int
    {
        return ($this->approver1_id ? 1 : 0) + ($this->approver2_id ? 1 : 0);
    }

    public function getApprovalsRequiredAttribute(): int
    {
        return 2;
    }

    public function isFullyApproved(): bool
    {
        return (bool) ($this->approver1_id && $this->approver2_id);
    }
}
