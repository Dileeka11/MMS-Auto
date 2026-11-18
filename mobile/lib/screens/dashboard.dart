import 'dart:math' as math;
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
      if (!mounted) return;
      setState(() {
        _data = Map<String, dynamic>.from(res as Map);
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
        _error = 'Could not load your dashboard.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _data == null) {
      return EmptyState(
          icon: Icons.cloud_off_rounded,
          title: 'Offline',
          message: _error,
          onRetry: reload);
    }
    final stats = Map<String, dynamic>.from(_data!['stats'] as Map);
    final trend = (_data!['monthly_trend'] as List).cast<Map>();
    final daily = (_data!['daily_sales'] as List).cast<Map>();
    final recent = (_data!['recent_orders'] as List).cast<Map>();
    final weekTotal = daily.fold<num>(0, (s, d) => s + asNum(d['value']));

    return RefreshIndicator(
      onRefresh: reload,
      color: AppColors.brand,
      backgroundColor: AppColors.raised,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          _TargetCard(
            target: asNum(stats['target']).toDouble(),
            achieved: asNum(stats['achieved']).toDouble(),
            progress: asNum(stats['progress']).toDouble(),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.55,
            children: [
              _StatTile(
                  label: 'Sales today',
                  value: moneyK(asNum(stats['sales_today'])),
                  icon: Icons.bolt_rounded,
                  color: AppColors.brandBright),
              _StatTile(
                  label: 'Open orders',
                  value: '${asNum(stats['open_orders']).toInt()}',
                  icon: Icons.local_shipping_outlined,
                  color: AppColors.warn),
              _StatTile(
                  label: 'Invoices',
                  value: '${asNum(stats['orders_count']).toInt()}',
                  icon: Icons.receipt_long_rounded,
                  color: AppColors.ok),
              _StatTile(
                  label: 'Outstanding',
                  value: moneyK(asNum(stats['outstanding'])),
                  icon: Icons.account_balance_wallet_outlined,
                  color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 12),
          _ChartCard(
            title: 'Sales trend',
            caption: 'Last 6 months',
            child: _LineChart(trend),
          ),
          const SizedBox(height: 12),
          _ChartCard(
            title: 'This week',
            caption: moneyK(weekTotal),
            child: _BarChart(daily),
          ),
          const SizedBox(height: 12),
          _RecentInvoices(recent),
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
    final met = progress >= 100;
    final now = DateTime.now();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final daysLeft = daysInMonth - now.day;
    final remaining = math.max(0, target - achieved);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.heroGradient,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Pill(met ? 'Target met' : 'Monthly target',
                    met ? AppColors.ok : AppColors.brandBright),
                const SizedBox(height: 14),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(money(achieved),
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.6)),
                ),
                const SizedBox(height: 2),
                Text('of ${money(target)}',
                    style: const TextStyle(
                        color: AppColors.muted, fontSize: 13)),
                const SizedBox(height: 14),
                Text(
                    met
                        ? 'Great work — keep going!'
                        : '${moneyK(remaining)} to go · $daysLeft days left',
                    style: const TextStyle(
                        color: AppColors.ink2,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 104,
            height: 104,
            child: CustomPaint(
              painter: _RingPainter((progress / 100).clamp(0, 1).toDouble()),
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('${progress.toStringAsFixed(0)}%',
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink)),
                  const Text('achieved',
                      style: TextStyle(fontSize: 10.5, color: AppColors.muted)),
                ]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double value;
  _RingPainter(this.value);

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 10.0;
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    final track = Paint()
      ..color = AppColors.well
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(r, 0, math.pi * 2, false, track);
    if (value <= 0) return;
    final arc = Paint()
      ..shader = const SweepGradient(
        colors: [AppColors.brandBright, AppColors.brand, AppColors.brandAlt],
        transform: GradientRotation(-math.pi / 2),
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = stroke;
    canvas.drawArc(r, -math.pi / 2, math.pi * 2 * value, false, arc);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.value != value;
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
      padding: const EdgeInsets.all(14),
      decoration: cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: color, size: 17),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.muted)),
            ),
          ]),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value,
                style: const TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: AppColors.ink)),
          ),
        ],
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  final String title;
  final String caption;
  final Widget child;
  const _ChartCard(
      {required this.title, required this.caption, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink)),
            const Spacer(),
            Text(caption,
                style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ]),
          const SizedBox(height: 18),
          SizedBox(height: 150, child: child),
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
    final spots = <FlSpot>[
      for (var i = 0; i < data.length; i++)
        FlSpot(i.toDouble(), asNum(data[i]['value']).toDouble()),
    ];
    final maxY = spots.isEmpty ? 0.0 : spots.map((s) => s.y).reduce(math.max);
    return LineChart(
      LineChartData(
        minY: 0,
        maxY: maxY == 0 ? 1 : maxY * 1.25,
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => AppColors.well,
            getTooltipItems: (spots) => spots
                .map((s) => LineTooltipItem(moneyK(s.y),
                    const TextStyle(
                        color: AppColors.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 12)))
                .toList(),
          ),
        ),
        gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                const FlLine(color: AppColors.lineSoft, strokeWidth: 1)),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 1,
              getTitlesWidget: (v, _) {
                final i = v.toInt();
                if (i < 0 || i >= data.length || v != i.toDouble()) {
                  return const SizedBox();
                }
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
            curveSmoothness: 0.3,
            preventCurveOverShooting: true,
            gradient: const LinearGradient(
                colors: [AppColors.brandBright, AppColors.brandAlt]),
            barWidth: 3,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                radius: 3.5,
                color: AppColors.bg,
                strokeWidth: 2,
                strokeColor: AppColors.brandBright,
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.brand.withValues(alpha: 0.30),
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
    final values = data.map((d) => asNum(d['value']).toDouble()).toList();
    final maxY = values.isEmpty ? 0.0 : values.reduce(math.max);
    final top = maxY == 0 ? 1.0 : maxY * 1.2;
    return BarChart(
      BarChartData(
        maxY: top,
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (_) => AppColors.well,
            getTooltipItem: (g, _, rod, _) => BarTooltipItem(
                moneyK(rod.toY),
                const TextStyle(
                    color: AppColors.ink,
                    fontWeight: FontWeight.w700,
                    fontSize: 12)),
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, _) {
                final i = v.toInt();
                if (i < 0 || i >= data.length) return const SizedBox();
                final today = i == data.length - 1;
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('${data[i]['label']}',
                      style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: today ? FontWeight.w700 : FontWeight.w500,
                          color: today ? AppColors.ink : AppColors.muted)),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < values.length; i++)
            BarChartGroupData(x: i, barRods: [
              BarChartRodData(
                toY: values[i],
                width: 18,
                borderRadius: BorderRadius.circular(6),
                gradient: i == values.length - 1
                    ? const LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [AppColors.brand, AppColors.brandBright])
                    : null,
                color: i == values.length - 1 ? null : AppColors.well,
                backDrawRodData: BackgroundBarChartRodData(
                    show: true, toY: top, color: AppColors.lineSoft),
              ),
            ]),
        ],
      ),
    );
  }
}

class _RecentInvoices extends StatelessWidget {
  final List<Map> orders;
  const _RecentInvoices(this.orders);

  Color _color(String s) {
    switch (s) {
      case 'Paid':
        return AppColors.ok;
      case 'Partial':
        return AppColors.warn;
      default:
        return AppColors.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: cardDecoration(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Eyebrow('Recent invoices'),
          const SizedBox(height: 6),
          if (orders.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 22),
              child: Center(
                  child: Text('No invoices yet — orders appear here once invoiced.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, fontSize: 13))),
            )
          else
            for (final o in orders)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: const BoxDecoration(
                    border: Border(
                        bottom: BorderSide(color: AppColors.lineSoft))),
                child: Row(children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                        color: AppColors.raised,
                        borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.description_outlined,
                        size: 18, color: AppColors.ink2),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${o['customer']}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: AppColors.ink)),
                        const SizedBox(height: 2),
                        Text('${o['code']} · ${fmtDate(o['date'])}',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.muted)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(moneyK(asNum(o['total'])),
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: AppColors.ink)),
                      const SizedBox(height: 4),
                      Pill('${o['status']}', _color('${o['status']}'),
                          dot: false),
                    ],
                  ),
                ]),
              ),
        ],
      ),
    );
  }
}
