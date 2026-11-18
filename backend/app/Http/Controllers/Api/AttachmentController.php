<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Supporting documents (BR copies, shop photos, supplier quotations, expense
 * bills). Files live on the private "local" disk — never under the public
 * storage symlink — and are streamed only to authenticated users.
 *
 * Upload first, then save the returned `path` on the record (br_doc,
 * shop_photo, quotation_doc, attachment).
 */
class AttachmentController extends Controller
{
    public const FOLDERS = ['customers', 'purchase-orders', 'expenses'];

    public function store(Request $request)
    {
        $data = $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:8192',
            'folder' => ['required', Rule::in(self::FOLDERS)],
        ]);

        $file = $request->file('file');
        $path = $file->store('attachments/' . $data['folder'], 'local');

        return response()->json([
            'path' => $path,
            'name' => $file->getClientOriginalName(),
        ], 201);
    }

    public function show(Request $request)
    {
        $path = (string) $request->query('path', '');
        if (! self::isValidPath($path) || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    /** A path produced by store() for one of the allowed folders (no traversal). */
    public static function isValidPath(?string $path, ?string $folder = null): bool
    {
        $folders = $folder ? [$folder] : self::FOLDERS;
        $re = '#^attachments/(' . implode('|', array_map('preg_quote', $folders)) . ')/[A-Za-z0-9]+\.[A-Za-z0-9]+\z#';

        return is_string($path) && preg_match($re, $path) === 1;
    }

    /** Validation rule for a record field holding an attachment path. */
    public static function rule(string $folder): \Closure
    {
        return function ($attribute, $value, $fail) use ($folder) {
            if ($value !== null && $value !== '' && ! self::isValidPath($value, $folder)) {
                $fail('Invalid attachment for ' . str_replace('_', ' ', $attribute) . '.');
            }
        };
    }
}
