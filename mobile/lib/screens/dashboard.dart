import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../api.dart';
import '../theme.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => DashboardScreenState();
}

class DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    setState(() {
      _loading = _data == null;
      _error = null;
    });
    try {
      final res = await Api.get('dashboard');
      setState(() {
        _data = Map<String, dynamic>.from(res as Map);
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Could not load dashboard.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorView(message: _error!, onRetry: reload);
    }
    final stats = Map<String, dynamic>.from(_data!['stats'] as Map);
    final trend = (_data!['monthly_trend'] as List).cast<Map>();
    final daily = (_data!['daily_sales'] as List).cast<Map>();
    final recent = (_data!['recent_orders'] as List).cast<Map>();

    return RefreshIndicator(
      onRefresh: reload,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _TargetCard(
            target: (stats['target'] as num).toDouble(),
            achieved: (stats['achieved'] as num).toDouble(),
            progress: (stats['progress'] as num).toDouble(),
          ),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
                child: _StatTile(
                    label: 'Sales Today',
                    value: moneyK(stats['sales_today'] as num),
                    icon: Icons.today,
                    color: AppColors.brand)),
            const SizedBox(width: 12),
            Expanded(
                child: _StatTile(
                    label: 'Orders',
                    value: '${stats['orders_count']}',
                    icon: Icons.receipt_long,
                    color: AppColors.ok)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
                child: _StatTile(
                    label: 'Outstanding',
                    value: moneyK(stats['outstanding'] as num),
                    icon: Icons.account_balance_wallet_outlined,
                    color: AppColors.warn)),
            const SizedBox(width: 12),
            Expanded(
                child: _StatTile(
                    label: 'Achieved',
                    value: moneyK(stats['achieved'] as num),
                    icon: Icons.trending_up,
                    color: AppColors.brand)),
          ]),
          const SizedBox(height: 18),
          _ChartCard(
            title: '6-Month Sales Trend',
            child: _LineChart(trend),
          ),
          const SizedBox(height: 14),
          _ChartCard(
            title: 'Last 7 Days',
            child: _BarChart(daily),
          ),
          const SizedBox(height: 14),
          _RecentOrders(recent),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

class _TargetCard extends StatelessWidget {
  final double target, achieved, progress;
  const _TargetCard(
      {required this.target, required this.achieved, required this.progress});

  @override
  Widget build(BuildContext context) {
    final onTrack = progress >= 100;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(22),
        boxShadow: AppShadows.lifted,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Monthly Target',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 13,
                      fontWeight: FontWeight.w500)),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(onTrack ? Icons.check_circle : Icons.trending_up,
                      size: 13, color: Colors.white),
                  const SizedBox(width: 4),
                  Text(onTrack ? 'Target met' : 'In progress',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ]),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(money(achieved),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5)),
          Text('of ${money(target)} target',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (progress / 100).clamp(0, 1),
              minHeight: 10,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              valueColor: const AlwaysStoppedAnimation(Colors.white),
            ),
          ),
          const SizedBox(height: 6),
          Text('${progress.toStringAsFixed(1)}% achieved',
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatTile(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 12),
          Text(value,
              style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: AppColors.ink)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _ChartCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: cardDecoration(radius: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink)),
          const SizedBox(height: 18),
          SizedBox(height: 170, child: child),
        ],
      ),
    );
  }
}

class _LineChart extends StatelessWidget {
  final List<Map> data;
  const _LineChart(this.data);

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (var i = 0; i < data.length; i++) {
      spots.add(FlSpot(i.toDouble(), (data[i]['value'] as num).toDouble()));
    }
    final maxY = spots.isEmpty
        ? 1.0
        : spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    return LineChart(
      LineChartData(
        minY: 0,
        maxY: maxY == 0 ? 1 : maxY * 1.25,
        gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                const FlLine(color: AppColors.line, strokeWidth: 1)),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, _) {
                final i = v.toInt();
                if (i < 0 || i >= data.length) return const SizedBox();
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('${data[i]['label']}',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.muted)),
                );
              },
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.28,
            gradient: const LinearGradient(
                colors: [AppColors.brand, AppColors.brandAlt]),
            barWidth: 3.5,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                radius: 3.5,
                color: Colors.white,
                strokeWidth: 2,
                strokeColor: AppColors.brand,
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.brand.withValues(alpha: 0.22),
                  AppColors.brand.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BarChart extends StatelessWidget {
  final List<Map> data;
  const _BarChart(this.data);

  @override
  Widget build(BuildContext context) {
    final maxY = data.isEmpty
        ? 1.0
        : data
            .map((d) => (d['value'] as num).toDouble())
            .reduce((a, b) => a > b ? a : b);
    return BarChart(
      BarChartData(
        maxY: maxY == 0 ? 1 : maxY * 1.25,
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, _) {
                final i = v.toInt();
                if (i < 0 || i >= data.length) return const SizedBox();
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('${data[i]['label']}',
                      style: const TextStyle(
                          fontSize: 10, color: AppColors.muted)),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < data.length; i++)
            BarChartGroupData(x: i, barRods: [
              BarChartRodData(
                toY: (data[i]['value'] as num).toDouble(),
                gradient: const LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [AppColors.brandDark, AppColors.brandAlt],
                ),
                width: 16,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(6)),
              ),
            ]),
        ],
      ),
    );
  }
}

class _RecentOrders extends StatelessWidget {
  final List<Map> orders;
  const _RecentOrders(this.orders);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: cardDecoration(radius: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('Recent Orders',
                style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink)),
          ),
          if (orders.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                  child: Text('No orders yet',
                      style: TextStyle(color: AppColors.muted))),
            )
          else
            ...orders.map((o) => ListTile(
                  dense: true,
                  title: Text('${o['customer']}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text('${o['code']} · ${fmtDate(o['date'])}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.muted)),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(moneyK(o['total'] as num),
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                      Text('${o['status']}',
                          style: TextStyle(
                              fontSize: 11,
                              color: o['status'] == 'Paid'
                                  ? AppColors.ok
                                  : AppColors.warn)),
                    ],
                  ),
                )),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              style: FilledButton.styleFrom(backgroundColor: AppColors.brand),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
