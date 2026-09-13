package com.nthreader.app;

import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Persists the web shelf's lightweight snapshot for the native launcher widget. */
public final class WidgetBridge {
    private final MainActivity activity;

    WidgetBridge(MainActivity activity) { this.activity = activity; }

    @JavascriptInterface public boolean isAvailable() { return true; }

    @JavascriptInterface public synchronized void updateShelf(String json) {
        if (json == null || json.length() > 12_000_000) return;
        File target = BookshelfWidgetProvider.snapshotFile(activity);
        File temporary = new File(activity.getFilesDir(), "widget-shelf.tmp");
        try (FileOutputStream output = new FileOutputStream(temporary, false)) {
            output.write(json.getBytes(StandardCharsets.UTF_8));
            output.flush();
            if (!temporary.renameTo(target)) {
                try (FileOutputStream fallback = new FileOutputStream(target, false)) {
                    fallback.write(json.getBytes(StandardCharsets.UTF_8));
                }
                temporary.delete();
            }
            BookshelfWidgetProvider.updateAll(activity);
        } catch (Exception ignored) { temporary.delete(); }
    }
}
