import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => OrdersScreenState();
}

class OrdersScreenState extends State<OrdersScreen> {
  List<Map> _orders = [];
  bool _loading = true;
  String? _error;

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
      setState(() {
        _orders = (res as List).cast<Map>();
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Could not load orders.';
        _loading = false;
      });
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'invoiced':
      case 'Paid':
        return AppColors.ok;
      case 'dispatched':
      case 'Partial':
        return AppColors.warn;
      case 'pending':
        return AppColors.brand;
      default:
        return AppColors.danger;
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'pending':
        return 'Pending';
      case 'dispatched':
        return 'Dispatched';
      case 'invoiced':
        return 'Invoiced';
      case 'cancelled':
        return 'Cancelled';
      default:
        return s;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
          child: Text(_error!, style: const TextStyle(color: AppColors.muted)));
    }
    if (_orders.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long_outlined, size: 48, color: AppColors.muted),
            SizedBox(height: 10),
            Text('No orders yet.\nTap "New Order" to create one.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted)),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: reload,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
        itemCount: _orders.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final o = _orders[i];
          final lines = (o['lines'] as List?)?.length ?? o['items'] ?? 0;
          final status = '${o['status'] ?? 'pending'}';
          final color = _statusColor(status);
          return Container(
            padding: const EdgeInsets.all(16),
            decoration: cardDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('${o['customer']}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: AppColors.ink)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(_statusLabel(status),
                          style: TextStyle(
                              color: color,
                              fontSize: 11,
                              fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text('${o['code']} · ${fmtDate(o['date'])} · $lines item(s)',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.muted)),
                const Divider(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total',
                        style: TextStyle(color: AppColors.muted, fontSize: 13)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.print, size: 18, color: AppColors.brand),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Printing invoice...')),
                        );
                      },
                    ),
                    Text(money(o['total'] as num? ?? 0),
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
