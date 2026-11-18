import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// App palette — mirrors the NMS-Auto web admin (dark navy surfaces, electric
/// blue accent) so the rep app and head office feel like one product.
class AppColors {
  // Surfaces (darkest → lightest)
  static const bg = Color(0xFF0D1117);
  static const surface = Color(0xFF151A21);
  static const raised = Color(0xFF1C222B);
  static const well = Color(0xFF242B35);
  static const line = Color(0xFF2A313C);
  static const lineSoft = Color(0xFF20262F);

  // Text
  static const ink = Color(0xFFF2F4F7);
  static const ink2 = Color(0xFFB6BDC7);
  static const muted = Color(0xFF7F8794);
  static const faint = Color(0xFF59616D);

  // Accent
  static const brand = Color(0xFF2F80F5);
  static const brandBright = Color(0xFF5C9DFF);
  static const brandDark = Color(0xFF1F63D6);
  static const brandAlt = Color(0xFF7B61FF);
  static const brandDim = Color(0x242F80F5);

  // Status
  static const ok = Color(0xFF3CC57F);
  static const warn = Color(0xFFF0AE3C);
  static const danger = Color(0xFFEF5350);

  static const brandGradient = LinearGradient(
    colors: [Color(0xFF2F80F5), Color(0xFF5B5BF6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const heroGradient = LinearGradient(
    colors: [Color(0xFF16233A), Color(0xFF131A26), Color(0xFF151A21)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class AppShadows {
  static const soft = [
    BoxShadow(color: Color(0x40000000), blurRadius: 18, offset: Offset(0, 8)),
  ];
  static const glow = [
    BoxShadow(color: Color(0x552F80F5), blurRadius: 24, offset: Offset(0, 10)),
  ];
}

/// Standard card surface: rounded, hairline border.
BoxDecoration cardDecoration({double radius = 18, Color? border, Color? color}) {
  return BoxDecoration(
    color: color ?? AppColors.surface,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: border ?? AppColors.lineSoft),
  );
}

/// Small uppercase section label, like the web admin's `.eyebrow`.
class Eyebrow extends StatelessWidget {
  final String text;
  final Widget? trailing;
  const Eyebrow(this.text, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 11,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w700,
                color: AppColors.muted)),
        const Spacer(),
        ?trailing,
      ],
    );
  }
}

/// Coloured status pill with a leading dot.
class Pill extends StatelessWidget {
  final String label;
  final Color color;
  final bool dot;
  const Pill(this.label, this.color, {super.key, this.dot = true});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (dot) ...[
          Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
        ],
        Text(label,
            style: TextStyle(
                color: color, fontSize: 11, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

/// Centered empty / error placeholder.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final VoidCallback? onRetry;
  const EmptyState(
      {super.key,
      required this.icon,
      required this.title,
      this.message,
      this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
                color: AppColors.raised,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.line)),
            child: Icon(icon, color: AppColors.muted, size: 28),
          ),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.ink,
                  fontWeight: FontWeight.w700,
                  fontSize: 15)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          ],
          if (onRetry != null) ...[
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ]),
      ),
    );
  }
}

/// Initials avatar on the brand gradient.
class Avatar extends StatelessWidget {
  final String text;
  final double size;
  const Avatar(this.text, {super.key, this.size = 40});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
          shape: BoxShape.circle, gradient: AppColors.brandGradient),
      child: Text(text,
          style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: size * 0.36)),
    );
  }
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.brand,
    brightness: Brightness.dark,
  ).copyWith(
    primary: AppColors.brand,
    onPrimary: Colors.white,
    surface: AppColors.surface,
    onSurface: AppColors.ink,
    error: AppColors.danger,
  );
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    fontFamily: 'Roboto',
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: const BorderSide(color: AppColors.line),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
        bodyColor: AppColors.ink, displayColor: AppColors.ink),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
          fontSize: 19, fontWeight: FontWeight.w800, color: AppColors.ink),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.lineSoft, thickness: 1),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.brand, linearTrackColor: AppColors.raised),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.well,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.brandBright,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.well,
      contentTextStyle: const TextStyle(color: AppColors.ink, fontSize: 13),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: AppColors.line)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: AppColors.raised,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.line)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.raised,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: const TextStyle(color: AppColors.faint),
      labelStyle: const TextStyle(color: AppColors.muted),
      prefixIconColor: AppColors.muted,
      suffixIconColor: AppColors.muted,
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
          borderSide: const BorderSide(color: AppColors.brand, width: 1.6)),
    ),
  );
}

final _money = NumberFormat('#,##0', 'en_US');
String money(num v) => 'Rs ${_money.format(v)}';
String moneyK(num v) {
  final a = v.abs();
  if (a >= 1000000) return 'Rs ${(v / 1000000).toStringAsFixed(1)}M';
  if (a >= 1000) return 'Rs ${(v / 1000).toStringAsFixed(0)}K';
  return 'Rs ${v.toStringAsFixed(0)}';
}

/// Trim an ISO date/timestamp to a clean `YYYY-MM-DD`.
String fmtDate(dynamic d) {
  final s = '${d ?? ''}';
  return s.length >= 10 ? s.substring(0, 10) : s;
}

/// Read a JSON number that may arrive as num or string.
num asNum(dynamic v) {
  if (v is num) return v;
  return num.tryParse('${v ?? ''}') ?? 0;
}
