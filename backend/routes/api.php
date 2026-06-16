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
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\SalesRepController;
use App\Http\Controllers\Api\SalesReturnController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\StockTransferController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| NMS-Auto API routes
|--------------------------------------------------------------------------
*/

// Authentication
Route::post('login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
});

Route::get('dashboard', [DashboardController::class, 'index']);

// Master files (Item / Customer / Sales Rep are first-class tables)
Route::apiResource('items', ItemController::class);
Route::apiResource('customers', CustomerController::class);
Route::apiResource('sales-reps', SalesRepController::class);

// Config-driven masters: /api/masters/{type}
Route::get('masters/{type}', [MasterController::class, 'index']);
Route::post('masters/{type}', [MasterController::class, 'store']);
Route::put('masters/{type}/{master}', [MasterController::class, 'update']);
Route::delete('masters/{type}/{master}', [MasterController::class, 'destroy']);

// Procurement
Route::apiResource('purchase-orders', PurchaseOrderController::class);
Route::apiResource('shipments', ShipmentController::class)->only(['index', 'show', 'store', 'destroy']);
Route::apiResource('grns', GrnController::class)->only(['index', 'store', 'destroy']);
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
