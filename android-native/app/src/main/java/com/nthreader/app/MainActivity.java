package com.nthreader.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;

public final class MainActivity extends Activity implements NarrationEvents.Sink {
    private static final String APP_URL = "https://bdredenbach.github.io/Nth-Reader/";
    private static final int FILE_CHOOSER = 42;
    private static final int BACKUP_SAVE = 43;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private File pendingBackupFile;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new NarrationBridge(this), "NthNativeSpeech");
        webView.addJavascriptInterface(new BackupBridge(this), "NthNativeBackup");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                boolean internal = "https".equals(uri.getScheme())
                        && "bdredenbach.github.io".equals(uri.getHost())
                        && uri.getPath() != null && uri.getPath().startsWith("/Nth-Reader/");
                if (internal) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (ActivityNotFoundException ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                        FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent;
                try { intent = params.createIntent(); }
                catch (Exception error) { intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*"); }
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(intent, FILE_CHOOSER); }
                catch (ActivityNotFoundException error) {
                    fileCallback.onReceiveValue(null); fileCallback = null; return false;
                }
                return true;
            }
        });
        webView.loadUrl(APP_URL);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        }
    }

    @Override protected void onResume() {
        super.onResume();
        NarrationEvents.setSink(this);
        onNarrationState(NarrationStore.stateJson());
    }

    @Override protected void onPause() {
        NarrationEvents.setSink(null);
        super.onPause();
    }

    @Override public void onNarrationState(String json) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(
                    "window.NthNativeNarrator&&window.NthNativeNarrator._receive(" + JSONObject.quote(json) + ")", null);
        });
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == BACKUP_SAVE) {
            boolean saved = false;
            String message = "Backup save was cancelled.";
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingBackupFile != null) {
                try (InputStream input = new java.io.FileInputStream(pendingBackupFile);
                     OutputStream output = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (output == null) throw new IllegalStateException("No destination was available.");
                    byte[] buffer = new byte[128 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.flush(); saved = true; message = "Backup saved to your chosen location.";
                } catch (Exception error) { message = "Android could not save the backup."; }
            }
            if (pendingBackupFile != null) pendingBackupFile.delete();
            pendingBackupFile = null;
            reportBackupResult(saved, message);
            return;
        }
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                result = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < result.length; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) result = new Uri[]{data.getData()};
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    void chooseBackupDestination(File file, String filename, String mime) {
        runOnUiThread(() -> {
            pendingBackupFile = file;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mime == null || mime.isEmpty() ? "application/zip" : mime)
                    .putExtra(Intent.EXTRA_TITLE, filename == null ? "nth-reader-backup.nthbackup" : filename);
            try { startActivityForResult(intent, BACKUP_SAVE); }
            catch (ActivityNotFoundException error) {
                if (pendingBackupFile != null) pendingBackupFile.delete();
                pendingBackupFile = null;
                reportBackupResult(false, "No Android file saver is available.");
            }
        });
    }

    void reportBackupResult(boolean success, String message) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String script = "window.dispatchEvent(new CustomEvent('nth-native-backup-result',{detail:{success:"
                    + success + ",message:" + JSONObject.quote(message) + "}}))";
            webView.evaluateJavascript(script, null);
        });
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        NarrationEvents.setSink(null);
        if (pendingBackupFile != null) pendingBackupFile.delete();
        if (webView != null) {
            webView.removeJavascriptInterface("NthNativeSpeech");
            webView.removeJavascriptInterface("NthNativeBackup");
            webView.destroy();
        }
        super.onDestroy();
    }
}
