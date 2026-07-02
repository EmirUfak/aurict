package com.aurict.mobile

import android.content.ContentValues
import android.content.Intent
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.OpenableColumns
import android.provider.MediaStore
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.Display
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

class MainActivity : FlutterActivity() {
    private val artifactChannelName = "dev.aurict.mobile/artifacts"
    private val secureKeyChannelName = "dev.aurict.mobile/secure_keys"
    private val chatHistoryChannelName = "dev.aurict.mobile/chat_history"
    private val modelCacheChannelName = "dev.aurict.mobile/model_cache"
    private val documentPickerChannelName = "dev.aurict.mobile/document_picker"
    private val diagnosticsChannelName = "dev.aurict.mobile/diagnostics"
    private val providerPrefsName = "aurict_provider_keys"
    private val androidKeyAlias = "aurict_provider_keys_v1"
    private val documentPickerRequestCode = 47812
    private val maxPickedDocumentBytes = 8 * 1024 * 1024
    private var pendingDocumentPickerResult: MethodChannel.Result? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        preferHighestRefreshRate()
    }

    override fun onResume() {
        super.onResume()
        preferHighestRefreshRate()
    }

    private fun preferHighestRefreshRate() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val display = currentDisplay() ?: return
        val currentMode = display.mode
        val sameResolutionModes = display.supportedModes.filter {
            it.physicalWidth == currentMode.physicalWidth &&
                it.physicalHeight == currentMode.physicalHeight
        }
        val bestMode = (sameResolutionModes.ifEmpty { display.supportedModes.toList() })
            .maxByOrNull { it.refreshRate } ?: return

        window.attributes = window.attributes.apply {
            preferredDisplayModeId = bestMode.modeId
            preferredRefreshRate = bestMode.refreshRate
        }
    }

    @Suppress("DEPRECATION")
    private fun currentDisplay(): Display? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else windowManager.defaultDisplay
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, artifactChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "renderHtmlToPdf" -> renderHtmlToPdf(call.arguments, result)
                    "saveArtifact" -> saveArtifact(call.arguments, result)
                    "shareArtifact" -> shareArtifact(call.arguments, result)
                    "openArtifact" -> openArtifact(call.arguments, result)
                    "deleteArtifact" -> deleteArtifact(call.arguments, result)
                    "clearArtifactCache" -> clearArtifactCache(result)
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, secureKeyChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "saveProviderKey" -> saveProviderKey(call.arguments, result)
                    "readProviderKey" -> readProviderKey(call.arguments, result)
                    "deleteProviderKey" -> deleteProviderKey(call.arguments, result)
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, chatHistoryChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "listThreads" -> listChatThreads(result)
                    "readThread" -> readChatThread(call.arguments, result)
                    "writeThread" -> writeChatThread(call.arguments, result)
                    "deleteThread" -> deleteChatThread(call.arguments, result)
                    "clearAllThreads" -> clearAllChatThreads(result)
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, modelCacheChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "readModelCache" -> readModelCache(result)
                    "writeModelCache" -> writeModelCache(call.arguments, result)
                    "clearModelCache" -> clearModelCache(result)
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, documentPickerChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "pickDocument" -> pickDocument(result)
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, diagnosticsChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "readDiagnostics" -> readDiagnostics(result)
                    "writeDiagnostic" -> writeDiagnostic(call.arguments, result)
                    "clearDiagnostics" -> clearDiagnostics(result)
                    else -> result.notImplemented()
                }
            }
    }

    private fun readDiagnostics(result: MethodChannel.Result) {
        val file = diagnosticsFile()
        result.success(if (file.exists()) file.readText() else "[]")
    }

    private fun writeDiagnostic(arguments: Any?, result: MethodChannel.Result) {
        val payload = (arguments as? Map<*, *>)?.get("payload")?.toString()
        if (payload.isNullOrBlank()) {
            result.error("bad_args", "writeDiagnostic requires payload.", null)
            return
        }
        val file = diagnosticsFile()
        val existing = if (file.exists()) file.readText() else "[]"
        val json = org.json.JSONArray(existing)
        json.put(JSONObject(payload))
        val capped = org.json.JSONArray()
        val start = (json.length() - 80).coerceAtLeast(0)
        for (index in start until json.length()) capped.put(json.get(index))
        file.writeText(capped.toString())
        result.success(null)
    }

    private fun clearDiagnostics(result: MethodChannel.Result) {
        diagnosticsFile().delete()
        result.success(null)
    }

    private fun diagnosticsFile(): File {
        return File(filesDir, "diagnostics.json")
    }

    @Deprecated("Deprecated in Android API, but still supported by FlutterActivity.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != documentPickerRequestCode) {
            super.onActivityResult(requestCode, resultCode, data)
            return
        }
        val result = pendingDocumentPickerResult ?: return
        pendingDocumentPickerResult = null
        if (resultCode != RESULT_OK || data?.data == null) {
            result.success(mapOf("ok" to false, "message" to "Document selection cancelled."))
            return
        }
        try {
            result.success(readPickedDocument(data.data!!))
        } catch (error: Throwable) {
            result.success(
                mapOf(
                    "ok" to false,
                    "message" to (error.message ?: "Unable to read selected document."),
                ),
            )
        }
    }

    private fun pickDocument(result: MethodChannel.Result) {
        if (pendingDocumentPickerResult != null) {
            result.success(mapOf("ok" to false, "message" to "Document picker is already open."))
            return
        }
        pendingDocumentPickerResult = result
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(
                Intent.EXTRA_MIME_TYPES,
                arrayOf(
                    "application/pdf",
                    "text/plain",
                    "text/markdown",
                    "text/x-markdown",
                    "application/json",
                    "text/csv",
                ),
            )
        }
        try {
            startActivityForResult(intent, documentPickerRequestCode)
        } catch (error: Throwable) {
            pendingDocumentPickerResult = null
            result.success(
                mapOf(
                    "ok" to false,
                    "message" to (error.message ?: "Unable to open document picker."),
                ),
            )
        }
    }

    private fun readPickedDocument(uri: Uri): Map<String, Any?> {
        val metadata = documentMetadata(uri)
        val mimeType = contentResolver.getType(uri) ?: metadata.second ?: "application/octet-stream"
        val bytes = readUriBytes(uri)
        val preview = if (isTextDocument(mimeType, metadata.first)) {
            String(bytes, StandardCharsets.UTF_8)
                .replace(Regex("\\s+"), " ")
                .trim()
                .take(3000)
        } else {
            ""
        }
        return mapOf(
            "ok" to true,
            "document" to mapOf(
                "name" to metadata.first,
                "mimeType" to mimeType,
                "sizeBytes" to bytes.size,
                "sourceUri" to uri.toString(),
                "textPreview" to preview,
            ),
        )
    }

    private fun documentMetadata(uri: Uri): Pair<String, String?> {
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                val name = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                val size = if (sizeIndex >= 0) cursor.getLong(sizeIndex) else -1L
                if (size > maxPickedDocumentBytes) {
                    error("Document is larger than 8 MB.")
                }
                return Pair(name?.takeIf { it.isNotBlank() } ?: "document", contentResolver.getType(uri))
            }
        }
        return Pair(uri.lastPathSegment ?: "document", contentResolver.getType(uri))
    }

    private fun readUriBytes(uri: Uri): ByteArray {
        val input = contentResolver.openInputStream(uri) ?: error("Unable to open selected document.")
        input.use { stream ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val read = stream.read(buffer)
                if (read <= 0) break
                total += read
                if (total > maxPickedDocumentBytes) error("Document is larger than 8 MB.")
                output.write(buffer, 0, read)
            }
            return output.toByteArray()
        }
    }

    private fun isTextDocument(mimeType: String, name: String): Boolean {
        val lowerName = name.lowercase(Locale.US)
        return mimeType.startsWith("text/") ||
            mimeType == "application/json" ||
            lowerName.endsWith(".md") ||
            lowerName.endsWith(".markdown") ||
            lowerName.endsWith(".json") ||
            lowerName.endsWith(".csv")
    }

    private fun readModelCache(result: MethodChannel.Result) {
        val json = JSONObject()
        modelCacheDir()
            .listFiles()
            ?.filter { file -> file.extension == "json" }
            ?.forEach { file ->
                try {
                    val payload = JSONObject(file.readText())
                    val provider = payload.optString("provider", file.nameWithoutExtension)
                    if (provider.isNotBlank()) json.put(provider, payload)
                } catch (_: Throwable) {
                    // Ignore corrupt cache entries; fresh fetch can rebuild them.
                }
            }
        result.success(json.toString())
    }

    private fun writeModelCache(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<*, *>
        val provider = map?.get("provider")?.toString()?.takeIf { it.isNotBlank() }
        val payload = map?.get("payload")?.toString()?.takeIf { it.isNotBlank() }
        if (provider == null || payload == null) {
            result.error("bad_args", "writeModelCache requires provider and payload.", null)
            return
        }
        File(modelCacheDir(), "${safeFileName(provider)}.json").writeText(payload)
        result.success(null)
    }

    private fun clearModelCache(result: MethodChannel.Result) {
        modelCacheDir().deleteRecursively()
        result.success(null)
    }

    private fun modelCacheDir(): File {
        return File(filesDir, "model_cache").apply { mkdirs() }
    }

    private fun listChatThreads(result: MethodChannel.Result) {
        val items = chatHistoryDir()
            .listFiles()
            ?.filter { file -> file.extension == "json" }
            ?.mapNotNull { file ->
                try {
                    JSONObject(file.readText()).getJSONObject("meta")
                } catch (_: Throwable) {
                    null
                }
            }
            ?: emptyList()
        result.success(items.joinToString(prefix = "[", postfix = "]") { it.toString() })
    }

    private fun readChatThread(arguments: Any?, result: MethodChannel.Result) {
        val id = (arguments as? Map<*, *>)?.get("id")?.toString()?.takeIf { it.isNotBlank() }
        if (id == null) {
            result.error("bad_args", "readThread requires id.", null)
            return
        }
        val file = File(chatHistoryDir(), "${safeFileName(id)}.json")
        result.success(if (file.exists()) file.readText() else null)
    }

    private fun writeChatThread(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<*, *>
        val id = map?.get("id")?.toString()?.takeIf { it.isNotBlank() }
        val payload = map?.get("payload")?.toString()
        if (id == null || payload.isNullOrBlank()) {
            result.error("bad_args", "writeThread requires id and payload.", null)
            return
        }
        File(chatHistoryDir(), "${safeFileName(id)}.json").writeText(payload)
        result.success(null)
    }

    private fun deleteChatThread(arguments: Any?, result: MethodChannel.Result) {
        val id = (arguments as? Map<*, *>)?.get("id")?.toString()?.takeIf { it.isNotBlank() }
        if (id == null) {
            result.error("bad_args", "deleteThread requires id.", null)
            return
        }
        File(chatHistoryDir(), "${safeFileName(id)}.json").delete()
        result.success(null)
    }

    private fun clearAllChatThreads(result: MethodChannel.Result) {
        chatHistoryDir().deleteRecursively()
        result.success(null)
    }

    private fun chatHistoryDir(): File {
        return File(filesDir, "chat_history").apply { mkdirs() }
    }

    private fun saveProviderKey(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<*, *>
        val provider = map?.get("provider")?.toString()?.takeIf { it.isNotBlank() }
        val key = map?.get("key")?.toString()
        if (provider == null || key.isNullOrBlank()) {
            result.error("bad_args", "saveProviderKey requires provider and key.", null)
            return
        }
        val payload = JSONObject()
            .put("provider", provider)
            .put("key", key)
            .put("createdAt", map["createdAt"]?.toString() ?: "")
            .put("lastUsedAt", map["lastUsedAt"]?.toString() ?: "")
            .toString()
        val encrypted = encryptProviderPayload(payload)
        securePrefs().edit().putString(provider, encrypted).apply()
        result.success(null)
    }

    private fun readProviderKey(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<*, *>
        val provider = map?.get("provider")?.toString()?.takeIf { it.isNotBlank() }
        if (provider == null) {
            result.error("bad_args", "readProviderKey requires provider.", null)
            return
        }
        val stored = securePrefs().getString(provider, null)
        if (stored.isNullOrBlank()) {
            result.success(null)
            return
        }
        try {
            val decoded = JSONObject(decryptProviderPayload(stored))
            result.success(
                mapOf(
                    "provider" to decoded.optString("provider", provider),
                    "key" to decoded.optString("key", ""),
                    "createdAt" to decoded.optString("createdAt", ""),
                    "lastUsedAt" to decoded.optString("lastUsedAt", ""),
                ),
            )
        } catch (error: Throwable) {
            result.error("decrypt_failed", error.message ?: "Unable to decrypt provider key.", null)
        }
    }

    private fun deleteProviderKey(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<*, *>
        val provider = map?.get("provider")?.toString()?.takeIf { it.isNotBlank() }
        if (provider == null) {
            result.error("bad_args", "deleteProviderKey requires provider.", null)
            return
        }
        securePrefs().edit().remove(provider).apply()
        result.success(null)
    }

    private fun securePrefs() = getSharedPreferences(providerPrefsName, MODE_PRIVATE)

    private fun encryptProviderPayload(payload: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, providerSecretKey())
        val encrypted = cipher.doFinal(payload.toByteArray(StandardCharsets.UTF_8))
        return JSONObject()
            .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .toString()
    }

    private fun decryptProviderPayload(payload: String): String {
        val json = JSONObject(payload)
        val iv = Base64.decode(json.getString("iv"), Base64.NO_WRAP)
        val ciphertext = Base64.decode(json.getString("ciphertext"), Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, providerSecretKey(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
    }

    private fun providerSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(androidKeyAlias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            androidKeyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    @Suppress("UNCHECKED_CAST")
    private fun renderHtmlToPdf(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<String, Any?>
        val html = map?.get("html")?.toString()
        val artifactId = map?.get("artifactId")?.toString()?.takeIf { it.isNotBlank() }
            ?: "aurict-render-${System.currentTimeMillis()}"
        val fileName = safeFileName(
            map?.get("fileName")?.toString()?.takeIf { it.isNotBlank() }
                ?: "$artifactId.pdf",
        )
        if (html.isNullOrBlank()) {
            result.error("bad_args", "renderHtmlToPdf requires html.", null)
            return
        }

        val outputFile = renderedArtifactFile(artifactId, fileName)
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = false
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                view.post {
                    writeWebViewPdf(view, outputFile, result)
                }
            }
        }
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    private fun writeWebViewPdf(
        webView: WebView,
        outputFile: File,
        result: MethodChannel.Result,
    ) {
        val pageWidth = 595
        val pageHeight = 842
        val contentHeight = maxOf(
            pageHeight,
            (webView.contentHeight * webView.scale).toInt().coerceAtLeast(pageHeight),
        )

        try {
            webView.measure(
                View.MeasureSpec.makeMeasureSpec(pageWidth, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(contentHeight, View.MeasureSpec.EXACTLY),
            )
            webView.layout(0, 0, pageWidth, contentHeight)

            val document = PdfDocument()
            var pageTop = 0
            var pageNumber = 1
            while (pageTop < contentHeight) {
                val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                val page = document.startPage(pageInfo)
                page.canvas.translate(0f, -pageTop.toFloat())
                webView.draw(page.canvas)
                document.finishPage(page)
                pageTop += pageHeight
                pageNumber++
            }

            FileOutputStream(outputFile).use { stream ->
                document.writeTo(stream)
            }
            document.close()
            val bytes = outputFile.readBytes()
            webView.destroy()
            result.success(bytes)
        } catch (error: Throwable) {
            webView.destroy()
            result.error("pdf_render_failed", error.message ?: "Android PDF render failed.", null)
        }
    }

    private fun clearArtifactCache(result: MethodChannel.Result) {
        val renderDeleted = File(cacheDir, "aurict_render").deleteRecursively()
        val exportDeleted = File(cacheDir, "aurict_exports").deleteRecursively()
        result.success(
            mapOf(
                "cleared" to true,
                "renderCacheDeleted" to renderDeleted,
                "exportCacheDeleted" to exportDeleted,
            ),
        )
    }

    private fun saveArtifact(arguments: Any?, result: MethodChannel.Result) {
        val payload = artifactPayload(arguments)
        if (payload == null) {
            result.success(
                mapOf(
                    "saved" to false,
                    "message" to "Artifact save requires fileName, mimeType, and bytes.",
                ),
            )
            return
        }

        try {
            val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveToDownloads(payload)
            } else {
                saveToAppDownloads(payload)
            }
            result.success(
                mapOf(
                    "saved" to true,
                    "artifactId" to payload.artifactId,
                    "uri" to uri.toString(),
                    "message" to "Saved to device downloads.",
                ),
            )
        } catch (error: Throwable) {
            result.success(
                mapOf(
                    "saved" to false,
                    "artifactId" to payload.artifactId,
                    "message" to (error.message ?: "Android save failed."),
                ),
            )
        }
    }

    private fun shareArtifact(arguments: Any?, result: MethodChannel.Result) {
        val payload = artifactPayload(arguments)
        if (payload == null) {
            result.success(
                mapOf(
                    "shared" to false,
                    "message" to "Artifact share requires fileName, mimeType, and bytes.",
                ),
            )
            return
        }

        try {
            val dir = File(cacheDir, "aurict_exports").apply { mkdirs() }
            val file = File(dir, payload.fileName)
            FileOutputStream(file).use { it.write(payload.bytes) }
            val uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = payload.mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "Share ${payload.fileName}"))
            result.success(
                mapOf(
                    "shared" to true,
                    "artifactId" to payload.artifactId,
                    "uri" to uri.toString(),
                    "message" to "Android share sheet opened.",
                ),
            )
        } catch (error: Throwable) {
            result.success(
                mapOf(
                    "shared" to false,
                    "artifactId" to payload.artifactId,
                    "message" to (error.message ?: "Android share failed."),
                ),
            )
        }
    }

    private fun openArtifact(arguments: Any?, result: MethodChannel.Result) {
        val payload = artifactPayload(arguments)
        if (payload == null) {
            result.success(
                mapOf(
                    "opened" to false,
                    "message" to "Artifact open requires fileName, mimeType, and bytes or cached artifact.",
                ),
            )
            return
        }
        try {
            val dir = File(cacheDir, "aurict_exports").apply { mkdirs() }
            val file = File(dir, payload.fileName)
            FileOutputStream(file).use { it.write(payload.bytes) }
            val uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, payload.mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "Open ${payload.fileName}"))
            result.success(
                mapOf(
                    "opened" to true,
                    "artifactId" to payload.artifactId,
                    "uri" to uri.toString(),
                    "message" to "Android open sheet opened.",
                ),
            )
        } catch (error: Throwable) {
            result.success(
                mapOf(
                    "opened" to false,
                    "artifactId" to payload.artifactId,
                    "message" to (error.message ?: "Android open failed."),
                ),
            )
        }
    }

    private fun deleteArtifact(arguments: Any?, result: MethodChannel.Result) {
        val map = arguments as? Map<*, *>
        val artifactId = map?.get("artifactId")?.toString()?.takeIf { it.isNotBlank() }
        val fileName = map?.get("fileName")?.toString()?.takeIf { it.isNotBlank() }
        if (artifactId == null && fileName == null) {
            result.success(mapOf("deleted" to false, "message" to "deleteArtifact requires artifactId or fileName."))
            return
        }
        val deleted = deleteArtifactFiles(artifactId, fileName)
        result.success(
            mapOf(
                "deleted" to true,
                "artifactId" to (artifactId ?: fileName),
                "deletedFiles" to deleted,
                "message" to "Deleted $deleted cached artifact file(s).",
            ),
        )
    }

    private fun saveToDownloads(payload: ArtifactPayload): Uri {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, payload.fileName)
            put(MediaStore.Downloads.MIME_TYPE, payload.mimeType)
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Aurict")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = applicationContext.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("Unable to create Downloads entry.")
        val outputStream = resolver.openOutputStream(uri)
            ?: error("Unable to open Downloads output stream.")
        outputStream.use { stream ->
            stream.write(payload.bytes)
        }
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri
    }

    private fun saveToAppDownloads(payload: ArtifactPayload): Uri {
        val dir = File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Aurict")
            .apply { mkdirs() }
        val file = File(dir, payload.fileName)
        FileOutputStream(file).use { it.write(payload.bytes) }
        return Uri.fromFile(file)
    }

    @Suppress("UNCHECKED_CAST")
    private fun artifactPayload(arguments: Any?): ArtifactPayload? {
        val map = arguments as? Map<String, Any?> ?: return null
        val fileName = safeFileName(map["fileName"]?.toString() ?: return null)
        val mimeType = map["mimeType"]?.toString()?.takeIf { it.isNotBlank() }
            ?: "application/octet-stream"
        val artifactId = map["artifactId"]?.toString()?.takeIf { it.isNotBlank() }
            ?: fileName
        val bytes = (map["bytes"] as? ByteArray)?.takeIf { it.isNotEmpty() }
            ?: cachedArtifactBytes(artifactId, fileName)
            ?: return null
        return ArtifactPayload(artifactId, fileName, mimeType, bytes)
    }

    private fun renderedArtifactFile(artifactId: String, fileName: String): File {
        val dir = File(cacheDir, "aurict_render").apply { mkdirs() }
        return File(dir, "${safeFileName(artifactId)}-$fileName")
    }

    private fun cachedArtifactBytes(artifactId: String, fileName: String): ByteArray? {
        val exact = renderedArtifactFile(artifactId, fileName)
        if (exact.exists()) return exact.readBytes()
        val dir = File(cacheDir, "aurict_render")
        return dir
            .listFiles()
            ?.firstOrNull { file ->
                file.name.startsWith("${safeFileName(artifactId)}-") ||
                    file.name.endsWith("-$fileName")
            }
            ?.readBytes()
    }

    private fun deleteArtifactFiles(artifactId: String?, fileName: String?): Int {
        val safeId = artifactId?.let { safeFileName(it) }
        val safeName = fileName?.let { safeFileName(it) }
        var deleted = 0
        listOf(File(cacheDir, "aurict_render"), File(cacheDir, "aurict_exports"))
            .forEach { dir ->
                dir.listFiles()?.forEach { file ->
                    val matches =
                        (safeId != null && file.name.startsWith("$safeId-")) ||
                            (safeName != null && file.name == safeName) ||
                            (safeName != null && file.name.endsWith("-$safeName"))
                    if (matches && file.delete()) deleted++
                }
            }
        return deleted
    }

    private fun safeFileName(value: String): String {
        val cleaned = value
            .lowercase(Locale.US)
            .replace(Regex("[^a-z0-9._-]+"), "-")
            .trim('-', '.', '_')
        return cleaned.ifBlank { "aurict-artifact.pdf" }
    }

    private data class ArtifactPayload(
        val artifactId: String,
        val fileName: String,
        val mimeType: String,
        val bytes: ByteArray,
    )
}
