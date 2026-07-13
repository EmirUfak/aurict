import 'dart:ui';

import 'package:flutter/widgets.dart';

class PlatformBlur extends StatelessWidget {
  const PlatformBlur({
    required this.enabled,
    required this.borderRadius,
    required this.sigma,
    required this.child,
    super.key,
  });

  final bool enabled;
  final BorderRadius borderRadius;
  final double sigma;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
        child: child,
      ),
    );
  }
}
