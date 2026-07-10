<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesRep;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
            'phone' => 'nullable|string',
            'branch' => 'nullable|string',
            'target' => 'nullable|numeric',
            'email' => 'nullable|email|unique:sales_reps,email',
            'password' => 'nullable|string|min:6',
        ]);

        $n = SalesRep::count() + 1;
        $data['code'] = 'REP-' . str_pad($n, 2, '0', STR_PAD_LEFT);
        $data['target'] = $data['target'] ?? 500000;
        $data['avatar'] = strtoupper(substr(Str::of($data['name'])->explode(' ')->map(fn ($w) => $w[0] ?? '')->implode(''), 0, 2));

        // Login email — use provided or auto-generate a unique one.
        $email = $data['email'] ?? (Str::of($data['name'])->lower()->replaceMatches('/[^a-z]+/', '.')->trim('.') . '@mms.lk');
        while (SalesRep::where('email', $email)->exists()) {
            $email = Str::of($email)->before('@') . '.' . rand(1, 99) . '@mms.lk';
        }
        $data['email'] = $email;
        $data['login'] = $email;

        // Password — use provided or generate a temporary one. Return the
        // plain value ONCE so the admin can hand it to the rep.
        $plainPassword = $data['password'] ?? ('Mms@' . rand(1000, 9999));
        $data['password'] = Hash::make($plainPassword);
        $data['app_enabled'] = true;

        $rep = SalesRep::create($data);

        return response()->json(
            array_merge($rep->toArray(), ['plain_password' => $plainPassword]),
            201
        );
    }

    public function update(Request $request, SalesRep $salesRep)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'zone' => 'nullable|string',
            'phone' => 'nullable|string',
            'branch' => 'nullable|string',
            'target' => 'nullable|numeric',
            'achieved' => 'nullable|numeric',
            'visits' => 'nullable|integer',
            'invoices' => 'nullable|integer',
            'app_enabled' => 'nullable|boolean',
            'email' => 'nullable|email|unique:sales_reps,email,' . $salesRep->id,
            'password' => 'nullable|string|min:6',
        ]);

        $plainPassword = null;
        if (! empty($data['password'])) {
            $plainPassword = $data['password'];
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        if (! empty($data['email'])) {
            $data['login'] = $data['email'];
        }

        $salesRep->fill($data);
        $salesRep->save();

        $out = $salesRep->toArray();
        if ($plainPassword) {
            $out['plain_password'] = $plainPassword;
        }

        return $out;
    }

    public function destroy(SalesRep $salesRep)
    {
        $salesRep->delete();

        return response()->noContent();
    }
}
