import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../api.dart';
import '../theme.dart';
import 'customers.dart';
import 'stock.dart';

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
  Map? _customer;
  final List<OrderLine> _lines = [];
  final _discount = TextEditingController();
  bool _loadingCustomers = true;
  bool _submitting = false;
  String _stage = '';

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  @override
  void dispose() {
    _discount.dispose();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    try {
      final res = await Api.get('customers');
      // Orders are keyed by customer name — keep one row per name.
      final seen = <String>{};
      final unique = <Map>[];
      for (final c in (res as List).cast<Map>()) {
        if (seen.add('${c['name']}')) unique.add(c);
      }
      if (!mounted) return;
      setState(() {
        _customers = unique;
        _loadingCustomers = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingCustomers = false);
      _snack('Could not load customers. Pull to retry.');
    }
  }

  double get _subTotal => _lines.fold(0, (s, l) => s + l.total);
  double get _discPct =>
      (double.tryParse(_discount.text.trim()) ?? 0).clamp(0, 100).toDouble();
  double get _netTotal => _subTotal * (1 - _discPct / 100);

  /// True when this order would push the customer past their credit limit.
  bool get _overCredit {
    final c = _customer;
    if (c == null) return false;
    final limit = asNum(c['limit']).toDouble();
    if (limit <= 0) return false;
    return asNum(c['outstanding']).toDouble() + _netTotal > limit;
  }

  bool get _overStock => _lines.any((l) => l.qty > l.available);

  Future<void> _pickCustomer() async {
    if (_loadingCustomers) return;
    final picked = await showModalBottomSheet<Map>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CustomerPickerSheet(
          customers: _customers, selected: '${_customer?['name'] ?? ''}'),
    );
    if (picked != null) setState(() => _customer = picked);
  }

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
    setState(() {
      if (existing >= 0) {
        _lines[existing].qty += 1;
      } else {
        _lines.add(OrderLine(
          code: code,
          name: '${item['name']}',
          unit: '${item['unit'] ?? ''}',
          price: asNum(item['price']).toDouble(),
          available: availableOf(item),
        ));
      }
    });
  }

  Future<({double? lat, double? lng})> _location() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return (lat: null, lng: null);
      }
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) {
        p = await Geolocator.requestPermission();
      }
      if (p == LocationPermission.whileInUse || p == LocationPermission.always) {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 10)),
        );
        return (lat: pos.latitude, lng: pos.longitude);
      }
    } catch (e) {
      debugPrint('Location error: $e');
    }
    return (lat: null, lng: null);
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
    if (_lines.any((l) => l.rate <= 0)) {
      _snack('Every item needs a rate above zero.');
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() {
      _submitting = true;
      _stage = 'Tagging location…';
    });

    final loc = await _location();
    if (!mounted) return;
    setState(() => _stage = 'Sending order…');

    try {
      await Api.post('orders', {
        'customer': '${_customer!['name']}',
        'lat': loc.lat,
        'lng': loc.lng,
        if (_discPct > 0) 'discount_pct': _discPct,
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
      _snack('Could not submit the order. Check your connection.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('New sales order'),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                const Eyebrow('1 · Customer'),
                const SizedBox(height: 10),
                _customerField(),
                if (_overCredit) ...[
                  const SizedBox(height: 10),
                  _banner(Icons.warning_amber_rounded, AppColors.warn,
                      'This order takes ${_customer!['name']} over their credit limit. Head office may hold dispatch.'),
                ],
                const SizedBox(height: 24),
                Eyebrow('2 · Items',
                    trailing: _lines.isEmpty
                        ? null
                        : Text('${_lines.length} line(s)',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.muted))),
                const SizedBox(height: 10),
                ..._lines.asMap().entries.map((e) => _lineCard(e.key, e.value)),
                _addItemButton(),
                const SizedBox(height: 24),
                const Eyebrow('3 · Discount (optional)'),
                const SizedBox(height: 10),
                TextField(
                  controller: _discount,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d{0,3}(\.\d{0,2})?')),
                  ],
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(color: AppColors.ink),
                  decoration: const InputDecoration(
                    hintText: '0',
                    prefixIcon: Icon(Icons.percent_rounded),
                    suffixText: '%',
                  ),
                ),
                if (_discPct > 0) ...[
                  const SizedBox(height: 8),
                  const Text(
                      'Discounts are sent to head office for approval before invoicing.',
                      style: TextStyle(fontSize: 12, color: AppColors.muted)),
                ],
              ],
            ),
          ),
          _bottomBar(),
        ],
      ),
    );
  }

  Widget _banner(IconData icon, Color color, String text) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 10),
        Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 12.5, color: AppColors.ink2))),
      ]),
    );
  }

  Widget _customerField() {
    if (_loadingCustomers) {
      return Container(
        height: 64,
        decoration: cardDecoration(),
        alignment: Alignment.center,
        child: const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.4)),
      );
    }
    if (_customer != null) {
      return CustomerCard(customer: _customer!, onTap: _pickCustomer);
    }
    return _dashedButton(
      icon: Icons.person_search_rounded,
      label: 'Select customer',
      onTap: _customers.isEmpty ? _loadCustomers : _pickCustomer,
    );
  }

  Widget _addItemButton() => _dashedButton(
        icon: Icons.add_rounded,
        label: _lines.isEmpty ? 'Add item from live stock' : 'Add another item',
        onTap: _pickItem,
      );

  Widget _dashedButton(
      {required IconData icon,
      required String label,
      required VoidCallback onTap}) {
    return Material(
      color: AppColors.brandDim,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          height: 60,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.brand.withValues(alpha: 0.45)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: AppColors.brandBright, size: 22),
              const SizedBox(width: 8),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.brandBright,
                      fontWeight: FontWeight.w700,
                      fontSize: 14.5)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _lineCard(int i, OrderLine l) {
    final over = l.qty > l.available;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 14),
      decoration: cardDecoration(
          border: over ? AppColors.danger.withValues(alpha: 0.6) : null),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: AppColors.ink)),
                    const SizedBox(height: 3),
                    Text('${l.code} · ${l.available} ${l.unit} available',
                        style: TextStyle(
                            fontSize: 12,
                            color: over ? AppColors.danger : AppColors.muted)),
                  ],
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.delete_outline_rounded,
                    color: AppColors.muted, size: 20),
                onPressed: () => setState(() => _lines.removeAt(i)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(
              children: [
                _QtyStepper(
                  qty: l.qty,
                  onChanged: (v) => setState(() => l.qty = v),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    initialValue: l.rate.toStringAsFixed(0),
                    keyboardType: TextInputType.number,
                    style: const TextStyle(
                        color: AppColors.ink, fontWeight: FontWeight.w600),
                    decoration: const InputDecoration(
                      isDense: true,
                      prefixText: 'Rs ',
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    onChanged: (v) =>
                        setState(() => l.rate = double.tryParse(v) ?? 0),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 72,
                  child: Text(moneyK(l.total),
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                          color: AppColors.ink)),
                ),
              ],
            ),
          ),
          if (over)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Quantity is more than available stock',
                  style: TextStyle(color: AppColors.danger, fontSize: 12)),
            ),
        ],
      ),
    );
  }

  Widget _bottomBar() {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 14, 16, 14 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_discPct > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Text('Subtotal ${money(_subTotal)}',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                const Spacer(),
                Text('− ${_discPct.toStringAsFixed(_discPct % 1 == 0 ? 0 : 1)}% (pending approval)',
                    style: const TextStyle(fontSize: 12, color: AppColors.warn)),
              ]),
            ),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Order total',
                        style: TextStyle(color: AppColors.muted, fontSize: 12)),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(money(_netTotal),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 22,
                              letterSpacing: -0.4,
                              color: AppColors.ink)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                height: 54,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    backgroundColor:
                        _overStock ? AppColors.warn : AppColors.brand,
                  ),
                  child: _submitting
                      ? Row(mainAxisSize: MainAxisSize.min, children: [
                          const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.2, color: Colors.white)),
                          const SizedBox(width: 10),
                          Text(_stage, style: const TextStyle(fontSize: 13)),
                        ])
                      : const Row(mainAxisSize: MainAxisSize.min, children: [
                          Text('Place order'),
                          SizedBox(width: 8),
                          Icon(Icons.send_rounded, size: 18),
                        ]),
                ),
              ),
            ],
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
    Widget btn(IconData icon, VoidCallback? onTap) => InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: SizedBox(
            width: 36,
            height: 40,
            child: Icon(icon,
                size: 18,
                color: onTap == null ? AppColors.faint : AppColors.ink),
          ),
        );
    return Container(
      decoration: BoxDecoration(
        color: AppColors.raised,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          btn(Icons.remove_rounded, qty > 1 ? () => onChanged(qty - 1) : null),
          SizedBox(
            width: 30,
            child: Text('$qty',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, color: AppColors.ink)),
          ),
          btn(Icons.add_rounded, () => onChanged(qty + 1)),
        ],
      ),
    );
  }
}

