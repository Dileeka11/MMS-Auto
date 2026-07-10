import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// App palette — deep indigo brand with a clean light surface.
class AppColors {
  static const brand = Color(0xFF4F46E5); // indigo-600, a touch brighter
  static const brandDark = Color(0xFF4338CA);
  static const brandAlt = Color(0xFF7C3AED); // violet for gradients
  static const brandDim = Color(0xFFEEF0FF);
  static const bg = Color(0xFFF4F5F9);
  static const surface = Colors.white;
  static const ink = Color(0xFF161829);
  static const muted = Color(0xFF6B7089);
  static const line = Color(0xFFEBEDF4);
  static const ok = Color(0xFF16A34A);
  static const warn = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);

  /// Brand gradient used on hero surfaces (target card, login, avatars).
  static const brandGradient = LinearGradient(
    colors: [brand, brandAlt],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

/// Soft elevation used across cards and sheets for a premium, layered feel.
class AppShadows {
  static const soft = [
    BoxShadow(
      color: Color(0x0F1A1C2E), // ~6% ink
      blurRadius: 14,
      offset: Offset(0, 6),
    ),
    BoxShadow(
      color: Color(0x080F172A),
      blurRadius: 3,
      offset: Offset(0, 1),
    ),
  ];

  static const lifted = [
    BoxShadow(
      color: Color(0x1F4F46E5), // brand-tinted glow
      blurRadius: 24,
      offset: Offset(0, 12),
    ),
  ];
}

/// Standard card surface: rounded, hairline border + soft shadow.
BoxDecoration cardDecoration({double radius = 16, Color? border}) {
  return BoxDecoration(
    color: AppColors.surface,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: border ?? AppColors.line),
    boxShadow: AppShadows.soft,
  );
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.brand,
      primary: AppColors.brand,
    ),
    scaffoldBackgroundColor: AppColors.bg,
    fontFamily: 'Roboto',
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shadowColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppColors.line),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.brandDim,
      height: 68,
      elevation: 0,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? AppColors.brand : AppColors.muted,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
            color: selected ? AppColors.brand : AppColors.muted);
      }),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.line, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.ink,
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13),
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: const TextStyle(color: AppColors.muted),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.brand, width: 1.6),
      ),
    ),
  );
}

final _money = NumberFormat('#,##0', 'en_US');
String money(num v) => 'Rs ${_money.format(v)}';
String moneyK(num v) {
  if (v >= 1000000) return 'Rs ${(v / 1000000).toStringAsFixed(1)}M';
  if (v >= 1000) return 'Rs ${(v / 1000).toStringAsFixed(0)}K';
  return 'Rs ${v.toStringAsFixed(0)}';
}

/// Trim an ISO date/timestamp to a clean `YYYY-MM-DD`.
String fmtDate(dynamic d) {
  final s = '${d ?? ''}';
  return s.length >= 10 ? s.substring(0, 10) : s;
}
