import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key});

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  List<Map> _items = [];
  bool _loading = true;
  bool _searching = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load([String q = '']) async {
    setState(() {
      // Full-screen spinner only on the very first load; later searches keep
      // the current list visible with a thin progress bar for a smoother feel.
      _loading = _items.isEmpty && _error == null;
      _searching = true;
      _error = null;
    });
    try {
      final res = await Api.get('stock${q.isEmpty ? '' : '?q=${Uri.encodeQueryComponent(q)}'}');
      setState(() {
        _items = (res as List).cast<Map>();
        _loading = false;
        _searching = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
        _searching = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Could not load stock.';
        _loading = false;
        _searching = false;
      });
    }
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _load(v.trim()));
  }

  Color _statusColor(Map it) {
    final qty = (it['qty'] as num?)?.toInt() ?? 0;
    final reorder = (it['reorder'] as num?)?.toInt() ?? 0;
    if (qty <= 0) return AppColors.danger;
    if (qty <= reorder) return AppColors.warn;
    return AppColors.ok;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _search,
            onChanged: _onSearch,
            decoration: InputDecoration(
              hintText: 'Search item, code or brand…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _search.clear();
                        _load();
                      },
                    ),
            ),
          ),
        ),
        SizedBox(
          height: 2,
          child: _searching && !_loading
              ? const LinearProgressIndicator(minHeight: 2)
              : null,
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(
                      child: Text(_error!,
                          style: const TextStyle(color: AppColors.muted)))
                  : _items.isEmpty
                      ? const Center(
                          child: Text('No items found',
                              style: TextStyle(color: AppColors.muted)))
                      : RefreshIndicator(
                          onRefresh: () => _load(_search.text.trim()),
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                            itemCount: _items.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (_, i) {
                              final it = _items[i];
                              final qty = (it['qty'] as num?)?.toInt() ?? 0;
                              final color = _statusColor(it);
                              return Container(
                                padding: const EdgeInsets.all(14),
                                decoration: cardDecoration(),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text('${it['name']}',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 14,
                                                  color: AppColors.ink)),
                                          const SizedBox(height: 3),
                                          Text(
                                              '${it['code']}${it['brand'] != null && '${it['brand']}'.isNotEmpty ? ' · ${it['brand']}' : ''}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color: AppColors.muted)),
                                          const SizedBox(height: 4),
                                          Text(money(it['price'] as num? ?? 0),
                                              style: const TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppColors.brand)),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: color.withValues(alpha: 0.12),
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: Text('$qty ${it['unit'] ?? ''}',
                                              style: TextStyle(
                                                  color: color,
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 13)),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                            qty <= 0
                                                ? 'Out of stock'
                                                : qty <=
                                                        ((it['reorder']
                                                                    as num?)
                                                                ?.toInt() ??
                                                            0)
                                                    ? 'Low'
                                                    : 'In stock',
                                            style: TextStyle(
                                                fontSize: 11, color: color)),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }
}
