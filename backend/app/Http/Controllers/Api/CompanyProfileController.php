<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use Illuminate\Http\Request;

class CompanyProfileController extends Controller
{
    public function show()
    {
        return CompanyProfile::firstOrCreate(['id' => 1], [
            'name' => 'NMS-Auto',
            'tagline' => 'Spare Parts Distribution',
            'address' => 'No. 142, Galle Road, Colombo 03',
            'phone' => '+94 11 234 5678',
            'email' => 'sales@mms-auto.lk',
            'accent' => 'blue',
        ]);
    }

    public function update(Request $request)
    {
        $profile = CompanyProfile::firstOrCreate(['id' => 1]);
        $profile->update($request->only([
            'name', 'tagline', 'address', 'phone', 'email',
            'tax_no', 'currency', 'logo_path', 'favicon_path', 'accent',
        ]));

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

        return response()->json(['logo_path' => $path]);
    }
}
