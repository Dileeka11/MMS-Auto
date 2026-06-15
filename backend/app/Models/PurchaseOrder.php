<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = ['total' => 'float', 'date' => 'date:Y-m-d', 'pi_date' => 'date:Y-m-d'];

    public function lines()
    {
        return $this->hasMany(PurchaseOrderLine::class);
    }

    public function shipments()
    {
        return $this->hasMany(Shipment::class);
    }
}
