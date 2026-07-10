import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class OrderLine {
  final String code;
  final String name;
  final String unit;
  final double price;
  final int available;
  int qty;
  double rate;
  OrderLine({
    required this.code,
    required this.name,
    required this.unit,
    required this.price,
    required this.available,
    this.qty = 1,
  }) : rate = price;

  double get total => qty * rate;
}

class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key});

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  List<Map> _customers = [];
  String? _customer;
  final List<OrderLine> _lines = [];
  bool _loadingCustomers = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  Future<void> _loadCustomers() async {
    try {
      final res = await Api.get('customers');
      // Guard against duplicate customer names — a repeated value crashes the
      // DropdownButton ("exactly one item with value" assertion).
      final seen = <String>{};
      final unique = <Map>[];
      for (final c in (res as List).cast<Map>()) {
        if (seen.add('${c['name']}')) unique.add(c);
      }
      setState(() {
        _customers = unique;
        _loadingCustomers = false;
      });
    } catch (_) {
      setState(() => _loadingCustomers = false);
    }
  }

  double get _grandTotal => _lines.fold(0, (s, l) => s + l.total);

  Future<void> _pickItem() async {
    final item = await showModalBottomSheet<Map>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ItemPickerSheet(),
    );
    if (item == null) return;
    final code = '${item['code']}';
    final existing = _lines.indexWhere((l) => l.code == code);
    if (existing >= 0) {
      setState(() => _lines[existing].qty += 1);
    } else {
      setState(() {
        _lines.add(OrderLine(
          code: code,
          name: '${item['name']}',
          unit: '${item['unit'] ?? ''}',
          price: (item['price'] as num?)?.toDouble() ?? 0,
          available: (item['qty'] as num?)?.toInt() ?? 0,
        ));
      });
    }
  }

  Future<void> _submit() async {
    if (_customer == null) {
      _snack('Select a customer first.');
      return;
    }
    if (_lines.isEmpty) {
      _snack('Add at least one item.');
      return;
    }
    setState(() => _submitting = true);
    try {
      await Api.post('orders', {
        'customer': _customer,
        'lines': _lines
            .map((l) => {
                  'code': l.code,
                  'name': l.name,
                  'qty': l.qty,
                  'rate': l.rate,
                  'method': 'FIFO',
                })
            .toList(),
      });
      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not submit order.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Sales Order',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Customer',
                    style: TextStyle(
                        fontWeight: FontWeight.w600, color: AppColors.ink)),
                const SizedBox(height: 8),
                _loadingCustomers
                    ? const LinearProgressIndicator()
                    : DropdownButtonFormField<String>(
                        initialValue: _customer,
                        isExpanded: true,
                        hint: const Text('Select customer'),
                        items: _customers
                            .map((c) => DropdownMenuItem(
                                  value: '${c['name']}',
                                  child: Text('${c['name']}',
                                      overflow: TextOverflow.ellipsis),
                                ))
                            .toList(),
                        onChanged: (v) => setState(() => _customer = v),
                      ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Items',
                        style: TextStyle(
                            fontWeight: FontWeight.w600, color: AppColors.ink)),
                    TextButton.icon(
                      onPressed: _pickItem,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add Item'),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                if (_lines.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    alignment: Alignment.center,
                    decoration: cardDecoration(),
                    child: const Text('No items added.\nCheck live stock & add items.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted)),
                  )
                else
                  ..._lines.asMap().entries.map((e) => _lineCard(e.key, e.value)),
              ],
            ),
          ),
          _bottomBar(),
        ],
      ),
    );
  }

  Widget _lineCard(int i, OrderLine l) {
    final over = l.qty > l.available;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: cardDecoration(border: over ? AppColors.danger : null),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14)),
                    Text('${l.code} · ${l.available} ${l.unit} in stock',
                        style: TextStyle(
                            fontSize: 12,
                            color: over ? AppColors.danger : AppColors.muted)),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline,
                    color: AppColors.danger, size: 20),
                onPressed: () => setState(() => _lines.removeAt(i)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _QtyStepper(
                qty: l.qty,
                onChanged: (v) => setState(() => l.qty = v),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  initialValue: l.rate.toStringAsFixed(0),
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Rate',
                    isDense: true,
                    prefixText: 'Rs ',
                  ),
                  onChanged: (v) =>
                      setState(() => l.rate = double.tryParse(v) ?? 0),
                ),
              ),
              const SizedBox(width: 12),
              Text(moneyK(l.total),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15)),
            ],
          ),
          if (over)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('⚠ Quantity exceeds available stock',
                  style: TextStyle(color: AppColors.danger, fontSize: 12)),
            ),
        ],
      ),
    );
  }

  Widget _bottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Total',
                  style: TextStyle(color: AppColors.muted, fontSize: 12)),
              Text(money(_grandTotal),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 22,
                      color: AppColors.ink)),
            ],
          ),
          const Spacer(),
          SizedBox(
            height: 50,
            child: FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.brand,
                padding: const EdgeInsets.symmetric(horizontal: 28),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: Colors.white))
                  : const Icon(Icons.check),
              label: const Text('Submit Order',
                  style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _QtyStepper extends StatelessWidget {
  final int qty;
  final ValueChanged<int> onChanged;
  const _QtyStepper({required this.qty, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.remove, size: 18),
            onPressed: qty > 1 ? () => onChanged(qty - 1) : null,
          ),
          SizedBox(
            width: 28,
            child: Text('$qty',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.add, size: 18),
            onPressed: () => onChanged(qty + 1),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet that searches live stock and returns the chosen item.
class _ItemPickerSheet extends StatefulWidget {
  const _ItemPickerSheet();

  @override
  State<_ItemPickerSheet> createState() => _ItemPickerSheetState();
}

class _ItemPickerSheetState extends State<_ItemPickerSheet> {
  final _search = TextEditingController();
  Timer? _debounce;
  List<Map> _items = [];
  bool _loading = true;
  bool _searching = false;

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
    // Show the full spinner only on first load; keep results visible while
    // typing so the sheet doesn't flicker on every search.
    setState(() {
      _loading = _items.isEmpty;
      _searching = true;
    });
    try {
      final res = await Api.get(
          'stock${q.isEmpty ? '' : '?q=${Uri.encodeQueryComponent(q)}'}');
      // Only show items that are actually in stock (qty > 0) — you can't sell
      // what you don't have.
      final inStock = (res as List)
          .cast<Map>()
          .where((it) => ((it['qty'] as num?)?.toInt() ?? 0) > 0)
          .toList();
      setState(() {
        _items = inStock;
        _loading = false;
        _searching = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _searching = false;
      });
    }
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _load(v.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scroll) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(2)),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  controller: _search,
                  autofocus: true,
                  onChanged: _onSearch,
                  decoration: const InputDecoration(
                    hintText: 'Search item to add…',
                    prefixIcon: Icon(Icons.search),
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
                    : _items.isEmpty
                        ? const Center(
                            child: Text('No items',
                                style: TextStyle(color: AppColors.muted)))
                        : ListView.separated(
                            controller: scroll,
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: _items.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (_, i) {
                              final it = _items[i];
                              final qty = (it['qty'] as num?)?.toInt() ?? 0;
                              final out = qty <= 0;
                              return Material(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(12),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(12),
                                  onTap: out
                                      ? null
                                      : () => Navigator.pop(context, it),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(12),
                                      border:
                                          Border.all(color: AppColors.line),
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text('${it['name']}',
                                                  style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      fontSize: 14,
                                                      color: out
                                                          ? AppColors.muted
                                                          : AppColors.ink)),
                                              const SizedBox(height: 2),
                                              Text(
                                                  '${it['code']} · ${money(it['price'] as num? ?? 0)}',
                                                  style: const TextStyle(
                                                      fontSize: 12,
                                                      color: AppColors.muted)),
                                            ],
                                          ),
                                        ),
                                        Text(
                                            out ? 'Out' : '$qty ${it['unit'] ?? ''}',
                                            style: TextStyle(
                                                color: out
                                                    ? AppColors.danger
                                                    : AppColors.ok,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13)),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        );
      },
    );
  }
}
