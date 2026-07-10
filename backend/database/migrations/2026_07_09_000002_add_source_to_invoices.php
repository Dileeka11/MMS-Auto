<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks where an invoice originated: 'web' (admin panel) or 'app' (rep mobile app).
 * Lets the Sales Invoice screen list the two sources separately.
 */
class AddSourceToInvoices extends Migration
{
    public function up()
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('source', 8)->default('web')->after('rep'); // web | app
            $table->index('source');
        });
    }

    public function down()
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['source']);
            $table->dropColumn('source');
        });
    }
}
