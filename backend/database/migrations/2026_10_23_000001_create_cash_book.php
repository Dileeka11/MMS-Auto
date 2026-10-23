<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cash Book.
 *  - accounts.is_cashbook marks the cash / bank accounts the Cash Book runs on
 *    (Cash 110000, Bank 110100 and HNB 1001 to start with).
 *  - cash_vouchers: money in / out / between cash & bank that doesn't come
 *    from another ERP document (supplier payments, other income, deposits…).
 *  - expenses.payment_account_id / receipts.account_id: which cash or bank
 *    account the money left from / went into (null = the posting default).
 *
 * No DB-level FK — live host rejects (errno 150).
 */
class CreateCashBook extends Migration
{
    public function up()
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->boolean('is_cashbook')->default(false);
        });
        DB::table('accounts')->whereIn('code', ['110000', '110100', '1001'])->update(['is_cashbook' => true]);

        Schema::create('cash_vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();             // CR-0001 / CP-0001 / CT-0001
            $table->string('type', 10);                        // receipt | payment | transfer
            $table->date('date')->index();
            $table->unsignedBigInteger('account_id')->index(); // the cash / bank account (transfer: from)
            $table->unsignedBigInteger('counter_account_id')->index(); // the other side (transfer: to)
            $table->decimal('amount', 14, 2);
            $table->string('party', 150)->nullable();          // paid to / received from
            $table->string('supplier', 150)->nullable()->index();
            $table->string('reference', 60)->nullable();       // cheque / slip no
            $table->string('memo', 255)->nullable();
            $table->string('created_by', 100)->nullable();
            $table->timestamps();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedBigInteger('payment_account_id')->nullable();
        });
        Schema::table('receipts', function (Blueprint $table) {
            $table->unsignedBigInteger('account_id')->nullable();
        });
    }

    public function down()
    {
        Schema::dropIfExists('cash_vouchers');
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('is_cashbook');
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('payment_account_id');
        });
        Schema::table('receipts', function (Blueprint $table) {
            $table->dropColumn('account_id');
        });
    }
}
