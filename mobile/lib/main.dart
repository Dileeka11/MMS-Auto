import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api.dart';
import 'theme.dart';
import 'screens/login.dart';
import 'screens/home.dart';

final navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.surface,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  await Api.loadToken();
  // A rejected token anywhere in the app sends the rep back to sign in.
  Api.onUnauthorized = () {
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen(expired: true)),
      (_) => false,
    );
  };
  runApp(const NmsRepApp());
}

class NmsRepApp extends StatelessWidget {
  const NmsRepApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NMS Sales Rep',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: Api.isLoggedIn ? const HomeScreen() : const LoginScreen(),
    );
  }
}
