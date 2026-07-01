<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUserPermissions extends Migration
{
    public function up()
    {
        Schema::create('user_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('module', 64);
            $table->string('action', 16); // View | Create | Edit | Delete | Approve
            $table->timestamps();
            $table->unique(['user_id', 'module', 'action'], 'user_perm_unique');
            $table->index(['user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_permissions');
    }
}
