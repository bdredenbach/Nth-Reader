package com.nthreader.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

public final class NarrationStore {
    public static final class Unit {
        public final String text;
        public final double progress;
        public final int pageIndex;
        Unit(String text, double progress, int pageIndex) {
            this.text = text; this.progress = progress; this.pageIndex = pageIndex;
        }
        JSONObject json() {
            JSONObject out = new JSONObject();
            try { out.put("text", text).put("progress", progress).put("pageIndex", pageIndex); }
            catch (Exception ignored) {}
            return out;
        }
    }

    private static final List<Unit> units = new ArrayList<>();
    public static String bookId = "", title = "Nth Reader", author = "", error = "";
    public static float rate = 1f;
    public static int index = 0;
    public static boolean active = false, playing = false, paused = false, finished = false;
    private static final String FILE_NAME = "narration-session.json";
    private NarrationStore() {}

    public static synchronized void begin(String metadata) throws Exception {
        JSONObject json = new JSONObject(metadata == null ? "{}" : metadata);
        units.clear();
        bookId = json.optString("bookId", "");
        title = json.optString("title", "Nth Reader");
        author = json.optString("author", "");
        rate = (float) Math.max(.6, Math.min(1.6, json.optDouble("rate", 1)));
        index = 0; active = false; playing = false; paused = false; finished = false; error = "";
    }

    public static synchronized void append(String batch) throws Exception {
        JSONArray array = new JSONArray(batch == null ? "[]" : batch);
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null) continue;
            String text = item.optString("text", "").replaceAll("\\s+", " ").trim();
            if (!text.isEmpty()) units.add(new Unit(text,
                    Math.max(0, Math.min(1, item.optDouble("progress", 0))),
                    item.optInt("pageIndex", -1)));
        }
    }

    public static synchronized int size() { return units.size(); }
    public static synchronized Unit current() {
        return units.isEmpty() ? null : units.get(Math.max(0, Math.min(index, units.size() - 1)));
    }
    public static synchronized boolean move(int delta) {
        if (units.isEmpty()) return false;
        index = Math.max(0, Math.min(units.size() - 1, index + delta));
        finished = false;
        return true;
    }
    public static synchronized boolean advance() {
        if (index + 1 >= units.size()) return false;
        index++; return true;
    }
    public static synchronized void seek(double progress) {
        if (units.isEmpty()) return;
        double target = Math.max(0, Math.min(1, progress));
        int best = 0;
        for (int i = 0; i < units.size(); i++) {
            if (units.get(i).progress >= target) { best = i; break; }
            best = i;
        }
        index = best; finished = false;
    }

    public static synchronized String stateJson() {
        JSONObject json = new JSONObject();
        Unit unit = current();
        try {
            json.put("bookId", bookId).put("title", title).put("active", active)
                    .put("playing", playing).put("paused", paused).put("finished", finished)
                    .put("index", index).put("count", units.size()).put("rate", rate)
                    .put("error", error).put("text", unit == null ? "" : unit.text)
                    .put("progress", unit == null ? 0 : unit.progress)
                    .put("pageIndex", unit == null ? -1 : unit.pageIndex);
        } catch (Exception ignored) {}
        return json.toString();
    }

    public static synchronized void save(Context context) {
        JSONObject root = new JSONObject();
        JSONArray items = new JSONArray();
        try {
            root.put("bookId", bookId).put("title", title).put("author", author)
                    .put("rate", rate).put("index", index).put("units", items);
            for (Unit unit : units) items.put(unit.json());
            Files.write(new File(context.getFilesDir(), FILE_NAME).toPath(),
                    root.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) { /* narration still works in memory */ }
    }

    public static synchronized void load(Context context) {
        if (!units.isEmpty()) return;
        File file = new File(context.getFilesDir(), FILE_NAME);
        if (!file.exists()) return;
        try {
            JSONObject root = new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
            begin(root.toString());
            append(root.optJSONArray("units") == null ? "[]" : root.getJSONArray("units").toString());
            index = Math.max(0, Math.min(root.optInt("index", 0), Math.max(0, units.size() - 1)));
        } catch (Exception ignored) { units.clear(); }
    }

    public static synchronized void clear(Context context) {
        units.clear(); active = false; playing = false; paused = false; finished = false; error = "";
        try { Files.deleteIfExists(new File(context.getFilesDir(), FILE_NAME).toPath()); }
        catch (Exception ignored) {}
    }
}
