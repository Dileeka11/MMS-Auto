<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;

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
            'amount' => 'required|numeric',
            'branch' => 'nullable|string',
            'note' => 'nullable|string',
            'date' => 'nullable|date',
        ]);
        $data['code'] = 'EXP-' . (2100 + Expense::count() + 1);
        $data['date'] = $data['date'] ?? now()->toDateString();
        $data['branch'] = $data['branch'] ?? 'Main Store';

        return response()->json(Expense::create($data), 201);
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();

        return response()->noContent();
    }
}
