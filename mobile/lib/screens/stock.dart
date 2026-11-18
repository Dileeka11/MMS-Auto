import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

/// Stock level of an item as the rep should see it: what can still be sold
/// (`available` = on hand − reserved by dispatch notes).
enum StockLevel { inStock, low, out }

int availableOf(Map it) =>
    asNum(it['available'] ?? it['qty']).toInt();

StockLevel levelOf(Map it) {
  final a = availableOf(it);
  final reorder = asNum(it['reorder']).toInt();
  if (a <= 0) return StockLevel.out;
  if (a <= reorder) return StockLevel.low;
  return StockLevel.inStock;
}

Color levelColor(StockLevel l) => switch (l) {
      StockLevel.out => AppColors.danger,
      StockLevel.low => AppColors.warn,
      StockLevel.inStock => AppColors.ok,
    };

String levelLabel(StockLevel l) => switch (l) {
      StockLevel.out => 'Out',
      StockLevel.low => 'Low',
      StockLevel.inStock => 'In stock',
    };

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
  StockLevel? _filter;

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
      _loading = _items.isEmpty && _error == null;
      _searching = true;
      _error = null;
    });
    try {
      final res = await Api.get(
          'stock${q.isEmpty ? '' : '?q=${Uri.encodeQueryComponent(q)}'}');
      if (!mounted) return;
      setState(() {
        _items = (res as List).cast<Map>();
        _loading = false;
        _searching = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
        _searching = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load stock.';
        _loading = false;
        _searching = false;
      });
    }
  }

  void _onSearch(String v) {
    setState(() {}); // refresh clear button
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _load(v.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final counts = {for (final l in StockLevel.values) l: 0};
    for (final it in _items) {
      counts[levelOf(it)] = counts[levelOf(it)]! + 1;
    }
    final shown = _filter == null
        ? _items
        : _items.where((it) => levelOf(it) == _filter).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: TextField(
            controller: _search,
            onChanged: _onSearch,
            style: const TextStyle(color: AppColors.ink),
            decoration: InputDecoration(
              hintText: 'Search part, code or brand…',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () {
                        _search.clear();
                        _load();
                      },
                    ),
            ),
          ),
        ),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _chip('All', _items.length, null, AppColors.brandBright),
              for (final l in StockLevel.values)
                _chip(levelLabel(l), counts[l]!, l, levelColor(l)),
            ],
          ),
        ),
        const SizedBox(height: 8),
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
                  ? EmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: 'Could not load stock',
                      message: _error,
                      onRetry: () => _load(_search.text.trim()))
                  : shown.isEmpty
                      ? const EmptyState(
                          icon: Icons.inventory_2_outlined,
                          title: 'No items found',
                          message: 'Try another part name or code.')
                      : RefreshIndicator(
                          onRefresh: () => _load(_search.text.trim()),
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 6, 16, 120),
                            itemCount: shown.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 10),
                            itemBuilder: (_, i) => StockCard(item: shown[i]),
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _chip(String label, int count, StockLevel? value, Color color) {
    final sel = _filter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => setState(() => _filter = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: sel ? color.withValues(alpha: 0.16) : AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
                color: sel ? color.withValues(alpha: 0.6) : AppColors.line),
          ),
          child: Text('$label  $count',
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: sel ? color : AppColors.ink2)),
        ),
      ),
    );
  }
}

/// One stock item row; also used inside the new-order item picker.
class StockCard extends StatelessWidget {
  final Map item;
  final VoidCallback? onTap;
  final Widget? trailing;
  const StockCard({super.key, required this.item, this.onTap, this.trailing});

  @override
  Widget build(BuildContext context) {
    final level = levelOf(item);
    final color = levelColor(level);
    final avail = availableOf(item);
    final reserved = asNum(item['reserved']).toInt();
    final unit = '${item['unit'] ?? ''}'.trim();
    final brand = '${item['brand'] ?? ''}'.trim();
    final rack = '${item['rack'] ?? ''}'.trim();
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.lineSoft),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.raised,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.settings_suggest_outlined,
                    color: AppColors.ink2, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${item['name']}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: level == StockLevel.out
                                ? AppColors.muted
                                : AppColors.ink)),
                    const SizedBox(height: 3),
                    Text(
                        [
                          '${item['code']}',
                          if (brand.isNotEmpty) brand,
                          if (rack.isNotEmpty) 'Rack $rack',
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                    const SizedBox(height: 6),
                    Text(money(asNum(item['price'])),
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.brandBright)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              trailing ??
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('$avail',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: color)),
                      Text(unit.isEmpty ? 'available' : '$unit avail.',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.muted)),
                      if (reserved > 0) ...[
                        const SizedBox(height: 4),
                        Text('$reserved reserved',
                            style: const TextStyle(
                                fontSize: 10.5, color: AppColors.warn)),
                      ],
                    ],
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