class _SheetFrame extends StatelessWidget {
  final String title;
  final Widget Function(ScrollController) builder;
  final Widget? header;
  const _SheetFrame({required this.title, required this.builder, this.header});

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scroll) => Container(
        decoration: const BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.line, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: Row(children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink)),
              ]),
            ),
            ?header,
            Expanded(child: builder(scroll)),
          ],
        ),
      ),
    );
  }
}

class _CustomerPickerSheet extends StatefulWidget {
  final List<Map> customers;
  final String selected;
  const _CustomerPickerSheet({required this.customers, required this.selected});

  @override
  State<_CustomerPickerSheet> createState() => _CustomerPickerSheetState();
}

class _CustomerPickerSheetState extends State<_CustomerPickerSheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final me = '${Api.rep?['name'] ?? ''}';
    final q = _q.toLowerCase();
    final shown = widget.customers
        .where((c) => q.isEmpty ||
            '${c['name']} ${c['code']} ${c['city']}'.toLowerCase().contains(q))
        .toList();
    return _SheetFrame(
      title: 'Select customer',
      header: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
        child: TextField(
          autofocus: widget.customers.length > 8,
          onChanged: (v) => setState(() => _q = v.trim()),
          style: const TextStyle(color: AppColors.ink),
          decoration: const InputDecoration(
            hintText: 'Search name, code or city…',
            prefixIcon: Icon(Icons.search_rounded),
          ),
        ),
      ),
      builder: (scroll) => shown.isEmpty
          ? const EmptyState(
              icon: Icons.storefront_outlined, title: 'No matching customers')
          : ListView.separated(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              itemCount: shown.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) => CustomerCard(
                customer: shown[i],
                mine: '${shown[i]['rep']}' == me,
                selected: '${shown[i]['name']}' == widget.selected,
                onTap: () => Navigator.pop(context, shown[i]),
              ),
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
    super.dispose();
  }

  Future<void> _load([String q = '']) async {
    setState(() {
      _loading = _items.isEmpty;
      _searching = true;
      _error = null;
    });
    try {
      final res = await Api.get(
          'stock${q.isEmpty ? '' : '?q=${Uri.encodeQueryComponent(q)}'}');
      // Only sellable stock: on hand − reserved must be above zero.
      final inStock =
          (res as List).cast<Map>().where((it) => availableOf(it) > 0).toList();
      if (!mounted) return;
      setState(() {
        _items = inStock;
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
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _load(v.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Add item',
      header: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: TextField(
            autofocus: true,
            onChanged: _onSearch,
            style: const TextStyle(color: AppColors.ink),
            decoration: const InputDecoration(
              hintText: 'Search part, code or brand…',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        SizedBox(
          height: 2,
          child: _searching && !_loading
              ? const LinearProgressIndicator(minHeight: 2)
              : null,
        ),
      ]),
      builder: (scroll) => _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? EmptyState(
                  icon: Icons.cloud_off_rounded,
                  title: _error!,
                  onRetry: () => _load())
              : _items.isEmpty
                  ? const EmptyState(
                      icon: Icons.inventory_2_outlined,
                      title: 'No items in stock',
                      message: 'Only items with available stock are listed.')
                  : ListView.separated(
                      controller: scroll,
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: _items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, i) => StockCard(
                        item: _items[i],
                        onTap: () => Navigator.pop(context, _items[i]),
                        trailing: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('${availableOf(_items[i])}',
                                style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    color: levelColor(levelOf(_items[i])))),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                  color: AppColors.brandDim,
                                  borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.add_rounded,
                                  size: 18, color: AppColors.brandBright),
                            ),
                          ],
                        ),
                      ),
                    ),
    );
  }
}
