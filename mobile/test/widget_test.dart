// Basic smoke test for the NMS rep app.
import 'package:flutter_test/flutter_test.dart';
import 'package:nms_rep/main.dart';

void main() {
  testWidgets('App builds', (WidgetTester tester) async {
    await tester.pumpWidget(const NmsRepApp());
    expect(find.byType(NmsRepApp), findsOneWidget);
  });
}
