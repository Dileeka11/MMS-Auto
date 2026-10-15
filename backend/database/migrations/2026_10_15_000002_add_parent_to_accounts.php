<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make the Chart of Accounts a tree: an account may sit under a group
 * (parent_id NULL) OR under another account (parent_id set). A sub-account
 * inherits its parent's group_id, so every account still rolls up to a
 * group/category for the Trial Balance & statements.
 *
 * No DB-level FK — the live host rejects them (errno 150); integrity is
 * enforced in AccountController.
 */
class AddParentToAccounts extends Migration
{
    public function up()
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_id')->nullable()->after('group_id')->index();
        });
    }

    public function down()
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropIndex(['parent_id']);
            $table->dropColumn('parent_id');
        });
    }
}
