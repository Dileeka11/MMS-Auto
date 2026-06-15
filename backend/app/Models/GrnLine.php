<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GrnLine extends Model
{
    protected $guarded = [];

    protected $casts = ['qty' => 'integer', 'cost' => 'float', 'total' => 'float'];

    public function grn()
    {
        return $this->belongsTo(Grn::class);
    }
}
