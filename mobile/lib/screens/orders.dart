import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => OrdersScreenState();
}

const _statuses = ['pending', 'dispatched', 'invoiced', 'cancelled'];

Color orderColor(String s) => switch (s) {
      'invoiced' => AppColors.ok,
      'dispatched' => AppColors.warn,
      'pending' => AppColors.brandBright,
      _ => AppColors.danger,
    };

String orderLabel(String s) =>
    s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

class OrdersScreenState extends State<OrdersScreen> {
  List<Map> _orders = [];
  bool _loading = true;
  String? _error;
  String? _filter;
  final Set<int> _open = {};

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    setState(() {
      _loading = _orders.isEmpty;
      _error = null;
    });
    try {
      final res = await Api.get('orders');
      if (!mounted) return;
      setState(() {
        _orders = (res as List).cast<Map>();
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
        _error = 'Could not load orders.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _orders.isEmpty) {
      return EmptyState(
          icon: Icons.cloud_off_rounded,
          title: 'Could not load orders',
          message: _error,
          onRetry: reload);
    }
    final counts = <String, int>{};
    for (final o in _orders) {
      final s = '${o['status'] ?? 'pending'}';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    final shown = _filter == null
        ? _orders
        : _orders.where((o) => '${o['status']}' == _filter).toList();

    return Column(
      children: [
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _chip('All', _orders.length, null, AppColors.brandBright),
              for (final s in _statuses)
                if ((counts[s] ?? 0) > 0 || s != 'cancelled')
                  _chip(orderLabel(s), counts[s] ?? 0, s, orderColor(s)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: RefreshIndicator(
            onRefresh: reload,
            child: shown.isEmpty
                ? ListView(children: const [
                    SizedBox(height: 60),
                    EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'No orders here',
                      message: 'Tap the + button to place a new order.',
                    ),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                    itemCount: shown.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _card(shown[i]),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _chip(String label, int count, String? value, Color color) {
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

  Widget _card(Map o) {
    final id = asNum(o['id']).toInt();
    final open = _open.contains(id);
    final lines = ((o['lines'] as List?) ?? const []).cast<Map>();
    final status = '${o['status'] ?? 'pending'}';
    final color = orderColor(status);
    final disc = asNum(o['discount_pct']);
    final discStatus = '${o['discount_status'] ?? ''}';
    final step = switch (status) {
      'pending' => 0,
      'dispatched' => 1,
      'invoiced' => 2,
      _ => -1,
    };

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => setState(() => open ? _open.remove(id) : _open.add(id)),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
                color: open ? AppColors.line : AppColors.lineSoft),
          ),
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
                        Text('${o['customer']}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: AppColors.ink)),
                        const SizedBox(height: 4),
                        Text(
                            '${o['code']} · ${fmtDate(o['date'])} · ${lines.isNotEmpty ? lines.length : asNum(o['items'])} item(s)',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.muted)),
                      ],
                    ),
                  ),
                  Pill(orderLabel(status), color),
                ],
              ),
              if (step >= 0) ...[
                const SizedBox(height: 14),
                _Progress(step: step),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  if (disc > 0)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Pill(
                          '${disc.toStringAsFixed(disc % 1 == 0 ? 0 : 1)}% disc · ${discStatus.isEmpty ? 'pending' : discStatus}',
                          discStatus == 'approved'
                              ? AppColors.ok
                              : discStatus == 'rejected'
                                  ? AppColors.danger
                                  : AppColors.warn,
                          dot: false),
                    ),
                  const Spacer(),
                  Text(money(asNum(o['total'])),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: AppColors.ink)),
                  const SizedBox(width: 4),
                  Icon(
                      open
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: AppColors.muted),
                ],
              ),
              AnimatedCrossFade(
                duration: const Duration(milliseconds: 200),
                crossFadeState:
                    open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                firstChild: const SizedBox(width: double.infinity),
                secondChild: _details(o, lines),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _details(Map o, List<Map> lines) {
    final refs = <String>[
      if ('${o['dispatch_no'] ?? ''}'.isNotEmpty)
        'Dispatch ${o['dispatch_no']}',
      if ('${o['invoice_code'] ?? ''}'.isNotEmpty) 'Invoice ${o['invoice_code']}',
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final l in lines)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  Expanded(
                    child: Text('${l['name']}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.ink2)),
                  ),
                  Text(
                      '${asNum(l['qty']).toInt()} × ${moneyK(asNum(l['rate']))}',
                      style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.muted,
                          fontWeight: FontWeight.w600)),
                ]),
              ),
            if (refs.isNotEmpty) ...[
              const Divider(height: 18),
              Text(refs.join('  ·  '),
                  style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.brandBright,
                      fontWeight: FontWeight.w600)),
            ],
          ],
        ),
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  final int step;
  const _Progress({required this.step});

  @override
  Widget build(BuildContext context) {
    const labels = ['Placed', 'Dispatched', 'Invoiced'];
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= step ? orderColor(['pending', 'dispatched', 'invoiced'][step]) : AppColors.well,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 6),
                Text(labels[i],
                    style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: i == step ? FontWeight.w700 : FontWeight.w500,
                        color: i <= step ? AppColors.ink2 : AppColors.faint)),
              ],
            ),
          ),
          if (i < 2) const SizedBox(width: 6),
        ],
      ],
    );
  }
}
