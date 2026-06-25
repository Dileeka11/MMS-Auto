<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateRolePermissionsAndExtendUsers extends Migration
{
    public function up()
    {
        // Add operational columns to users so the UI no longer fakes them.
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'branch')) {
                $table->string('branch', 64)->nullable()->after('role');
            }
            if (!Schema::hasColumn('users', 'status')) {
                $table->string('status', 16)->default('Active')->after('branch');
                $table->index('status');
            }
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('role', 32);
            $table->string('module', 64);
            $table->string('action', 16); // View | Create | Edit | Delete | Approve
            $table->timestamps();
            $table->unique(['role', 'module', 'action'], 'role_perm_unique');
            $table->index(['role']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('role_permissions');
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'status')) {
                $table->dropIndex(['status']);
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('users', 'branch')) {
                $table->dropColumn('branch');
            }
        });
    }
}
