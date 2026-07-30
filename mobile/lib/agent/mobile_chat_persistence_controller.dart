import 'dart:async';

import 'mobile_chat_history_store.dart';
import 'mobile_diagnostics.dart';

/// Sohbet geçmişi disk yazımlarını merkezi ve seri (serialized) şekilde
/// yöneten controller.
///
/// STAB-01 kapsamında main.dart içindeki ChatScreen State'inin doğrudan
/// sorumlu olması yerine bu ayrı modül kullanılır. Aynı sohbete giden
/// ardışık [writeThread] çağrılarını çağrıldıkları sırayla bir kuyrukta
/// (chain) işler; böylece geç biten eski bir yazım, erken biten yeni bir
/// yazımın üzerine geçemez ("eski bir yazımın daha yeni içeriğin üzerine
/// yazmasını engeller" — STAB-01 kabul kriteri). Hatalar asla sessizce
/// yutulmaz: [mobileDiagnostics]'e kaydedilir ve döndürülen Future'ın
/// hatasıyla çağırana geri iletilir.
class MobileChatPersistenceController {
  MobileChatPersistenceController(this._store);
  

  final MobileChatHistoryStore _store;
  Future<void> _writeChain = Future<void>.value();

  Future<List<MobileChatThreadMeta>> listThreads() => _store.listThreads();

  Future<MobileChatThreadSnapshot?> readThread(String id) =>
      _store.readThread(id);

  Future<void> deleteThread(String id) => _store.deleteThread(id);

  Future<void> clearAllThreads() => _store.clearAllThreads();

  /// [snapshot]'ı diske yazar. Aynı controller örneği üzerinden yapılan
  /// tüm [writeThread] çağrıları — hangi thread'e ait olursa olsun —
  /// çağrılış sırasına göre serileştirilir.
  Future<void> writeThread(MobileChatThreadSnapshot snapshot) {
    final completer = Completer<void>();
    _writeChain = _writeChain.then((_) async {
      try {
        await _store.writeThread(snapshot);
        if (!completer.isCompleted) completer.complete();
      } catch (error, stack) {
        unawaited(
          mobileDiagnostics.record(
            error,
            stackTrace: stack,
            source: 'chat_history_write',
          ),
        );
        if (!completer.isCompleted) completer.completeError(error, stack);
      }
    });
    return completer.future;
  }
}
