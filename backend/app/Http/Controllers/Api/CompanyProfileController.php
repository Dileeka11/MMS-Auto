<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use Illuminate\Http\Request;

class CompanyProfileController extends Controller
{
    public function show()
    {
        $profile = CompanyProfile::firstOrCreate(['id' => 1], [
            'name' => 'NMS-Auto',
            'tagline' => 'Spare Parts Distribution',
            'address' => 'No. 142, Galle Road, Colombo 03',
            'phone' => '+94 11 234 5678',
            'email' => 'sales@mms-auto.lk',
            'accent' => 'blue',
        ]);

        $data = $profile->toArray();
        if (!empty($data['logo_path'])) {
            $host = request()->getSchemeAndHttpHost();
            $data['logo_url'] = $host . '/api/storage/' . $data['logo_path'];
        }
        return response()->json($data);
    }

    public function update(Request $request)
    {
        // QQQQ part of the IRD tax invoice no: 1-15 letters/digits, no spaces
        $request->validate(['invoice_class' => ['sometimes', 'nullable', 'regex:/^[A-Za-z0-9]{1,15}$/']]);

        $profile = CompanyProfile::firstOrCreate(['id' => 1]);
        $fields = $request->only([
            'name', 'tagline', 'address', 'phone', 'email',
            'tax_no', 'vat_pct', 'currency', 'logo_path', 'favicon_path', 'accent', 'invoice_class',
        ]);
        if (array_key_exists('invoice_class', $fields)) {
            $fields['invoice_class'] = strtoupper($fields['invoice_class'] ?: 'VAT');
        }
        $profile->update($fields);

        return $profile;
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => 'required|image|max:2048',
        ]);

        $path = $request->file('logo')->store('logos', 'public');

        $profile = CompanyProfile::firstOrCreate(['id' => 1]);
        $profile->update(['logo_path' => $path]);

        $host = request()->getSchemeAndHttpHost();
        $url = $host . '/api/storage/' . $path;
        return response()->json(['logo_path' => $path, 'logo_url' => $url]);
    }
}
