<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Double-entry general-ledger backbone (Chart of Accounts / Accounting module).
 *
 * We intentionally do NOT declare DB-level foreign keys: the live host rejects
 * FK constraints (errno 150). Referential integrity is enforced at the app
 * layer (validation + delete guards in the accounting controllers).
 * Columns are indexed so joins stay fast.
 */
class CreateAccountingTables extends Migration
{
    public function up()
    {
        // 1. Top-level categories (Assets, Liabilities, Equity, Income, Expenses).
        Schema::create('account_categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();
            $table->string('name', 100);
            $table->enum('normal_balance', ['debit', 'credit']);
            // BS = Balance Sheet, PNL = Profit & Loss.
            $table->enum('statement_type', ['BS', 'PNL'])->default('BS');
            $table->timestamps();
        });

        // 2. Groups (Current Assets, Long Term Liabilities, …).
        Schema::create('account_groups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('category_id')->index();
            $table->string('code', 10)->unique();
            $table->string('name', 100);
            $table->timestamps();
        });

        // 3. Individual ledger accounts (Cash, Bank, Trade Receivable, …).
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('group_id')->index();
            $table->string('code', 20)->unique();
            $table->string('name', 150);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false); // system-seeded vs user-created
            $table->string('created_by', 50)->default('admin');
            $table->timestamps();
        });

        // 4. Journal entries (one balanced voucher).
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->date('entry_date')->index();
            $table->date('posting_date')->nullable();
            $table->string('reference', 50)->nullable();
            $table->string('source_type', 40)->nullable(); // ERP doc kind, for tracing
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('currency', 10)->default('LKR');
            $table->string('branch', 100)->nullable();
            $table->string('memo', 255)->nullable();
            $table->timestamps();
            // One journal per ERP document (nullable columns don't collide).
            $table->unique(['source_type', 'source_id']);
        });

        // 5. Journal lines (the debit/credit legs; per row EITHER debit OR credit).
        Schema::create('journal_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('entry_id')->index();
            $table->unsignedBigInteger('account_id')->index();
            $table->decimal('debit', 15, 2)->default(0);
            $table->decimal('credit', 15, 2)->default(0);
            $table->string('memo', 255)->nullable();
        });
    }

    public function down()
    {
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('account_groups');
        Schema::dropIfExists('account_categories');
    }
}
