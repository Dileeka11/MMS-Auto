<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanyProfileController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\GrnController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\ItemController;
use App\Http\Controllers\Api\MasterController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\SalesRepController;
use App\Http\Controllers\Api\SalesReturnController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\StockTransferController;
use App\Http\Controllers\Api\SupplierController;
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
});

// --- One-time setup (remove after first run) ---
Route::get('setup-db', function (\Illuminate\Http\Request $request) {
    if ($request->query('token') !== 'nms-auto-setup-2026-one-time-xyz9k4j2') {
        abort(403, 'Forbidden');
    }
    try {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        $migrateOutput = \Illuminate\Support\Facades\Artisan::output();
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        $seedOutput = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'migrate' => $migrateOutput,
            'seed' => $seedOutput,
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ], 500);
    }
});

// --- Protected ---
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::get('dashboard', [DashboardController::class, 'index']);

    // Master files
    Route::get('items/next-code', function () {
        return response()->json(['code' => app(\App\Http\Controllers\Api\ItemController::class)->nextCode()]);
    });
    Route::post('items/bulk', [ItemController::class, 'bulk']);
    Route::delete('items', [ItemController::class, 'clearAll']);
    Route::apiResource('items', ItemController::class);
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('sales-reps', SalesRepController::class);

    // Config-driven masters
    Route::get('masters/{type}', [MasterController::class, 'index']);
    Route::post('masters/{type}', [MasterController::class, 'store']);
    Route::put('masters/{type}/{master}', [MasterController::class, 'update']);
    Route::delete('masters/{type}/{master}', [MasterController::class, 'destroy']);

    // Procurement
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->middleware('admin');
    Route::post('purchase-orders/{purchaseOrder}/reject', [PurchaseOrderController::class, 'reject'])->middleware('admin');
    Route::apiResource('shipments', ShipmentController::class)->only(['index', 'show', 'store', 'destroy']);
    Route::post('shipments/{shipment}/approve', [ShipmentController::class, 'approve'])->middleware('admin');
    Route::post('shipments/{shipment}/reject',  [ShipmentController::class, 'reject'])->middleware('admin');

    Route::apiResource('grns', GrnController::class)->only(['index', 'store', 'destroy']);
    Route::post('grns/{grn}/approve', [GrnController::class, 'approve'])->middleware('admin');
    Route::post('grns/{grn}/reject',  [GrnController::class, 'reject'])->middleware('admin');
    Route::get('po-tracking', [TrackingController::class, 'index']);

    // Sales
    Route::apiResource('quotations', QuotationController::class);
    Route::apiResource('invoices', InvoiceController::class);
    Route::apiResource('sales-returns', SalesReturnController::class)->only(['index', 'store', 'destroy']);
    Route::post('sales-returns/{salesReturn}/approve', [SalesReturnController::class, 'approve']);
    Route::post('sales-returns/{salesReturn}/reject', [SalesReturnController::class, 'reject']);
    Route::apiResource('receipts', ReceiptController::class)->only(['index', 'store', 'destroy']);
    Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'destroy']);

    // Stores
    Route::apiResource('stock-transfers', StockTransferController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('stock-adjustments', StockAdjustmentController::class)->only(['index', 'store', 'destroy']);

    // Administration
    Route::get('company-profile', [CompanyProfileController::class, 'show']);
    Route::put('company-profile', [CompanyProfileController::class, 'update']);

    // User & permission management (admin-only)
    Route::middleware('admin')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::get('permissions', [PermissionController::class, 'index']);
        Route::put('permissions/{role}', [PermissionController::class, 'updateRole']);
    });
});
