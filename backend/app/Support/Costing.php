<?php

namespace App\Support;

/**
 * Authoritative costing math for a Shipment.
 *
 * Convention:
 *  - Line `cost` is the FOB unit price in the PO currency (typically USD).
 *  - `banking_rate` converts FOB to LKR for value-based proration.
 *  - All charge buckets are absolute LKR amounts at the shipment level
 *    and get prorated to each line by its FOB-LKR share.
 *  - VAT is treated as just another charge (per business decision).
 *  - `total_price_wo_vat` = FOB LKR + freight + insurance + cid + pal + cess
 *      + sscl + duty + other1..3 + banking + clearance + slpa + demurrage
 *  - `total_price_with_vat` = total_price_wo_vat + vat
 *  - `unit_cost_*` = total_price_* / qty.
 */
class Costing
{
    public static function compute(array $payload): array
    {
        $bankingRate = (float) ($payload['banking_rate'] ?? 0);
        $lines = $payload['lines'] ?? [];

        // FOB totals
        $itemsTotalUsd = 0.0;
        $itemsTotalLkr = 0.0;
        $perLineFobLkr = [];
        foreach ($lines as $i => $l) {
            $qty = (float) ($l['qty'] ?? 0);
            $unit = (float) ($l['cost'] ?? 0);
            $fobUsd = $qty * $unit;
            $fobLkr = round($fobUsd * $bankingRate, 2);
            $itemsTotalUsd += $fobUsd;
            $itemsTotalLkr += $fobLkr;
            $perLineFobLkr[$i] = $fobLkr;
        }

        // Sum of each shipment-level charge (LKR)
        $freightLkr = self::chargeLkr($payload['freight'] ?? null, $bankingRate);
        $insuranceLkr = self::chargeLkr($payload['insurance'] ?? null, $bankingRate);
        $bankingChargeLkr = self::chargeLkr($payload['banking'] ?? null, $bankingRate);
        $clearanceLkr = self::chargeLkr($payload['clearance'] ?? null, $bankingRate);
        $slpaLkr = self::chargeLkr($payload['slpa'] ?? null, $bankingRate);
        $demurrageLkr = self::chargeLkr($payload['demurrage'] ?? null, $bankingRate);

        $cid = (float) ($payload['cid_amount'] ?? 0);
        $pal = (float) ($payload['pal_amount'] ?? 0);
        $duty = (float) ($payload['duty_amount'] ?? 0);
        $cess = (float) ($payload['cess_amount'] ?? 0);
        $vat = (float) ($payload['vat_amount'] ?? 0);
        $sscl = (float) ($payload['sscl_amount'] ?? 0);
        $other1 = (float) ($payload['other1_amount'] ?? 0);
        $other2 = (float) ($payload['other2_amount'] ?? 0);
        $other3 = (float) ($payload['other3_amount'] ?? 0);

        $chargesTotalLkr = $freightLkr + $insuranceLkr + $bankingChargeLkr + $clearanceLkr
            + $slpaLkr + $demurrageLkr
            + $cid + $pal + $duty + $cess + $vat + $sscl
            + $other1 + $other2 + $other3;

        $computedLines = [];
        foreach ($lines as $i => $l) {
            $qty = (float) ($l['qty'] ?? 0);
            $unit = (float) ($l['cost'] ?? 0);
            $fobLkr = $perLineFobLkr[$i];
            $share = $itemsTotalLkr > 0 ? $fobLkr / $itemsTotalLkr : (count($lines) > 0 ? 1 / count($lines) : 0);

            $allocFreight = round($freightLkr * $share, 2);
            $allocIns = round($insuranceLkr * $share, 2);
            $allocBanking = round($bankingChargeLkr * $share, 2);
            $allocClearance = round($clearanceLkr * $share, 2);
            $allocSlpa = round($slpaLkr * $share, 2);
            $allocDem = round($demurrageLkr * $share, 2);

            $allocCid = round($cid * $share, 2);
            $allocPal = round($pal * $share, 2);
            $allocDuty = round($duty * $share, 2);
            $allocCess = round($cess * $share, 2);
            $allocVat = round($vat * $share, 2);
            $allocSscl = round($sscl * $share, 2);
            $allocOther1 = round($other1 * $share, 2);
            $allocOther2 = round($other2 * $share, 2);
            $allocOther3 = round($other3 * $share, 2);

            $totalWoVat = $fobLkr + $allocFreight + $allocIns
                + $allocCid + $allocPal + $allocCess + $allocSscl + $allocDuty
                + $allocOther1 + $allocOther2 + $allocOther3
                + $allocBanking + $allocClearance + $allocSlpa + $allocDem;
            $totalWithVat = $totalWoVat + $allocVat;

            $unitWoVat = $qty > 0 ? round($totalWoVat / $qty, 4) : 0;
            $unitWithVat = $qty > 0 ? round($totalWithVat / $qty, 4) : 0;

            $computedLines[] = [
                'code' => $l['code'] ?? null,
                'hs_code' => $l['hs_code'] ?? null,
                'item' => $l['item'] ?? '',
                'purchase_order_line_id' => $l['purchase_order_line_id'] ?? null,
                'qty' => $qty,
                'cost' => $unit,
                'total' => round($qty * $unit, 2),
                'fob_lkr' => $fobLkr,
                'freight_lkr' => $allocFreight,
                'insurance_lkr' => $allocIns,
                'cid' => $allocCid,
                'pal' => $allocPal,
                'cess' => $allocCess,
                'vat' => $allocVat,
                'sscl' => $allocSscl,
                'duty' => $allocDuty,
                'other1' => $allocOther1,
                'other2' => $allocOther2,
                'other3' => $allocOther3,
                'banking_alloc' => $allocBanking,
                'clearance_alloc' => $allocClearance,
                'slpa_alloc' => $allocSlpa,
                'demurrage_alloc' => $allocDem,
                'total_price_wo_vat' => round($totalWoVat, 2),
                'total_price_with_vat' => round($totalWithVat, 2),
                'unit_cost_wo_vat' => $unitWoVat,
                'unit_cost_with_vat' => $unitWithVat,
                'selling_price_wo_vat' => (float) ($l['selling_price_wo_vat'] ?? 0),
                'selling_price_with_vat' => (float) ($l['selling_price_with_vat'] ?? 0),
                'landed_cost' => $unitWithVat,
                'landed_total' => round($totalWithVat, 2),
            ];
        }

        return [
            'items_total_usd' => round($itemsTotalUsd, 2),
            'items_total_lkr' => round($itemsTotalLkr, 2),
            'charges_total_lkr' => round($chargesTotalLkr, 2),
            'landed_total' => round($itemsTotalLkr + $chargesTotalLkr, 2),
            'freight_lkr' => $freightLkr,
            'insurance_lkr' => $insuranceLkr,
            'banking_lkr' => $bankingChargeLkr,
            'clearance_lkr' => $clearanceLkr,
            'slpa_lkr' => $slpaLkr,
            'demurrage_lkr' => $demurrageLkr,
            'lines' => $computedLines,
        ];
    }

    /**
     * A complex charge can supply LKR directly or USD that converts via the banking rate.
     */
    private static function chargeLkr($entry, float $bankingRate): float
    {
        if (! is_array($entry)) {
            return 0.0;
        }
        $lkr = (float) ($entry['amount_lkr'] ?? 0);
        if ($lkr > 0) {
            return $lkr;
        }
        $usd = (float) ($entry['amount_usd'] ?? 0);

        return round($usd * $bankingRate, 2);
    }
}
