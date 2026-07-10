import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'dashboard.dart';
import 'stock.dart';
import 'orders.dart';
import 'new_order.dart';
import 'login.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final _dashKey = GlobalKey<DashboardScreenState>();
  final _ordersKey = GlobalKey<OrdersScreenState>();

  late final List<Widget> _pages = [
    DashboardScreen(key: _dashKey),
    const StockScreen(),
    OrdersScreen(key: _ordersKey),
  ];

  static const _titles = ['Dashboard', 'Live Stock', 'My Orders'];

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to sign in again to continue.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await Api.logout();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  Future<void> _newOrder() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const NewOrderScreen()),
    );
    if (created == true) {
      _dashKey.currentState?.reload();
      _ordersKey.currentState?.reload();
      if (mounted) setState(() => _tab = 2);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rep = Api.rep ?? {};
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab],
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'logout') _logout();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  enabled: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${rep['name'] ?? 'Rep'}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.ink)),
                      Text('${rep['email'] ?? ''}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted)),
                    ],
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(
                  value: 'logout',
                  child: Row(children: [
                    Icon(Icons.logout, size: 18, color: AppColors.danger),
                    SizedBox(width: 10),
                    Text('Log out',
                        style: TextStyle(color: AppColors.danger)),
                  ]),
                ),
              ],
              child: Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: AppColors.brandGradient,
                  boxShadow: AppShadows.lifted,
                ),
                child: Text('${rep['avatar'] ?? 'R'}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14)),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: _pages),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        onPressed: _newOrder,
        icon: const Icon(Icons.add_shopping_cart),
        label: const Text('New Order'),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: 'Dashboard'),
          NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2),
              label: 'Stock'),
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'Orders'),
        ],
      ),
    );
  }
}
