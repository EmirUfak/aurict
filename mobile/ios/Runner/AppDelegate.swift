import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, UIDocumentPickerDelegate {
  private let artifactChannelName = "dev.aurict.mobile/artifacts"
  private let secureKeyChannelName = "dev.aurict.mobile/secure_keys"
  private let chatHistoryChannelName = "dev.aurict.mobile/chat_history"
  private let artifactIndexChannelName = "dev.aurict.mobile/artifact_index"
  private let modelCacheChannelName = "dev.aurict.mobile/model_cache"
  private let documentPickerChannelName = "dev.aurict.mobile/document_picker"
  private let diagnosticsChannelName = "dev.aurict.mobile/diagnostics"
  private let keychainService = "dev.aurict.mobile.provider_keys"
  private let maxPickedDocumentBytes = 8 * 1024 * 1024
  private var artifactChannel: FlutterMethodChannel?
  private var secureKeyChannel: FlutterMethodChannel?
  private var chatHistoryChannel: FlutterMethodChannel?
  private var artifactIndexChannel: FlutterMethodChannel?
  private var modelCacheChannel: FlutterMethodChannel?
  private var documentPickerChannel: FlutterMethodChannel?
  private var diagnosticsChannel: FlutterMethodChannel?
  private var pendingDocumentPickerResult: FlutterResult?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    configureArtifactChannel(binaryMessenger: engineBridge.applicationRegistrar.binaryMessenger)
  }

  private func configureArtifactChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: artifactChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(["message": "Aurict artifact bridge is unavailable."])
        return
      }
      switch call.method {
      case "renderHtmlToPdf":
        self.renderHtmlToPdf(call.arguments, result: result)
      case "saveArtifact":
        self.saveArtifact(call.arguments, result: result)
      case "shareArtifact":
        self.shareArtifact(call.arguments, result: result)
      case "openArtifact":
        self.openArtifact(call.arguments, result: result)
      case "deleteArtifact":
        self.deleteArtifact(call.arguments, result: result)
      case "clearArtifactCache":
        self.clearArtifactCache(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    artifactChannel = channel
    configureSecureKeyChannel(binaryMessenger: binaryMessenger)
  }

  private func configureSecureKeyChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: secureKeyChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "bridge_unavailable", message: "Secure key bridge is unavailable.", details: nil))
        return
      }
      switch call.method {
      case "saveProviderKey":
        self.saveProviderKey(call.arguments, result: result)
      case "readProviderKey":
        self.readProviderKey(call.arguments, result: result)
      case "deleteProviderKey":
        self.deleteProviderKey(call.arguments, result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    secureKeyChannel = channel
    configureChatHistoryChannel(binaryMessenger: binaryMessenger)
  }

  private func configureChatHistoryChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: chatHistoryChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "bridge_unavailable", message: "Chat history bridge is unavailable.", details: nil))
        return
      }
      switch call.method {
      case "listThreads":
        self.listChatThreads(result: result)
      case "readThread":
        self.readChatThread(call.arguments, result: result)
      case "writeThread":
        self.writeChatThread(call.arguments, result: result)
      case "deleteThread":
        self.deleteChatThread(call.arguments, result: result)
      case "clearAllThreads":
        self.clearAllChatThreads(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    chatHistoryChannel = channel
    configureArtifactIndexChannel(binaryMessenger: binaryMessenger)
  }

  private func configureArtifactIndexChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: artifactIndexChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "bridge_unavailable", message: "Artifact index bridge is unavailable.", details: nil))
        return
      }
      switch call.method {
      case "readArtifactIndex":
        self.readArtifactIndex(result: result)
      case "writeArtifactIndex":
        self.writeArtifactIndex(call.arguments, result: result)
      case "clearArtifactIndex":
        self.clearArtifactIndex(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    artifactIndexChannel = channel
    configureModelCacheChannel(binaryMessenger: binaryMessenger)
  }

  private func configureModelCacheChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: modelCacheChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "bridge_unavailable", message: "Model cache bridge is unavailable.", details: nil))
        return
      }
      switch call.method {
      case "readModelCache":
        self.readModelCache(result: result)
      case "writeModelCache":
        self.writeModelCache(call.arguments, result: result)
      case "clearModelCache":
        self.clearModelCache(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    modelCacheChannel = channel
    configureDocumentPickerChannel(binaryMessenger: binaryMessenger)
  }

  private func configureDocumentPickerChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: documentPickerChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "bridge_unavailable", message: "Document picker bridge is unavailable.", details: nil))
        return
      }
      switch call.method {
      case "pickDocument":
        self.pickDocument(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    documentPickerChannel = channel
    configureDiagnosticsChannel(binaryMessenger: binaryMessenger)
  }

  private func configureDiagnosticsChannel(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: diagnosticsChannelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "bridge_unavailable", message: "Diagnostics bridge is unavailable.", details: nil))
        return
      }
      switch call.method {
      case "readDiagnostics":
        self.readDiagnostics(result: result)
      case "writeDiagnostic":
        self.writeDiagnostic(call.arguments, result: result)
      case "clearDiagnostics":
        self.clearDiagnostics(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    diagnosticsChannel = channel
  }

  private func readDiagnostics(result: FlutterResult) {
    let url = diagnosticsFile()
    result((try? String(contentsOf: url, encoding: .utf8)) ?? "[]")
  }

  private func writeDiagnostic(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let payload = map["payload"] as? String,
      !payload.isEmpty,
      let payloadData = payload.data(using: .utf8),
      let event = try? JSONSerialization.jsonObject(with: payloadData)
    else {
      result(FlutterError(code: "bad_args", message: "writeDiagnostic requires payload.", details: nil))
      return
    }
    let url = diagnosticsFile()
    var events: [Any] = []
    if
      let existing = try? Data(contentsOf: url),
      let decoded = try? JSONSerialization.jsonObject(with: existing) as? [Any] {
      events = decoded
    }
    events.append(event)
    if events.count > 80 {
      events = Array(events.suffix(80))
    }
    do {
      let data = try JSONSerialization.data(withJSONObject: events)
      try data.write(to: url, options: .atomic)
      result(nil)
    } catch {
      result(FlutterError(code: "write_failed", message: error.localizedDescription, details: nil))
    }
  }

  private func clearDiagnostics(result: FlutterResult) {
    try? FileManager.default.removeItem(at: diagnosticsFile())
    result(nil)
  }

  private func diagnosticsFile() -> URL {
    let support = (try? FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )) ?? FileManager.default.temporaryDirectory
    return support.appendingPathComponent("diagnostics.json")
  }

  private func pickDocument(result: @escaping FlutterResult) {
    guard pendingDocumentPickerResult == nil else {
      result(["ok": false, "message": "Document picker is already open."])
      return
    }
    guard let presenter = activePresenter() else {
      result(["ok": false, "message": "Unable to present document picker."])
      return
    }
    pendingDocumentPickerResult = result
    let picker = UIDocumentPickerViewController(
      documentTypes: [
        "com.adobe.pdf",
        "public.plain-text",
        "public.text",
        "public.json",
        "public.comma-separated-values-text",
        "net.daringfireball.markdown"
      ],
      in: .import
    )
    picker.delegate = self
    picker.allowsMultipleSelection = false
    presenter.present(picker, animated: true)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pendingDocumentPickerResult?(["ok": false, "message": "Document selection cancelled."])
    pendingDocumentPickerResult = nil
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let result = pendingDocumentPickerResult else {
      return
    }
    pendingDocumentPickerResult = nil
    guard let url = urls.first else {
      result(["ok": false, "message": "No document selected."])
      return
    }
    do {
      result(try readPickedDocument(url))
    } catch {
      result(["ok": false, "message": error.localizedDescription])
    }
  }

  private func readPickedDocument(_ url: URL) throws -> [String: Any] {
    let didAccess = url.startAccessingSecurityScopedResource()
    defer {
      if didAccess {
        url.stopAccessingSecurityScopedResource()
      }
    }
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    let size = (attributes[.size] as? NSNumber)?.intValue ?? 0
    if size > maxPickedDocumentBytes {
      throw NSError(
        domain: "AurictDocumentPicker",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Document is larger than 8 MB."]
      )
    }
    let data = try Data(contentsOf: url)
    let mimeType = mimeTypeFor(url)
    var preview = ""
    if isTextDocument(url: url, mimeType: mimeType),
       let text = String(data: data, encoding: .utf8) {
      preview = String(
        text
        .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .prefix(3000)
      )
    }
    return [
      "ok": true,
      "document": [
        "name": url.lastPathComponent,
        "mimeType": mimeType,
        "sizeBytes": data.count,
        "sourceUri": url.absoluteString,
        "textPreview": preview
      ]
    ]
  }

  private func mimeTypeFor(_ url: URL) -> String {
    switch url.pathExtension.lowercased() {
    case "pdf":
      return "application/pdf"
    case "md", "markdown":
      return "text/markdown"
    case "json":
      return "application/json"
    case "csv":
      return "text/csv"
    case "txt", "log":
      return "text/plain"
    default:
      return "application/octet-stream"
    }
  }

  private func isTextDocument(url: URL, mimeType: String) -> Bool {
    let ext = url.pathExtension.lowercased()
    return mimeType.hasPrefix("text/")
      || mimeType == "application/json"
      || ["md", "markdown", "json", "csv", "txt", "log"].contains(ext)
  }

  private func readModelCache(result: FlutterResult) {
    do {
      let directory = try modelCacheDirectory()
      let files = try FileManager.default.contentsOfDirectory(
        at: directory,
        includingPropertiesForKeys: nil
      )
      var cache: [String: Any] = [:]
      for file in files where file.pathExtension == "json" {
        guard
          let data = try? Data(contentsOf: file),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let provider = json["provider"] as? String,
          !provider.isEmpty
        else {
          continue
        }
        cache[provider] = json
      }
      let data = try JSONSerialization.data(withJSONObject: cache)
      result(String(data: data, encoding: .utf8) ?? "{}")
    } catch {
      result("{}")
    }
  }

  private func writeModelCache(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let provider = map["provider"] as? String,
      let payload = map["payload"] as? String,
      !provider.isEmpty,
      !payload.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "writeModelCache requires provider and payload.", details: nil))
      return
    }
    do {
      let directory = try modelCacheDirectory()
      try FileManager.default.createDirectory(
        at: directory,
        withIntermediateDirectories: true,
        attributes: nil
      )
      let url = directory.appendingPathComponent("\(safeFileName(provider)).json")
      try payload.write(to: url, atomically: true, encoding: .utf8)
      result(nil)
    } catch {
      result(FlutterError(code: "write_failed", message: error.localizedDescription, details: nil))
    }
  }

  private func clearModelCache(result: FlutterResult) {
    if let directory = try? modelCacheDirectory() {
      try? FileManager.default.removeItem(at: directory)
    }
    result(nil)
  }

  private func modelCacheDirectory() throws -> URL {
    let support = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    return support.appendingPathComponent("model_cache", isDirectory: true)
  }

  private func listChatThreads(result: FlutterResult) {
    do {
      let directory = try chatHistoryDirectory()
      let files = try FileManager.default.contentsOfDirectory(
        at: directory,
        includingPropertiesForKeys: nil
      )
      let metas = files.compactMap { file -> [String: Any]? in
        guard
          file.pathExtension == "json",
          let data = try? Data(contentsOf: file),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
          return nil
        }
        return json["meta"] as? [String: Any]
      }
      let data = try JSONSerialization.data(withJSONObject: metas)
      result(String(data: data, encoding: .utf8) ?? "[]")
    } catch {
      result("[]")
    }
  }

  private func readChatThread(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let id = map["id"] as? String,
      !id.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "readThread requires id.", details: nil))
      return
    }
    do {
      let url = try chatHistoryDirectory().appendingPathComponent("\(safeFileName(id)).json")
      result(try String(contentsOf: url, encoding: .utf8))
    } catch {
      result(nil)
    }
  }

  private func writeChatThread(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let id = map["id"] as? String,
      let payload = map["payload"] as? String,
      !id.isEmpty,
      !payload.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "writeThread requires id and payload.", details: nil))
      return
    }
    do {
      let directory = try chatHistoryDirectory()
      try FileManager.default.createDirectory(
        at: directory,
        withIntermediateDirectories: true,
        attributes: nil
      )
      let url = directory.appendingPathComponent("\(safeFileName(id)).json")
      try payload.write(to: url, atomically: true, encoding: .utf8)
      result(nil)
    } catch {
      result(FlutterError(code: "write_failed", message: error.localizedDescription, details: nil))
    }
  }

  private func deleteChatThread(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let id = map["id"] as? String,
      !id.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "deleteThread requires id.", details: nil))
      return
    }
    if let directory = try? chatHistoryDirectory() {
      try? FileManager.default.removeItem(
        at: directory.appendingPathComponent("\(safeFileName(id)).json")
      )
    }
    result(nil)
  }

  private func clearAllChatThreads(result: FlutterResult) {
    if let directory = try? chatHistoryDirectory() {
      try? FileManager.default.removeItem(at: directory)
    }
    result(nil)
  }

  private func chatHistoryDirectory() throws -> URL {
    let support = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    return support.appendingPathComponent("chat_history", isDirectory: true)
  }

  private func readArtifactIndex(result: FlutterResult) {
    let url = artifactIndexFile()
    result((try? String(contentsOf: url, encoding: .utf8)) ?? "[]")
  }

  private func writeArtifactIndex(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let payload = map["payload"] as? String,
      !payload.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "writeArtifactIndex requires payload.", details: nil))
      return
    }
    do {
      try payload.write(to: artifactIndexFile(), atomically: true, encoding: .utf8)
      result(nil)
    } catch {
      result(FlutterError(code: "write_failed", message: error.localizedDescription, details: nil))
    }
  }

  private func clearArtifactIndex(result: FlutterResult) {
    try? FileManager.default.removeItem(at: artifactIndexFile())
    result(nil)
  }

  private func artifactIndexFile() -> URL {
    let support = try? FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    return (support ?? FileManager.default.temporaryDirectory)
      .appendingPathComponent("artifact_index.json", isDirectory: false)
  }

  private func saveProviderKey(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let provider = map["provider"] as? String,
      let key = map["key"] as? String,
      !provider.isEmpty,
      !key.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "saveProviderKey requires provider and key.", details: nil))
      return
    }
    let payload: [String: String] = [
      "provider": provider,
      "key": key,
      "createdAt": map["createdAt"] as? String ?? "",
      "lastUsedAt": map["lastUsedAt"] as? String ?? ""
    ]
    do {
      let data = try JSONSerialization.data(withJSONObject: payload)
      var item = keychainQuery(provider: provider)
      SecItemDelete(item as CFDictionary)
      item[kSecValueData as String] = data
      item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      let status = SecItemAdd(item as CFDictionary, nil)
      if status == errSecSuccess {
        result(nil)
      } else {
        result(FlutterError(code: "keychain_save_failed", message: "Keychain save failed: \(status)", details: nil))
      }
    } catch {
      result(FlutterError(code: "encode_failed", message: error.localizedDescription, details: nil))
    }
  }

  private func readProviderKey(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let provider = map["provider"] as? String,
      !provider.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "readProviderKey requires provider.", details: nil))
      return
    }
    var query = keychainQuery(provider: provider)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      result(nil)
      return
    }
    guard status == errSecSuccess, let data = item as? Data else {
      result(FlutterError(code: "keychain_read_failed", message: "Keychain read failed: \(status)", details: nil))
      return
    }
    do {
      let decoded = try JSONSerialization.jsonObject(with: data) as? [String: String]
      result(decoded)
    } catch {
      result(FlutterError(code: "decode_failed", message: error.localizedDescription, details: nil))
    }
  }

  private func deleteProviderKey(_ arguments: Any?, result: FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let provider = map["provider"] as? String,
      !provider.isEmpty
    else {
      result(FlutterError(code: "bad_args", message: "deleteProviderKey requires provider.", details: nil))
      return
    }
    SecItemDelete(keychainQuery(provider: provider) as CFDictionary)
    result(nil)
  }

  private func keychainQuery(provider: String) -> [String: Any] {
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: provider
    ]
  }

  private func renderHtmlToPdf(_ arguments: Any?, result: @escaping FlutterResult) {
    guard
      let map = arguments as? [String: Any],
      let html = map["html"] as? String
    else {
      result(FlutterError(code: "bad_args", message: "renderHtmlToPdf requires html.", details: nil))
      return
    }
    let artifactId = (map["artifactId"] as? String)?.isEmpty == false
      ? map["artifactId"] as! String
      : "aurict-render-\(Int(Date().timeIntervalSince1970 * 1000))"
    let fileName = safeFileName(
      (map["fileName"] as? String)?.isEmpty == false
        ? map["fileName"] as! String
        : "\(artifactId).pdf"
    )

    let formatter = UIMarkupTextPrintFormatter(markupText: html)
    let renderer = UIPrintPageRenderer()
    renderer.addPrintFormatter(formatter, startingAtPageAt: 0)

    let pageRect = CGRect(x: 0, y: 0, width: 595.2, height: 841.8)
    let printableRect = pageRect.insetBy(dx: 36, dy: 36)
    renderer.setValue(NSValue(cgRect: pageRect), forKey: "paperRect")
    renderer.setValue(NSValue(cgRect: printableRect), forKey: "printableRect")
    renderer.prepare(forDrawingPages: NSRange(location: 0, length: 1))

    let data = NSMutableData()
    UIGraphicsBeginPDFContextToData(data, pageRect, nil)
    for pageIndex in 0..<max(renderer.numberOfPages, 1) {
      UIGraphicsBeginPDFPage()
      renderer.drawPage(at: pageIndex, in: UIGraphicsGetPDFContextBounds())
    }
    UIGraphicsEndPDFContext()
    let pdfData = data as Data
    do {
      _ = try writeArtifact(
        ArtifactPayload(
          artifactId: artifactId,
          fileName: fileName,
          mimeType: "application/pdf",
          data: pdfData
        ),
        directory: renderedArtifactDirectory()
      )
    } catch {
      // Returning bytes keeps the Dart fallback path usable even if cache persistence fails.
    }
    result(FlutterStandardTypedData(bytes: pdfData))
  }

  private func saveArtifact(_ arguments: Any?, result: FlutterResult) {
    guard let payload = artifactPayload(arguments) else {
      result([
        "saved": false,
        "message": "Artifact save requires fileName, mimeType, and bytes."
      ])
      return
    }

    do {
      let url = try writeArtifact(payload, directory: documentsArtifactDirectory())
      result([
        "saved": true,
        "artifactId": payload.artifactId,
        "uri": url.absoluteString,
        "message": "Saved to iOS Files under Aurict."
      ])
    } catch {
      result([
        "saved": false,
        "artifactId": payload.artifactId,
        "message": error.localizedDescription
      ])
    }
  }

  private func shareArtifact(_ arguments: Any?, result: @escaping FlutterResult) {
    guard let payload = artifactPayload(arguments) else {
      result([
        "shared": false,
        "message": "Artifact share requires fileName, mimeType, and bytes."
      ])
      return
    }

    do {
      let url = try writeArtifact(payload, directory: temporaryArtifactDirectory())
      let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
      if let presenter = activePresenter() {
        controller.popoverPresentationController?.sourceView = presenter.view
        presenter.present(controller, animated: true)
        result([
          "shared": true,
          "artifactId": payload.artifactId,
          "uri": url.absoluteString,
          "message": "iOS share sheet opened."
        ])
      } else {
        result([
          "shared": false,
          "artifactId": payload.artifactId,
          "message": "Unable to present iOS share sheet."
        ])
      }
    } catch {
      result([
        "shared": false,
        "artifactId": payload.artifactId,
        "message": error.localizedDescription
      ])
    }
  }

  private func openArtifact(_ arguments: Any?, result: @escaping FlutterResult) {
    guard let payload = artifactPayload(arguments) else {
      result([
        "opened": false,
        "message": "Artifact open requires fileName, mimeType, and bytes."
      ])
      return
    }

    do {
      let url = try writeArtifact(payload, directory: temporaryArtifactDirectory())
      let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
      if let presenter = activePresenter() {
        controller.popoverPresentationController?.sourceView = presenter.view
        presenter.present(controller, animated: true)
        result([
          "opened": true,
          "artifactId": payload.artifactId,
          "uri": url.absoluteString,
          "message": "iOS open sheet opened."
        ])
      } else {
        result([
          "opened": false,
          "artifactId": payload.artifactId,
          "message": "Unable to present iOS open sheet."
        ])
      }
    } catch {
      result([
        "opened": false,
        "artifactId": payload.artifactId,
        "message": error.localizedDescription
      ])
    }
  }

  private func deleteArtifact(_ arguments: Any?, result: FlutterResult) {
    guard let map = arguments as? [String: Any] else {
      result(["deleted": false, "message": "deleteArtifact requires arguments."])
      return
    }
    let artifactId = map["artifactId"] as? String
    let fileName = map["fileName"] as? String
    guard artifactId?.isEmpty == false || fileName?.isEmpty == false else {
      result(["deleted": false, "message": "deleteArtifact requires artifactId or fileName."])
      return
    }
    let count = deleteArtifactFiles(artifactId: artifactId, fileName: fileName)
    result([
      "deleted": true,
      "artifactId": artifactId ?? fileName ?? "",
      "deletedFiles": count,
      "message": "Deleted \(count) cached artifact file(s)."
    ])
  }

  private func clearArtifactCache(result: FlutterResult) {
    var renderDeleted = false
    var exportDeleted = false
    if let renderDirectory = try? renderedArtifactDirectory() {
      try? FileManager.default.removeItem(at: renderDirectory)
      renderDeleted = !FileManager.default.fileExists(atPath: renderDirectory.path)
    }
    if let exportDirectory = try? temporaryArtifactDirectory() {
      try? FileManager.default.removeItem(at: exportDirectory)
      exportDeleted = !FileManager.default.fileExists(atPath: exportDirectory.path)
    }
    result([
      "cleared": true,
      "renderCacheDeleted": renderDeleted,
      "exportCacheDeleted": exportDeleted
    ])
  }

  private func artifactPayload(_ arguments: Any?) -> ArtifactPayload? {
    guard
      let map = arguments as? [String: Any],
      let rawFileName = map["fileName"] as? String
    else {
      return nil
    }
    let fileName = safeFileName(rawFileName)
    let mimeType = (map["mimeType"] as? String)?.isEmpty == false
      ? map["mimeType"] as! String
      : "application/octet-stream"
    let artifactId = (map["artifactId"] as? String)?.isEmpty == false
      ? map["artifactId"] as! String
      : fileName
    let data = (map["bytes"] as? FlutterStandardTypedData)?.data
      ?? cachedArtifactData(artifactId: artifactId, fileName: fileName)
    guard let data, !data.isEmpty else {
      return nil
    }
    return ArtifactPayload(
      artifactId: artifactId,
      fileName: fileName,
      mimeType: mimeType,
      data: data
    )
  }

  private func writeArtifact(_ payload: ArtifactPayload, directory: URL) throws -> URL {
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true,
      attributes: nil
    )
    let outputName = directory.lastPathComponent == "aurict_render"
      ? "\(safeFileName(payload.artifactId))-\(payload.fileName)"
      : payload.fileName
    let url = directory.appendingPathComponent(outputName)
    try payload.data.write(to: url, options: .atomic)
    return url
  }

  private func documentsArtifactDirectory() throws -> URL {
    let documents = try FileManager.default.url(
      for: .documentDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    return documents.appendingPathComponent("Aurict", isDirectory: true)
  }

  private func temporaryArtifactDirectory() throws -> URL {
    return FileManager.default.temporaryDirectory.appendingPathComponent(
      "Aurict",
      isDirectory: true
    )
  }

  private func renderedArtifactDirectory() throws -> URL {
    return FileManager.default.temporaryDirectory.appendingPathComponent(
      "aurict_render",
      isDirectory: true
    )
  }

  private func cachedArtifactData(artifactId: String, fileName: String) -> Data? {
    guard let directory = try? renderedArtifactDirectory() else {
      return nil
    }
    let exact = directory.appendingPathComponent("\(safeFileName(artifactId))-\(fileName)")
    if let data = try? Data(contentsOf: exact), !data.isEmpty {
      return data
    }
    guard let files = try? FileManager.default.contentsOfDirectory(
      at: directory,
      includingPropertiesForKeys: nil
    ) else {
      return nil
    }
    return files
      .first { file in
        let name = file.lastPathComponent
        return name.hasPrefix("\(safeFileName(artifactId))-") || name.hasSuffix("-\(fileName)")
      }
      .flatMap { try? Data(contentsOf: $0) }
  }

  private func deleteArtifactFiles(artifactId: String?, fileName: String?) -> Int {
    let safeId = artifactId.map(safeFileName)
    let safeName = fileName.map(safeFileName)
    let directories = [
      try? renderedArtifactDirectory(),
      try? temporaryArtifactDirectory(),
      try? documentsArtifactDirectory()
    ].compactMap { $0 }
    var count = 0
    for directory in directories {
      guard let files = try? FileManager.default.contentsOfDirectory(
        at: directory,
        includingPropertiesForKeys: nil
      ) else {
        continue
      }
      for file in files {
        let name = file.lastPathComponent
        let matches = (safeId != nil && name.hasPrefix("\(safeId!)-"))
          || (safeName != nil && name == safeName!)
          || (safeName != nil && name.hasSuffix("-\(safeName!)"))
        if matches {
          try? FileManager.default.removeItem(at: file)
          if !FileManager.default.fileExists(atPath: file.path) {
            count += 1
          }
        }
      }
    }
    return count
  }

  private func activePresenter() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let activeWindow = scenes
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    var presenter = activeWindow?.rootViewController ?? window?.rootViewController
    while let presented = presenter?.presentedViewController {
      presenter = presented
    }
    return presenter
  }

  private func safeFileName(_ value: String) -> String {
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
    var output = ""
    for scalar in value.unicodeScalars {
      output.append(allowed.contains(scalar) ? String(scalar) : "-")
    }
    let cleaned = output.trimmingCharacters(in: CharacterSet(charactersIn: "-._"))
    return cleaned.isEmpty ? "aurict-artifact.pdf" : cleaned
  }

  private struct ArtifactPayload {
    let artifactId: String
    let fileName: String
    let mimeType: String
    let data: Data
  }
}
