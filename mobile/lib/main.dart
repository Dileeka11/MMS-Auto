import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';
import 'screens/login.dart';
import 'screens/home.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.loadToken();
  runApp(const NmsRepApp());
}

class NmsRepApp extends StatelessWidget {
  const NmsRepApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MMS Sales Rep',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: Api.isLoggedIn ? const HomeScreen() : const LoginScreen(),
    );
  }
}
