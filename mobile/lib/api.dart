import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Central API client for the NMS rep app.
///
/// The base URL points at the live server by default. To test against a local
/// Laravel dev server use `http://10.0.2.2:8000/api` on the Android emulator.
class Api {
  // Live: 'http://nms-auto.sourcecode.lk/api'
  // Emulator → local Laravel dev server:
  static const String baseUrl = 'http://10.0.2.2:8000/api';

  static String? _token;
  static Map<String, dynamic>? rep;

  static Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('rep_token');
    final r = prefs.getString('rep_data');
    if (r != null) rep = jsonDecode(r) as Map<String, dynamic>;
  }

  static bool get isLoggedIn => _token != null;

  static Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    if (_token != null) {
      await prefs.setString('rep_token', _token!);
    } else {
      await prefs.remove('rep_token');
    }
    if (rep != null) {
      await prefs.setString('rep_data', jsonEncode(rep));
    } else {
      await prefs.remove('rep_data');
    }
  }

  static Map<String, String> get _headers => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/rep/login'),
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = _decode(res);
    if (res.statusCode == 200) {
      _token = data['token'] as String;
      rep = Map<String, dynamic>.from(data['rep'] as Map);
      await _save();
      return rep!;
    }
    throw ApiException(_firstError(data) ?? 'Login failed');
  }

  static Future<void> logout() async {
    try {
      await http.post(Uri.parse('$baseUrl/rep/logout'), headers: _headers);
    } catch (_) {}
    _token = null;
    rep = null;
    await _save();
  }

  static Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl/rep/$path'), headers: _headers);
    return _handle(res);
  }

  static Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl/rep/$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _handle(res);
  }

  static dynamic _handle(http.Response res) {
    final data = _decode(res);
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    if (res.statusCode == 401) {
      _token = null;
      rep = null;
      _save();
      throw ApiException('Session expired. Please log in again.');
    }
    throw ApiException(_firstError(data) ?? 'Request failed (${res.statusCode})');
  }

  static dynamic _decode(http.Response res) {
    if (res.body.isEmpty) return null;
    try {
      return jsonDecode(res.body);
    } catch (_) {
      return null;
    }
  }

  static String? _firstError(dynamic data) {
    if (data is Map) {
      if (data['errors'] is Map) {
        final errs = data['errors'] as Map;
        if (errs.isNotEmpty) {
          final first = errs.values.first;
          if (first is List && first.isNotEmpty) return first.first.toString();
        }
      }
      if (data['message'] is String) return data['message'] as String;
    }
    return null;
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}
