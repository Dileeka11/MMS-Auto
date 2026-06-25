<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

Route::get('/__setup', function (\Illuminate\Http\Request $request) {
    if ($request->query('token') !== env('EXTRACT_TOKEN')) {
        abort(403, 'Forbidden');
    }
    try {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        $migrateOutput = \Illuminate\Support\Facades\Artisan::output();
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        $seedOutput = \Illuminate\Support\Facades\Artisan::output();
        return response('<pre>MIGRATE:\n' . e($migrateOutput) . "\n\nSEED:\n" . e($seedOutput) . '</pre>');
    } catch (\Throwable $e) {
        return response('<pre>ERROR: ' . e($e->getMessage()) . "\n\n" . e($e->getTraceAsString()) . '</pre>', 500);
    }
});
