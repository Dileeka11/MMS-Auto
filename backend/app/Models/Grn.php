<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Grn extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = ['total' => 'float', 'items' => 'integer', 'date' => 'date:Y-m-d'];

    public function lines()
    {
        return $this->hasMany(GrnLine::class);
    }

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }
}
