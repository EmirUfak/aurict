# Aurict Mobile release shrinker rules.
# Keep the Flutter embedding and generated plugin registrant reachable from the
# Android framework while allowing R8 to optimize ordinary application code.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.plugins.GeneratedPluginRegistrant { *; }

# Native entry point and MethodChannel handlers are referenced by Android/Flutter
# lifecycle reflection and must keep their public shape.
-keep class com.aurict.mobile.MainActivity { *; }

# Firebase/Auth/Google Play Services rely on generated components and runtime
# metadata. Keep public API surfaces while R8 still shrinks unused internals.
-keep class com.google.firebase.components.ComponentRegistrar { *; }
-keep class * implements com.google.firebase.components.ComponentRegistrar { *; }
-keep class com.google.firebase.provider.FirebaseInitProvider { *; }
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.common.api.** { *; }

# Flutter references Play Core deferred-component classes even when this app
# does not use deferred components. Keep R8 strict while suppressing those
# optional dependency warnings.
-dontwarn com.google.android.play.core.splitcompat.SplitCompatApplication
-dontwarn com.google.android.play.core.splitinstall.SplitInstallException
-dontwarn com.google.android.play.core.splitinstall.SplitInstallManager
-dontwarn com.google.android.play.core.splitinstall.SplitInstallManagerFactory
-dontwarn com.google.android.play.core.splitinstall.SplitInstallRequest$Builder
-dontwarn com.google.android.play.core.splitinstall.SplitInstallRequest
-dontwarn com.google.android.play.core.splitinstall.SplitInstallSessionState
-dontwarn com.google.android.play.core.splitinstall.SplitInstallStateUpdatedListener
-dontwarn com.google.android.play.core.tasks.OnFailureListener
-dontwarn com.google.android.play.core.tasks.OnSuccessListener
-dontwarn com.google.android.play.core.tasks.Task

# Cryptography/signing classes are small and security-sensitive; keep names to
# make stack traces actionable and avoid accidental reflective breakage.
-keepnames class org.bouncycastle.** { *; }
-keepnames class javax.crypto.** { *; }
-keepnames class java.security.** { *; }

# Preserve annotations used by AndroidX, Firebase, and generated code.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,Signature,InnerClasses,EnclosingMethod
