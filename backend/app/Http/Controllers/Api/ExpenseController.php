<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    public function index()
    {
        return Expense::orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|string',
            'amount' => 'required|numeric|gt:0',
            'branch' => 'nullable|string',
            'note' => 'nullable|string',
            'date' => 'nullable|date',
            // paid from which Cash Book account (null = Cash)
            'payment_account_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('is_cashbook', 1)->where('is_active', 1)],
        ]);
        $data['code'] = Expense::nextCode();
        $data['date'] = $data['date'] ?? now()->toDateString();
        $data['branch'] = $data['branch'] ?? 'Main Store';

        return DB::transaction(function () use ($data) {
            $expense = Expense::create($data);
            Posting::expense($expense);

            return response()->json($expense, 201);
        });
    }

    public function destroy(Expense $expense)
    {
        DB::transaction(function () use ($expense) {
            Posting::remove(Posting::EXPENSE, $expense->id);
            $expense->delete();
        });

        return response()->noContent();
    }
}
