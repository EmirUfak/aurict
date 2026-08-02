import 'package:flutter/widgets.dart';

/// Uygulama ön/arka plan geçişlerini merkezi olarak yönetir.
///
/// main.dart içindeki State sınıflarının doğrudan WidgetsBindingObserver
/// implemente etmesi yerine, bu tekil ve test edilebilir koordinatör
/// kullanılır. Birden fazla ekran/servis (sohbet kaydı, remote heartbeat vb.)
/// aynı anda kendi [MobileLifecycleCoordinator] örneğini attach edebilir;
/// WidgetsBinding birden fazla observer'ı destekler.
///
/// [onEnterBackground] yalnızca uygulama ÖN PLANDAN arka plana yeni GİRERKEN
/// bir kez çağrılır — inactive -> paused -> detached zincirinin her adımında
/// tekrar tekrar tetiklenmez. Aynı şekilde [onEnterForeground] yalnızca
/// arka plandan resumed durumuna DÖNÜLDÜĞÜNDE bir kez çağrılır. Bu, pause/
/// resume tekrarlarında çoğaltılmış timer veya çoğaltılmış kayıt işlemi
/// oluşmasını engeller.
class MobileLifecycleCoordinator with WidgetsBindingObserver {
  MobileLifecycleCoordinator({
    required this.onEnterBackground,
    required this.onEnterForeground,
    WidgetsBinding? binding,
  }) : _binding = binding ?? WidgetsBinding.instance;

  final WidgetsBinding _binding;
  final VoidCallback onEnterBackground;
  final VoidCallback onEnterForeground;

  AppLifecycleState? _lastState;
  bool _attached = false;

  bool get isAttached => _attached;

  void attach() {
    if (_attached) return;
    _attached = true;
    _binding.addObserver(this);
  }

  void detach() {
    if (!_attached) return;
    _attached = false;
    _binding.removeObserver(this);
  }

  static bool _isBackground(AppLifecycleState? state) {
    return state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final previous = _lastState;
    _lastState = state;
    final wasBackground = _isBackground(previous);
    final isBackground = _isBackground(state);

    if (isBackground && !wasBackground) {
      onEnterBackground();
      return;
    }
    if (!isBackground && wasBackground && state == AppLifecycleState.resumed) {
      onEnterForeground();
    }
  }
}
