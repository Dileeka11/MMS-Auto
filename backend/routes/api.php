<?php

use App\Http\Controllers\Api\AccountCategoryController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountGroupController;
use App\Http\Controllers\Api\AccountingStatsController;
use App\Http\Controllers\Api\AccountMappingController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CashBookController;
use App\Http\Controllers\Api\CompanyProfileController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\FinancialReportController;
use App\Http\Controllers\Api\FinancialYearController;
use App\Http\Controllers\Api\GeneralLedgerController;
use App\Http\Controllers\Api\GrnController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\ItemController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\MasterController;
use App\Http\Controllers\Api\OpeningBalanceController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\RepAuthController;
use App\Http\Controllers\Api\RepController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\SalesOrderController;
use App\Http\Controllers\Api\SalesRepController;
use App\Http\Controllers\Api\SalesReturnController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\StockTransferController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TrialBalanceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| NMS-Auto API routes
|--------------------------------------------------------------------------
| Public: login only (with strict throttle).
| Everything else requires a valid Sanctum bearer token.
*/

// --- Public auth ---
Route::middleware('throttle:5,1')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('rep/login', [RepAuthController::class, 'login']);
});

// --- Mobile rep app (Sanctum token belongs to a SalesRep) ---
Route::middleware(['auth:sanctum', 'rep', 'throttle:120,1'])->prefix('rep')->group(function () {
    Route::get('me', [RepAuthController::class, 'me']);
    Route::post('logout', [RepAuthController::class, 'logout']);
    Route::get('dashboard', [RepController::class, 'dashboard']);
    Route::get('stock', [RepController::class, 'stock']);
    Route::get('customers', [RepController::class, 'customers']);
    Route::get('orders', [RepController::class, 'orders']);
    Route::post('orders', [RepController::class, 'storeOrder']);
});

