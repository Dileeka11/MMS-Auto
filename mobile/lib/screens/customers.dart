import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

/// Customers visible to the rep — their own first — with credit position.
class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _search = TextEditingController();
  List<Map> _all = [];
  bool _loading = true;
  bool _mineOnly = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _all.isEmpty;
      _error = null;
    });
    try {
      final res = await Api.get('customers');
      if (!mounted) return;
      setState(() {
        _all = (res as List).cast<Map>();
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load customers.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = '${Api.rep?['name'] ?? ''}';
    final q = _search.text.trim().toLowerCase();
    final shown = _all.where((c) {
      if (_mineOnly && '${c['rep']}' != me) return false;
      if (q.isEmpty) return true;
      return '${c['name']} ${c['code']} ${c['city']} ${c['contact']}'
          .toLowerCase()
          .contains(q);
    }).toList();
    final mine = _all.where((c) => '${c['rep']}' == me).length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(color: AppColors.ink),
            decoration: const InputDecoration(
              hintText: 'Search customer, city or phone…',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            _toggle('All  ${_all.length}', !_mineOnly,
                () => setState(() => _mineOnly = false)),
            const SizedBox(width: 8),
            _toggle('My customers  $mine', _mineOnly,
                () => setState(() => _mineOnly = true)),
          ]),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? EmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: 'Could not load customers',
                      message: _error,
                      onRetry: _load)
                  : shown.isEmpty
                      ? const EmptyState(
                          icon: Icons.storefront_outlined,
                          title: 'No customers found')
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                            itemCount: shown.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 10),
                            itemBuilder: (_, i) =>
                                CustomerCard(customer: shown[i], mine: '${shown[i]['rep']}' == me),
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _toggle(String label, bool sel, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: sel ? AppColors.brandDim : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: sel
                  ? AppColors.brand.withValues(alpha: 0.6)
                  : AppColors.line),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: sel ? AppColors.brandBright : AppColors.ink2)),
      ),
    );
  }
}

/// Customer row with a credit-usage bar. Also used by the order customer picker.
class CustomerCard extends StatelessWidget {
  final Map customer;
  final bool mine;
  final VoidCallback? onTap;
  final bool selected;
  const CustomerCard(
      {super.key,
      required this.customer,
      this.mine = false,
      this.onTap,
      this.selected = false});

  @override
  Widget build(BuildContext context) {
    final c = customer;
    final limit = asNum(c['limit']).toDouble();
    final out = asNum(c['outstanding']).toDouble();
    final used = limit > 0 ? (out / limit).clamp(0.0, 1.0) : 0.0;
    final risk = '${c['status']}' == 'risk' || (limit > 0 && out >= limit);
    final barColor = used >= 0.9
        ? AppColors.danger
        : used >= 0.7
            ? AppColors.warn
            : AppColors.ok;
    final name = '${c['name']}';
    final initials = name
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0].toUpperCase())
        .join();
    final sub = [
      if ('${c['city'] ?? ''}'.isNotEmpty) '${c['city']}',
      if ('${c['contact'] ?? ''}'.isNotEmpty) '${c['contact']}',
    ].join(' · ');

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
            border: Border.all(
                color: selected ? AppColors.brand : AppColors.lineSoft,
                width: selected ? 1.6 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.brandDim,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Text(initials.isEmpty ? '?' : initials,
                      style: const TextStyle(
                          color: AppColors.brandBright,
                          fontWeight: FontWeight.w800,
                          fontSize: 14)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14.5,
                              color: AppColors.ink)),
                      if (sub.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(sub,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.muted)),
                      ],
                    ],
                  ),
                ),
                if (risk)
                  const Pill('Credit risk', AppColors.danger)
                else if (mine)
                  const Pill('Mine', AppColors.brandBright, dot: false),
                if (selected) ...[
                  const SizedBox(width: 6),
                  const Icon(Icons.check_circle_rounded,
                      color: AppColors.brand, size: 22),
                ],
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Text('Outstanding ',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                Text(money(out),
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: out > 0 ? AppColors.ink : AppColors.muted)),
                const Spacer(),
                Text(limit > 0 ? 'Limit ${moneyK(limit)}' : 'No credit limit',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              ]),
              if (limit > 0) ...[
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: used,
                    minHeight: 5,
                    backgroundColor: AppColors.well,
                    valueColor: AlwaysStoppedAnimation(barColor),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
