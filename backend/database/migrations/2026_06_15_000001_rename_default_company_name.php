<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class RenameDefaultCompanyName extends Migration
{
    public function up()
    {
        DB::table('company_profiles')->where('name', 'MMS-Auto')->update(['name' => 'NMS-Auto']);
    }

    public function down()
    {
        DB::table('company_profiles')->where('name', 'NMS-Auto')->update(['name' => 'MMS-Auto']);
    }
}
