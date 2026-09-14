package com.nthreader.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

/** Persists web-rendered shelf snapshots for the native launcher widget. */
public final class WidgetBridge {
    private static final int MAX_MODEL_CHARS = 12_000_000;
    private static final int MAX_VARIANT_CHARS = 24_000_000;
    private final MainActivity activity;

    WidgetBridge(MainActivity activity) { this.activity = activity; }

    @JavascriptInterface public boolean isAvailable() { return true; }

    /**
     * Returns the launcher widths that the browser renderer should capture.
     * Both bounds are included because Android may use a different width after
     * a rotation without reopening the app.
     */
    @JavascriptInterface public synchronized String getWidgetCaptureWidths() {
        LinkedHashSet<Integer> widths = new LinkedHashSet<>();
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(activity);
            int[] ids = manager.getAppWidgetIds(
                    new ComponentName(activity, BookshelfWidgetProvider.class));
            for (int id : ids) {
                Bundle options = manager.getAppWidgetOptions(id);
                addCaptureWidth(widths,
                        options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0));
                addCaptureWidth(widths,
                        options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0));
                if (widths.size() >= 8) break;
            }
        } catch (Exception ignored) {}
        JSONArray result = new JSONArray();
        for (int width : widths) result.put(width);
        return result.toString();
    }

    @JavascriptInterface public synchronized void updateShelf(String json) {
        if (json == null || json.length() > MAX_MODEL_CHARS) return;
        File target = BookshelfWidgetProvider.snapshotFile(activity);
        try {
            JSONObject incoming = new JSONObject(json);
            JSONObject existing = readJson(target);
            // Opening the app sends its fast native fallback first. Never let
            // that replace a good photograph of the same bookcase while the
            // next high-resolution capture is still being prepared.
            if (!hasVariants(incoming) && hasVariants(existing)
                    && incoming.optInt("activeBookcase", -1)
                    == existing.optInt("activeBookcase", -2)) {
                return;
            }
            writeAtomically(target, incoming.toString());
            BookshelfWidgetProvider.updateAll(activity);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface public synchronized boolean beginShelfCapture(
            String payloadJson, String captureId, int total) {
        if (payloadJson == null || payloadJson.length() > MAX_MODEL_CHARS
                || !validCaptureId(captureId) || total < 1 || total > 8) return false;
        try {
            JSONObject staging = new JSONObject(payloadJson);
            staging.put("captureId", captureId);
            staging.put("captureTotal", total);
            staging.put("variants", new JSONArray());
            writeAtomically(captureFile(), staging.toString());
            return true;
        } catch (Exception ignored) { return false; }
    }

    @JavascriptInterface public synchronized boolean addShelfCaptureVariant(
            String captureId, int index, int total, String variantJson) {
        if (!validCaptureId(captureId) || variantJson == null
                || variantJson.length() > MAX_VARIANT_CHARS) return false;
        try {
            File stagingFile = captureFile();
            JSONObject staging = readJson(stagingFile);
            if (!captureId.equals(staging.optString("captureId"))
                    || total != staging.optInt("captureTotal") || index < 0 || index >= total) return false;
            JSONArray variants = staging.optJSONArray("variants");
            if (variants == null || index != variants.length()) return false;

            JSONObject variant = new JSONObject(variantJson);
            materializeVariantArt(captureId, index, variant);
            variants.put(variant);
            writeAtomically(stagingFile, staging.toString());

            if (variants.length() == total) {
                staging.remove("captureId");
                staging.remove("captureTotal");
                writeAtomically(BookshelfWidgetProvider.snapshotFile(activity), staging.toString());
                stagingFile.delete();
                removeUnusedVariantFiles(variants);
                BookshelfWidgetProvider.updateAll(activity);
            }
            return true;
        } catch (Exception ignored) { return false; }
    }

    private File captureFile() {
        return new File(activity.getFilesDir(), "widget-shelf-capture.json");
    }

    private void materializeVariantArt(String captureId, int index, JSONObject variant) throws Exception {
        String dataUrl = variant.optString("art", "");
        int comma = dataUrl.indexOf(',');
        if (comma < 0 || !dataUrl.substring(0, comma).contains("base64")) {
            throw new IllegalArgumentException("Variant artwork was not encoded.");
        }
        byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
        String filename = "widget-shelf-art-" + captureId + "-" + index + ".webp";
        writeBytesAtomically(new File(activity.getFilesDir(), filename), bytes);
        variant.remove("art");
        variant.put("artFile", filename);
    }

    private void removeUnusedVariantFiles(JSONArray variants) {
        Set<String> keep = new HashSet<>();
        for (int i = 0; i < variants.length(); i++) {
            JSONObject variant = variants.optJSONObject(i);
            if (variant != null) keep.add(variant.optString("artFile", ""));
        }
        File[] files = activity.getFilesDir().listFiles((dir, name) ->
                name.startsWith("widget-shelf-art-") && name.endsWith(".webp"));
        if (files == null) return;
        for (File file : files) if (!keep.contains(file.getName())) file.delete();
    }

    private static boolean validCaptureId(String id) {
        return id != null && id.matches("[A-Za-z0-9_-]{1,80}");
    }

    private static void addCaptureWidth(Set<Integer> widths, int width) {
        if (width > 0 && widths.size() < 8) widths.add(Math.max(180, Math.min(900, width)));
    }

    private static boolean hasVariants(JSONObject value) {
        JSONArray variants = value == null ? null : value.optJSONArray("variants");
        return variants != null && variants.length() > 0;
    }

    private static JSONObject readJson(File file) {
        try {
            if (file == null || !file.isFile()) return new JSONObject();
            return new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
        } catch (Exception ignored) { return new JSONObject(); }
    }

    private void writeAtomically(File target, String contents) throws Exception {
        writeBytesAtomically(target, contents.getBytes(StandardCharsets.UTF_8));
    }

    private void writeBytesAtomically(File target, byte[] bytes) throws Exception {
        File temporary = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary, false)) {
            output.write(bytes);
            output.flush();
        }
        if (!temporary.renameTo(target)) {
            try (FileOutputStream fallback = new FileOutputStream(target, false)) {
                fallback.write(bytes);
                fallback.flush();
            }
            temporary.delete();
        }
    }
}
