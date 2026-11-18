import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'dashboard.dart';
import 'stock.dart';
import 'orders.dart';
import 'customers.dart';
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
    const CustomersScreen(),
  ];

  static const _titles = ['', 'Live Stock', 'My Orders', 'Customers'];
  static const _subs = [
    '',
    'Available = on hand − reserved',
    'Pending → dispatched → invoiced',
    'Credit limits & outstanding',
  ];

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to sign in again to place orders.',
            style: TextStyle(color: AppColors.muted)),
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
      if (!mounted) return;
      setState(() => _tab = 2);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Row(children: [
          Icon(Icons.check_circle_rounded, color: AppColors.ok, size: 18),
          SizedBox(width: 10),
          Text('Order sent to head office for dispatch'),
        ]),
      ));
    }
  }

  Widget _header() {
    final rep = Api.rep ?? {};
    final name = '${rep['name'] ?? 'Rep'}';
    final first = name.split(' ').where((w) => w.length > 1).firstOrNull ?? name;
    final isHome = _tab == 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isHome ? _greeting : _subs[_tab],
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.muted)),
                const SizedBox(height: 2),
                Text(isHome ? first : _titles[_tab],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                        color: AppColors.ink)),
              ],
            ),
          ),
          PopupMenuButton<String>(
            offset: const Offset(0, 52),
            onSelected: (v) {
              if (v == 'logout') _logout();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, color: AppColors.ink)),
                    Text('${rep['email'] ?? ''}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                    if ('${rep['zone'] ?? ''}'.isNotEmpty ||
                        '${rep['branch'] ?? ''}'.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                          [rep['zone'], rep['branch']]
                              .where((v) => v != null && '$v'.isNotEmpty)
                              .join(' · '),
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.ink2)),
                    ],
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(children: [
                  Icon(Icons.logout_rounded, size: 18, color: AppColors.danger),
                  SizedBox(width: 10),
                  Text('Log out', style: TextStyle(color: AppColors.danger)),
                ]),
              ),
            ],
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.line, width: 1.5),
              ),
              child: Avatar('${rep['avatar'] ?? 'R'}', size: 40),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(),
            Expanded(child: IndexedStack(index: _tab, children: _pages)),
          ],
        ),
      ),
      bottomNavigationBar: _BottomBar(
        index: _tab,
        onTap: (i) => setState(() => _tab = i),
        onNewOrder: _newOrder,
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  final VoidCallback onNewOrder;
  const _BottomBar(
      {required this.index, required this.onTap, required this.onNewOrder});

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottom > 0 ? bottom : 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.bg.withValues(alpha: 0), AppColors.bg],
          stops: const [0, 0.35],
        ),
      ),
      child: Container(
        height: 68,
        decoration: BoxDecoration(
          color: AppColors.raised,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.line),
          boxShadow: AppShadows.soft,
        ),
        child: Row(
          children: [
            _item(0, Icons.space_dashboard_outlined, Icons.space_dashboard_rounded, 'Home'),
            _item(1, Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'Stock'),
            Expanded(
              child: Center(
                child: GestureDetector(
                  onTap: onNewOrder,
                  child: Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppColors.brandGradient,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: AppShadows.glow,
                    ),
                    child: const Icon(Icons.add_rounded,
                        color: Colors.white, size: 30),
                  ),
                ),
              ),
            ),
            _item(2, Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'Orders'),
            _item(3, Icons.storefront_outlined, Icons.storefront_rounded, 'Clients'),
          ],
        ),
      ),
    );
  }

  Widget _item(int i, IconData icon, IconData active, String label) {
    final sel = index == i;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => onTap(i),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: sel ? AppColors.brandDim : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(sel ? active : icon,
                  size: 22,
                  color: sel ? AppColors.brandBright : AppColors.muted),
            ),
            const SizedBox(height: 3),
            Text(label,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                    color: sel ? AppColors.ink : AppColors.muted)),
          ],
        ),
      ),
    );
  }
}
