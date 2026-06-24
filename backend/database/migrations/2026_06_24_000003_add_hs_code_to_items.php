<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddHsCodeToItems extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('items', 'hs_code')) {
            Schema::table('items', function (Blueprint $table) {
                $table->string('hs_code', 32)->nullable()->after('code');
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('items', 'hs_code')) {
            Schema::table('items', function (Blueprint $table) {
                $table->dropColumn('hs_code');
            });
        }
    }
}
