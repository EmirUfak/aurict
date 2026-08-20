import 'dart:async';
import 'dart:convert';

import 'package:aurict_mobile/remote/mobile_device_identity.dart';
import 'package:aurict_mobile/remote/mobile_remote_models.dart';
import 'package:aurict_mobile/remote/mobile_remote_transport.dart';

/// Captures arguments passed to a `MobileRemoteTransport.buildAnswer()` call.
class CapturedBuildAnswerCall {
  const CapturedBuildAnswerCall({
    required this.session,
    required this.identity,
    required this.signPayload,
    this.turnCredential,
  });

  final MobileRemoteSession session;
  final MobileDeviceIdentity identity;
  final Future<String> Function(String payload) signPayload;
  final MobileTurnCredential? turnCredential;
}

/// Controllable, test-only fake implementation of [MobileRemoteTransport].
///
/// Designed to test remote runtime behaviors without real WebRTC, native plugins,
/// or network connections.
class FakeMobileRemoteTransport implements MobileRemoteTransport {
  FakeMobileRemoteTransport({
    this.throwOnMultipleBindings = false,
    this.answerToReturn,
    this.buildAnswerError,
    this.sendError,
    this.closeError,
  });

  /// When true, attempting to register more than one handler for onChannelOpen or
  /// onMessage throws a [StateError].
  final bool throwOnMultipleBindings;

  /// Custom answer envelope to return from [buildAnswer]. If null, a deterministic
  /// synthetic envelope is generated and signed with the provided signPayload.
  MobileSignalEnvelope? answerToReturn;

  /// Controlled error thrown by [buildAnswer] after capturing the call.
  Object? buildAnswerError;

  /// Controlled error thrown by [send] after recording to [sendCalls].
  Object? sendError;

  /// Controlled error thrown by [close] after incrementing [closeCount].
  Object? closeError;

  bool _isChannelOpen = false;
  bool _isClosed = false;

  int _openHandlerRegistrationCount = 0;
  int _messageHandlerRegistrationCount = 0;
  int _closeCount = 0;
  int _buildAnswerCallCount = 0;

  final List<void Function()> _openHandlers = [];
  final List<void Function(String data)> _messageHandlers = [];

  final List<CapturedBuildAnswerCall> _capturedBuildAnswerCalls = [];
  final List<String> _sendCalls = [];
  final List<String> _pendingOutbox = [];
  final List<String> _deliveredMessages = [];
  final List<String> _flushedMessages = [];
  final List<String> _emittedIncomingMessages = [];

  bool get isChannelOpen => _isChannelOpen;
  bool get isClosed => _isClosed;

  int get openHandlerRegistrationCount => _openHandlerRegistrationCount;
  int get messageHandlerRegistrationCount => _messageHandlerRegistrationCount;
  int get duplicateOpenBindingCount =>
      _openHandlerRegistrationCount > 1 ? _openHandlerRegistrationCount - 1 : 0;
  int get duplicateMessageBindingCount => _messageHandlerRegistrationCount > 1
      ? _messageHandlerRegistrationCount - 1
      : 0;

  int get openHandlerCount => _openHandlers.length;
  int get messageHandlerCount => _messageHandlers.length;

  int get closeCount => _closeCount;
  int get buildAnswerCallCount => _buildAnswerCallCount;

  List<CapturedBuildAnswerCall> get capturedBuildAnswerCalls =>
      List.unmodifiable(_capturedBuildAnswerCalls);
  CapturedBuildAnswerCall? get lastBuildAnswerCall =>
      _capturedBuildAnswerCalls.isEmpty ? null : _capturedBuildAnswerCalls.last;

  List<String> get sendCalls => List.unmodifiable(_sendCalls);
  List<String> get pendingOutbox => List.unmodifiable(_pendingOutbox);
  List<String> get deliveredMessages => List.unmodifiable(_deliveredMessages);
  List<String> get flushedMessages => List.unmodifiable(_flushedMessages);
  List<String> get emittedIncomingMessages =>
      List.unmodifiable(_emittedIncomingMessages);

