<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Re-usable two-admin approve / reject implementation.
 * The model must use App\Models\Concerns\HasTwoStepApproval.
 */
trait HandlesApprovals
{
    protected function performApprove(Request $request, Model $entity, string $auditKey): Model
    {
        $user = $request->user();

        if ($entity->status === 'Rejected') {
            throw ValidationException::withMessages(['status' => 'This record was rejected and cannot be approved.']);
        }
        if ($entity->isFullyApproved()) {
            throw ValidationException::withMessages(['status' => 'This record is already fully approved.']);
        }
        if ($entity->approver1_id === $user->id || $entity->approver2_id === $user->id) {
            throw ValidationException::withMessages(['status' => 'You have already approved this record. A second, different admin must approve.']);
        }

        if (!$entity->approver1_id) {
            $entity->approver1_id = $user->id;
            $entity->approver1_at = now();
        } else {
            $entity->approver2_id = $user->id;
            $entity->approver2_at = now();
            $entity->status = 'Approved';
        }
        $entity->save();

        Log::channel('audit')->info($auditKey . '_approved', [
            'id' => $entity->id,
            'code' => $entity->code ?? null,
            'approver_id' => $user->id,
            'approvals_count' => $entity->approvals_count,
            'fully_approved' => $entity->isFullyApproved(),
        ]);

        return $entity->fresh();
    }

    protected function performReject(Request $request, Model $entity, string $auditKey): Model
    {
        $data = $request->validate(['reason' => 'nullable|string|max:500']);
        $user = $request->user();

        if ($entity->status === 'Approved' || $entity->isFullyApproved()) {
            throw ValidationException::withMessages(['status' => 'Approved records cannot be rejected.']);
        }

        $entity->update([
            'status' => 'Rejected',
            'rejected_by_id' => $user->id,
            'rejected_at' => now(),
            'reject_reason' => $data['reason'] ?? null,
        ]);

        Log::channel('audit')->info($auditKey . '_rejected', [
            'id' => $entity->id,
            'code' => $entity->code ?? null,
            'rejected_by' => $user->id,
            'reason' => $data['reason'] ?? null,
        ]);

        return $entity->fresh();
    }
}
