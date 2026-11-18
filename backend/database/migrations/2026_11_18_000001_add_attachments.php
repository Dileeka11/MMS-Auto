<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Document attachments (paths on the private "local" disk, served only to
 * logged-in users via GET /api/attachments):
 *   customers       : BR number + BR copy + shop photo (asked at registration)
 *   purchase_orders : supplier quotation (PDF / image)
 *   expenses        : bill / receipt (PDF / image)
 */
class AddAttachments extends Migration
{
    public function up()
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('br_no', 64)->nullable()->after('tax_no');
            $table->string('br_doc')->nullable()->after('br_no');
            $table->string('shop_photo')->nullable()->after('br_doc');
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('quotation_doc')->nullable()->after('notes');
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('attachment')->nullable()->after('note');
        });
    }

    public function down()
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['br_no', 'br_doc', 'shop_photo']);
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('quotation_doc');
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('attachment');
        });
    }
}