  @override
  void onChannelOpen(void Function() handler) {
    _openHandlerRegistrationCount++;
    if (throwOnMultipleBindings && _openHandlerRegistrationCount > 1) {
      throw StateError(
        'Multiple onChannelOpen bindings detected (attempted registration #$_openHandlerRegistrationCount)',
      );
    }
    _openHandlers.add(handler);
  }

  @override
  void onMessage(void Function(String data) handler) {
    _messageHandlerRegistrationCount++;
    if (throwOnMultipleBindings && _messageHandlerRegistrationCount > 1) {
      throw StateError(
        'Multiple onMessage bindings detected (attempted registration #$_messageHandlerRegistrationCount)',
      );
    }
    _messageHandlers.add(handler);
  }

  @override
  void send(String data) {
    _sendCalls.add(data);
    if (sendError != null) {
      throw sendError!;
    }
    if (_isChannelOpen) {
      _deliveredMessages.add(data);
    } else {
      _pendingOutbox.add(data);
    }
  }

  @override
  Future<MobileSignalEnvelope> buildAnswer({
    required MobileRemoteSession session,
    required MobileDeviceIdentity identity,
    required Future<String> Function(String payload) signPayload,
    MobileTurnCredential? turnCredential,
  }) async {
    _buildAnswerCallCount++;
    final call = CapturedBuildAnswerCall(
      session: session,
      identity: identity,
      signPayload: signPayload,
      turnCredential: turnCredential,
    );
    _capturedBuildAnswerCalls.add(call);

    if (buildAnswerError != null) {
      throw buildAnswerError!;
    }

    if (answerToReturn != null) {
      return answerToReturn!;
    }

    final syntheticPayload = jsonEncode({
      'kind': 'aurict.mobile.remote.synthetic-answer',
      'sessionId': session.id,
      'desktopDeviceId': session.desktopDeviceId,
      'connectionMode': session.connectionMode,
      'createdAt': '2026-08-17T10:00:00.000Z',
      'turn': turnCredential == null
          ? null
          : {
              'urls': turnCredential.urls,
              'expiresAt': turnCredential.expiresAt.toUtc().toIso8601String(),
            },
    });

    final signature = await signPayload(syntheticPayload);

    return MobileSignalEnvelope(
      version: 1,
      sessionProtocolVersion: session.protocolVersion,
      type: 'answer',
      transport: session.connectionMode,
      payload: syntheticPayload,
      signingKeyFingerprint: identity.signingKeyFingerprint,
      signature: signature,
    );
  }

  @override
  Future<void> close() async {
    _closeCount++;
    if (closeError != null) {
      throw closeError!;
    }
    _isClosed = true;
    _isChannelOpen = false;
  }

  /// Simulates data channel open event.
  ///
  /// Execution sequence matches production `WebRtcMobileTransport._wireChannel`:
  /// 1. Sets [isChannelOpen] to true.
  /// 2. Takes a snapshot of [pendingOutbox].
  /// 3. Clears [pendingOutbox].
  /// 4. Flushes queued payloads in FIFO order into [flushedMessages] and [deliveredMessages].
  /// 5. Invokes registered open handlers.
  void simulateChannelOpen() {
    _isChannelOpen = true;
    final queued = List<String>.from(_pendingOutbox);
    _pendingOutbox.clear();
    for (final raw in queued) {
      _flushedMessages.add(raw);
      _deliveredMessages.add(raw);
    }
    for (final handler in _openHandlers) {
      handler();
    }
  }

  /// Simulates closing the channel without running [close].
  void simulateChannelClose() {
    _isChannelOpen = false;
  }

  /// Injects an incoming raw string message into the transport.
  ///
  /// Records payload in [emittedIncomingMessages] and sequentially delivers to
  /// all registered message handlers. If no handlers are registered, this is a safe no-op.
  void emitIncomingMessage(String data) {
    _emittedIncomingMessages.add(data);
    for (final handler in _messageHandlers) {
      handler(data);
    }
  }
}
