<?php

namespace App\Support;

use App\Models\Item;
use App\Models\StockLayer;
use App\Models\StockLayerMove;

/**
 * FIFO stock layers.
 *
 * Every batch of stock that comes in is a layer (qty_left at unit_cost).
 * Stock going out is taken from the oldest layers first, and each take is
 * recorded as a move so the document can be reversed later. Item::fifo_cost
 * is kept at the cost of the oldest layer still on hand — the cost the next
 * unit sold will go out at.
 *
 * These methods only touch layers (and fifo_cost). The caller still owns
 * item.qty / avg_cost, exactly as before.
 */
class Fifo
{
    const OPENING = 'opening';
    const GRN = 'grn';
    const SALES_RETURN = 'return';
    const ADJUST = 'adjust';
    const INVOICE = 'invoice';
    const SYNC = 'sync';

    /** Add a layer of $qty received at $unitCost. */
    public static function receive(Item $item, int $qty, float $unitCost, string $type, $id = null, $date = null): void
    {
        if ($qty <= 0) {
            return;
        }
        StockLayer::create([
            'item_id' => $item->id,
            'source_type' => $type,
            'source_id' => $id,
            'date' => $date ?: now()->toDateString(),
            'qty_in' => $qty,
            'qty_left' => $qty,
            'unit_cost' => max(0, $unitCost),
        ]);
        static::refreshCost($item);
    }

    /**
     * Take $qty out oldest-first, recording each take against the document.
     * Returns the total cost taken. Any quantity the layers cannot cover
     * (stock that was never layered) is costed at the item's avg cost.
     */
    public static function consume(Item $item, int $qty, string $type, $id = null): float
    {
        if ($qty <= 0) {
            return 0.0;
        }
        $left = $qty;
        $cost = 0.0;
        $layers = static::openLayers($item);
        foreach ($layers as $layer) {
            if ($left <= 0) {
                break;
            }
            $take = min($left, $layer->qty_left);
            $layer->qty_left -= $take;
            $layer->save();
            StockLayerMove::create([
                'stock_layer_id' => $layer->id,
                'item_id' => $item->id,
                'source_type' => $type,
                'source_id' => $id,
                'qty' => $take,
                'unit_cost' => $layer->unit_cost,
            ]);
            $cost += $take * $layer->unit_cost;
            $left -= $take;
        }
        if ($left > 0) {
            $cost += $left * (float) $item->avg_cost;
        }
        static::refreshCost($item);

        return round($cost, 4);
    }

    /** Put back everything a document consumed (undo consume). */
    public static function restore(string $type, $id): void
    {
        $moves = StockLayerMove::where('source_type', $type)->where('source_id', $id)->get();
        $itemIds = [];
        foreach ($moves as $m) {
            StockLayer::where('id', $m->stock_layer_id)->increment('qty_left', $m->qty);
            $itemIds[$m->item_id] = true;
        }
        StockLayerMove::where('source_type', $type)->where('source_id', $id)->delete();
        foreach (array_keys($itemIds) as $itemId) {
            $item = Item::find($itemId);
            if ($item) {
                static::refreshCost($item);
            }
        }
    }

    /** How much of what a document received is still on hand (unsold). */
    public static function receivedLeft(Item $item, string $type, $id): ?int
    {
        $q = StockLayer::where('item_id', $item->id)->where('source_type', $type)->where('source_id', $id);
        if (! $q->exists()) {
            return null; // received before layers existed
        }

        return (int) $q->sum('qty_left');
    }

    /**
     * Take back $qty a document received (undo receive): from that document's
     * own layers first, then oldest-first for anything already sold on.
     */
    public static function removeReceipt(Item $item, string $type, $id, int $qty): void
    {
        $left = $qty;
        $own = StockLayer::where('item_id', $item->id)->where('source_type', $type)->where('source_id', $id)
            ->where('qty_left', '>', 0)->orderBy('id')->lockForUpdate()->get();
        foreach ($own as $layer) {
            if ($left <= 0) {
                break;
            }
            $take = min($left, $layer->qty_left);
            $layer->qty_left -= $take;
            $layer->save();
            $left -= $take;
        }
        static::trim($item, $left);
        static::refreshCost($item);
    }

    /**
     * Bring the layers in line with item.qty after a direct edit (Item Master,
     * Excel import, old documents that pre-date layers): missing stock is
     * added as a layer at the item's FIFO / avg cost, extra layered stock is
     * trimmed oldest-first.
     */
    public static function sync(Item $item): void
    {
        $layered = (int) StockLayer::where('item_id', $item->id)->sum('qty_left');
        $qty = max(0, (int) $item->qty);
        if ($layered < $qty) {
            $cost = (float) $item->fifo_cost > 0 ? (float) $item->fifo_cost : (float) $item->avg_cost;
            static::receive($item, $qty - $layered, $cost, static::SYNC);
        } elseif ($layered > $qty) {
            static::trim($item, $layered - $qty);
            static::refreshCost($item);
        }
    }

    /** Remove every layer of an item (item deleted). */
    public static function forget($itemId = null): void
    {
        if ($itemId === null) {
            StockLayerMove::query()->delete();
            StockLayer::query()->delete();

            return;
        }
        StockLayerMove::where('item_id', $itemId)->delete();
        StockLayer::where('item_id', $itemId)->delete();
    }

    /** fifo_cost = cost of the oldest layer still on hand (kept as-is when out of stock). */
    public static function refreshCost(Item $item): void
    {
        $oldest = StockLayer::where('item_id', $item->id)->where('qty_left', '>', 0)
            ->orderBy('date')->orderBy('id')->first();
        if ($oldest && round((float) $item->fifo_cost, 2) !== round($oldest->unit_cost, 2)) {
            $item->fifo_cost = round($oldest->unit_cost, 2);
            $item->save();
        }
    }

    /** Drop $qty from the oldest layers without recording a move. */
    protected static function trim(Item $item, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }
        foreach (static::openLayers($item) as $layer) {
            if ($qty <= 0) {
                break;
            }
            $take = min($qty, $layer->qty_left);
            $layer->qty_left -= $take;
            $layer->save();
            $qty -= $take;
        }
    }

    protected static function openLayers(Item $item)
    {
        return StockLayer::where('item_id', $item->id)->where('qty_left', '>', 0)
            ->orderBy('date')->orderBy('id')->lockForUpdate()->get();
    }
}
