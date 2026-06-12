<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesRep;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SalesRepController extends Controller
{
    public function index()
    {
        return SalesRep::orderBy('code')->get();
    }

    public function show(SalesRep $salesRep)
    {
        return $salesRep;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'zone' => 'nullable|string',
            'target' => 'nullable|numeric',
        ]);
        $n = SalesRep::count() + 1;
        $data['code'] = 'REP-' . str_pad($n, 2, '0', STR_PAD_LEFT);
        $data['target'] = $data['target'] ?? 500000;
        $data['avatar'] = strtoupper(substr(Str::of($data['name'])->explode(' ')->map(fn ($w) => $w[0] ?? '')->implode(''), 0, 2));
        $data['login'] = Str::of($data['name'])->lower()->replaceMatches('/[^a-z]+/', '.') . '@mms';
        $data['app_enabled'] = true;

        return response()->json(SalesRep::create($data), 201);
    }

    public function update(Request $request, SalesRep $salesRep)
    {
        $salesRep->fill($request->only(['name', 'zone', 'target', 'achieved', 'visits', 'invoices', 'app_enabled']));
        $salesRep->save();

        return $salesRep;
    }

    public function destroy(SalesRep $salesRep)
    {
        $salesRep->delete();

        return response()->noContent();
    }
}