// --- Protected ---
Route::middleware(['auth:sanctum', 'active', 'throttle:120,1'])->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::get('dashboard', [DashboardController::class, 'index']);

    // Supporting documents (BR copy, shop photo, PO quotation, expense bill)
    Route::post('attachments', [AttachmentController::class, 'store']);
    Route::get('attachments', [AttachmentController::class, 'show']);

    // Master files
    Route::get('items/next-code', function () {
        return response()->json(['code' => app(\App\Http\Controllers\Api\ItemController::class)->nextCode()]);
    });
    Route::post('items/bulk', [ItemController::class, 'bulk'])->middleware('perm:Item Master');
    Route::post('items/bulk-price', [ItemController::class, 'bulkPrice'])->middleware('perm:Item Master|Price Control,Edit');
    Route::delete('items', [ItemController::class, 'clearAll'])->middleware('admin');
    Route::apiResource('items', ItemController::class)->middleware('perm:Item Master|Price Control');
    Route::apiResource('customers', CustomerController::class)->middleware('perm:Customer Master');
    Route::apiResource('sales-reps', SalesRepController::class)->middleware('perm:Sales Reps');

    // Config-driven masters
    Route::middleware('perm:@master')->group(function () {
        Route::get('masters/{type}', [MasterController::class, 'index']);
        Route::post('masters/{type}', [MasterController::class, 'store']);
        Route::put('masters/{type}/{master}', [MasterController::class, 'update']);
        Route::delete('masters/{type}/{master}', [MasterController::class, 'destroy']);
    });

    // Procurement
    Route::apiResource('suppliers', SupplierController::class)->middleware('perm:Supplier Master');
    Route::apiResource('purchase-orders', PurchaseOrderController::class)->middleware('perm:Purchase Order');
    Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->middleware('admin');
    Route::post('purchase-orders/{purchaseOrder}/reject', [PurchaseOrderController::class, 'reject'])->middleware('admin');
    Route::apiResource('shipments', ShipmentController::class)->only(['index', 'show', 'store', 'destroy'])->middleware('perm:Costing & Shipment');
    Route::post('shipments/{shipment}/approve', [ShipmentController::class, 'approve'])->middleware('admin');
    Route::post('shipments/{shipment}/reject',  [ShipmentController::class, 'reject'])->middleware('admin');

    Route::apiResource('grns', GrnController::class)->only(['index', 'store', 'destroy'])->middleware('perm:GRN');
    Route::post('grns/{grn}/approve', [GrnController::class, 'approve'])->middleware('admin');
    Route::post('grns/{grn}/reject',  [GrnController::class, 'reject'])->middleware('admin');
    Route::get('po-tracking', [TrackingController::class, 'index']);

    // Sales
    Route::apiResource('quotations', QuotationController::class)->middleware('perm:Quotation');
    Route::get('sales-orders', [SalesOrderController::class, 'index']);
    Route::post('sales-orders/{salesOrder}/dispatch', [SalesOrderController::class, 'dispatchOrder'])->middleware('perm:Dispatch Notes,Create');
    Route::post('sales-orders/{salesOrder}/invoice', [SalesOrderController::class, 'invoice'])->middleware('perm:Sales Invoice|Dispatch Notes,Create');
    Route::delete('sales-orders/{salesOrder}', [SalesOrderController::class, 'destroy'])->middleware('perm:Dispatch Notes,Delete');
    Route::apiResource('invoices', InvoiceController::class)->middleware('perm:Sales Invoice');
    Route::post('invoices/{invoice}/approve-discount', [InvoiceController::class, 'approveDiscount'])->middleware('admin');
    Route::post('invoices/{invoice}/reject-discount', [InvoiceController::class, 'rejectDiscount'])->middleware('admin');
    Route::post('invoices/{invoice}/pay', [InvoiceController::class, 'pay'])->middleware('perm:Outstanding Settlement|Payment Receipt|Sales Invoice,Create');
    Route::apiResource('sales-returns', SalesReturnController::class)->only(['index', 'store', 'destroy'])->middleware('perm:Sales Return');
    Route::post('sales-returns/{salesReturn}/approve', [SalesReturnController::class, 'approve'])->middleware('perm:Sales Return,Approve');
    Route::post('sales-returns/{salesReturn}/reject', [SalesReturnController::class, 'reject'])->middleware('perm:Sales Return,Approve');
    Route::apiResource('receipts', ReceiptController::class)->only(['index', 'store', 'destroy'])->middleware('perm:Payment Receipt|Outstanding Settlement');
    Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'destroy'])->middleware('perm:Expense');

    // Stores
    Route::apiResource('stock-transfers', StockTransferController::class)->only(['index', 'store', 'update', 'destroy'])->middleware('perm:Stock Transfer');
    Route::apiResource('stock-adjustments', StockAdjustmentController::class)->only(['index', 'store', 'destroy'])->middleware('perm:Stock Adjustment');

    // Accounting — Chart of Accounts / General Ledger backbone
    Route::prefix('accounting')->middleware('perm:Accounting')->group(function () {
        Route::get('stats', [AccountingStatsController::class, 'index']);

        // Chart nested (categories -> groups) for dropdowns, then category CRUD (writes are locked → 403).
        Route::get('chart', [AccountCategoryController::class, 'chart']);
        Route::get('categories', [AccountCategoryController::class, 'index']);
        Route::post('categories', [AccountCategoryController::class, 'store']);
        Route::put('categories/{accountCategory}', [AccountCategoryController::class, 'update']);
        Route::delete('categories/{accountCategory}', [AccountCategoryController::class, 'destroy']);

        Route::get('groups', [AccountGroupController::class, 'index']);
        Route::post('groups', [AccountGroupController::class, 'store']);
        Route::put('groups/{accountGroup}', [AccountGroupController::class, 'update']);
        Route::delete('groups/{accountGroup}', [AccountGroupController::class, 'destroy']);

        Route::get('accounts', [AccountController::class, 'index']);
        Route::post('accounts', [AccountController::class, 'store']);
        Route::put('accounts/{account}', [AccountController::class, 'update']);
        Route::delete('accounts/{account}', [AccountController::class, 'destroy']);

        Route::get('journal-entries', [JournalEntryController::class, 'index']);
        Route::get('journal-entries/{journalEntry}', [JournalEntryController::class, 'show']);
        Route::post('journal-entries', [JournalEntryController::class, 'store']);
        Route::delete('journal-entries/{journalEntry}', [JournalEntryController::class, 'destroy']);

        // Auto-posting setup (role → ledger account) and full re-post.
        Route::get('posting-accounts', [AccountMappingController::class, 'index']);
        Route::put('posting-accounts', [AccountMappingController::class, 'update'])->middleware('admin');
        Route::post('posting/rebuild', [AccountMappingController::class, 'rebuild'])->middleware('admin');

        Route::get('general-ledger', [GeneralLedgerController::class, 'index']);
        Route::get('trial-balance', [TrialBalanceController::class, 'index']);
        Route::get('cashbook', [CashBookController::class, 'index']);
        Route::get('cashbook/accounts', [CashBookController::class, 'accounts']);
        Route::get('cashbook/suppliers', [CashBookController::class, 'suppliers']);
        Route::get('cash-vouchers', [CashBookController::class, 'vouchers']);
        Route::post('cash-vouchers', [CashBookController::class, 'store']);
        Route::delete('cash-vouchers/{cashVoucher}', [CashBookController::class, 'destroy']);
        Route::get('profit-loss', [FinancialReportController::class, 'profitLoss']);
        Route::get('balance-sheet', [FinancialReportController::class, 'balanceSheet']);

        Route::get('financial-years', [FinancialYearController::class, 'index']);
        Route::post('financial-years', [FinancialYearController::class, 'store']);
        Route::put('financial-years/{financialYear}', [FinancialYearController::class, 'update']);
        Route::delete('financial-years/{financialYear}', [FinancialYearController::class, 'destroy']);
        Route::post('financial-years/{financialYear}/set-active', [FinancialYearController::class, 'setActive']);

        Route::get('financial-years/{financialYear}/opening-balances', [OpeningBalanceController::class, 'index']);
        Route::post('financial-years/{financialYear}/opening-balances', [OpeningBalanceController::class, 'store']);
    });

    // Administration
    Route::get('company-profile', [CompanyProfileController::class, 'show']);
    Route::put('company-profile', [CompanyProfileController::class, 'update'])->middleware('perm:Company Profile,Edit');
    Route::post('company-profile/logo', [CompanyProfileController::class, 'uploadLogo'])->middleware('perm:Company Profile,Edit');

    // User & permission management (admin-only)
    Route::middleware('admin')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::get('permissions', [PermissionController::class, 'index']);
        Route::put('permissions/{user}', [PermissionController::class, 'updateUser']);
    });
});
