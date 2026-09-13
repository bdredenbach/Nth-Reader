package com.nthreader.app;

import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileOutputStream;

/** Receives a generated backup in small WebView-safe chunks, then opens Android's Save picker. */
public final class BackupBridge {
    private final MainActivity activity;
    private File pendingFile;
    private FileOutputStream output;
    private String filename = "nth-reader-backup.nthbackup";
    private String mime = "application/zip";

    BackupBridge(MainActivity activity) { this.activity = activity; }

    @JavascriptInterface public boolean isAvailable() { return true; }

    @JavascriptInterface public synchronized boolean beginExport(String requestedName, String requestedMime) {
        cancel();
        try {
            filename = sanitize(requestedName);
            mime = requestedMime == null || requestedMime.isEmpty() ? "application/zip" : requestedMime;
            pendingFile = new File(activity.getCacheDir(), "pending-nth-reader-backup.bin");
            output = new FileOutputStream(pendingFile, false);
            return true;
        } catch (Exception error) { cancel(); return false; }
    }

    @JavascriptInterface public synchronized boolean appendChunk(String base64) {
        if (output == null || base64 == null) return false;
        try {
            output.write(Base64.decode(base64, Base64.DEFAULT));
            return true;
        } catch (Exception error) { cancel(); return false; }
    }

    @JavascriptInterface public synchronized void finishExport() {
        if (output == null || pendingFile == null) return;
        try {
            output.flush(); output.close(); output = null;
            File ready = pendingFile; pendingFile = null;
            activity.chooseBackupDestination(ready, filename, mime);
        } catch (Exception error) { cancel(); activity.reportBackupResult(false, "Backup could not be prepared."); }
    }

    synchronized void cancel() {
        try { if (output != null) output.close(); } catch (Exception ignored) {}
        output = null;
        if (pendingFile != null) pendingFile.delete();
        pendingFile = null;
    }

    private String sanitize(String name) {
        String value = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (value.isEmpty()) value = "nth-reader-backup.nthbackup";
        return value.length() > 180 ? value.substring(value.length() - 180) : value;
    }
}
