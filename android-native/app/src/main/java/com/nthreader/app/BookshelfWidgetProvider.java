package com.nthreader.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Bundle;
import android.util.Base64;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/** A responsive, launcher-safe rendering of the currently selected bookcase. */
public final class BookshelfWidgetProvider extends AppWidgetProvider {
    private static final int MAX_BITMAP_BYTES = 760_000;

    static File snapshotFile(Context context) {
        return new File(context.getFilesDir(), "widget-shelf.json");
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BookshelfWidgetProvider.class));
        for (int id : ids) updateWidget(context, manager, id);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateWidget(context, manager, id);
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                                    int appWidgetId, Bundle options) {
        updateWidget(context, manager, appWidgetId);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        int widthDp = Math.max(130, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250));
        int heightDp = Math.max(70, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 220));
        float density = context.getResources().getDisplayMetrics().density;
        int rawWidth = Math.max(180, Math.round(widthDp * density));
        int rawHeight = Math.max(110, Math.round(heightDp * density));
        double scale = Math.min(1d, Math.sqrt(MAX_BITMAP_BYTES / (rawWidth * (double) rawHeight * 2d)));
        int width = Math.max(180, (int) Math.round(rawWidth * scale));
        int height = Math.max(110, (int) Math.round(rawHeight * scale));

        JSONObject snapshot = readSnapshot(context);
        Bitmap image = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565);
        drawBookcase(context, new Canvas(image), width, height, heightDp, snapshot);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_bookshelf);
        views.setImageViewBitmap(R.id.widget_bookshelf_image, image);
        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 1000 + id, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_bookshelf_image, open);
        manager.updateAppWidget(id, views);
    }

    private static JSONObject readSnapshot(Context context) {
        try {
            File file = snapshotFile(context);
            if (!file.isFile()) return new JSONObject();
            return new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
        } catch (Exception ignored) { return new JSONObject(); }
    }

    private static void drawBookcase(Context context, Canvas canvas, int width, int height,
                                     int heightDp, JSONObject snapshot) {
        Palette palette = Palette.forName(snapshot.optString("shelfTheme", "walnut"));
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        canvas.drawColor(Color.TRANSPARENT);

        float radius = Math.max(12f, width * .045f);
        paint.setShader(new LinearGradient(0, 0, width, height, palette.frameLight, palette.frameDark,
                Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(0, 0, width, height), radius, radius, paint);
        paint.setShader(null);

        float frame = Math.max(9f, width * .045f);
        float header = Math.max(30f, height * .13f);
        RectF inside = new RectF(frame, header, width - frame, height - frame);
        paint.setColor(palette.back);
        canvas.drawRect(inside, paint);

        paint.setColor(Color.argb(100, 255, 210, 135));
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(Math.max(1f, width * .005f));
        canvas.drawRoundRect(new RectF(frame * .55f, frame * .45f, width - frame * .55f,
                height - frame * .45f), radius * .72f, radius * .72f, paint);
        paint.setStyle(Paint.Style.FILL);

        drawHeader(context, canvas, paint, width, header, snapshot, palette);

        int shelfCount = Math.max(1, Math.min(5, Math.round((heightDp - 36f) / 78f)));
        float rowHeight = inside.height() / shelfCount;
        JSONArray allBooks = snapshot.optJSONArray("books");
        JSONArray allDecor = snapshot.optJSONArray("decor");
        boolean hasContent = allBooks != null && allBooks.length() > 0;

        for (int row = 0; row < shelfCount; row++) {
            float top = inside.top + row * rowHeight;
            float bottom = inside.top + (row + 1) * rowHeight;
            paint.setShader(new LinearGradient(0, top, 0, bottom, palette.backTop, palette.back,
                    Shader.TileMode.CLAMP));
            canvas.drawRect(inside.left, top, inside.right, bottom, paint);
            paint.setShader(null);
            drawBooks(canvas, paint, inside.left + 3, inside.right - 3, top, bottom, row, allBooks);
            drawDecor(canvas, paint, inside.left + 3, inside.right - 3, top, bottom, row, allDecor);
            drawShelfLedge(canvas, paint, inside.left - 2, inside.right + 2, bottom, rowHeight, palette);
        }

        if (!hasContent) {
            paint.setColor(Color.rgb(244, 218, 172));
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTextSize(Math.max(12f, Math.min(22f, width * .065f)));
            paint.setFakeBoldText(true);
            canvas.drawText("Open Nth Reader", width / 2f, inside.centerY() - 3, paint);
            paint.setFakeBoldText(false);
            paint.setTextSize(Math.max(8f, width * .034f));
            paint.setColor(Color.rgb(190, 158, 114));
            canvas.drawText("to fill your bookshelf", width / 2f, inside.centerY() + 18, paint);
        }
    }

    private static void drawHeader(Context context, Canvas canvas, Paint paint, int width, float header,
                                   JSONObject snapshot, Palette palette) {
        paint.setShader(new LinearGradient(0, 0, 0, header, palette.frameDark, palette.frameLight,
                Shader.TileMode.MIRROR));
        canvas.drawRect(0, 0, width, header, paint);
        paint.setShader(null);
        Bitmap icon = BitmapFactory.decodeResource(context.getResources(), R.drawable.nth_reader_icon);
        if (icon != null) {
            float iconSize = Math.min(header * .75f, width * .16f);
            RectF target = new RectF((width - iconSize) / 2f, (header - iconSize) / 2f,
                    (width + iconSize) / 2f, (header + iconSize) / 2f);
            canvas.drawBitmap(icon, null, target, paint);
        }
        int bookcase = snapshot.optInt("activeBookcase", 0) + 1;
        paint.setTextAlign(Paint.Align.RIGHT);
        paint.setTextSize(Math.max(8f, width * .031f));
        paint.setColor(Color.rgb(231, 198, 140));
        canvas.drawText("Bookcase " + bookcase, width - Math.max(8f, width * .035f), header * .63f, paint);
    }

    private static void drawBooks(Canvas canvas, Paint paint, float left, float right, float top,
                                  float bottom, int shelf, JSONArray source) {
        if (source == null) return;
        List<JSONObject> books = new ArrayList<>();
        for (int i = 0; i < source.length(); i++) {
            JSONObject book = source.optJSONObject(i);
            if (book != null && book.optInt("shelf", -1) == shelf) books.add(book);
        }
        Collections.sort(books, Comparator.comparingDouble(book -> book.optDouble("slot", 0)));
        float rowHeight = bottom - top;
        float x = left + rowHeight * .04f;
        float baseline = bottom - Math.max(5f, rowHeight * .09f);
        for (JSONObject book : books) {
            boolean facedOut = book.optBoolean("facedOut", false);
            boolean stacked = book.optBoolean("stacked", false);
            float h = rowHeight * (facedOut ? .70f : Math.min(.82f, .58f + (float) book.optDouble("height", 116) / 580f));
            float w = facedOut ? h * .66f : Math.max(4f, rowHeight * (.072f + (float) book.optDouble("width", 22) / 900f));
            if (stacked) { w = rowHeight * .43f; h = Math.max(4f, rowHeight * .09f); }
            if (x + w > right) break;
            RectF rect = new RectF(x, baseline - h, x + w, baseline);
            int hue = Math.floorMod(book.optInt("hue", 25), 360);
            paint.setColor(Color.HSVToColor(new float[]{hue, .62f, .52f}));
            canvas.drawRoundRect(rect, Math.min(4f, w * .14f), Math.min(4f, w * .14f), paint);
            Bitmap art = decodeArt(book.optString("art", ""));
            if (art != null) {
                canvas.drawBitmap(art, null, rect, paint);
                art.recycle();
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(1f, w * .04f));
            paint.setColor(Color.argb(165, 242, 202, 118));
            canvas.drawRoundRect(rect, Math.min(4f, w * .14f), Math.min(4f, w * .14f), paint);
            paint.setStyle(Paint.Style.FILL);
            double progress = book.optDouble("progress", 0);
            if (progress > 0) {
                paint.setColor(Color.rgb(244, 189, 70));
                canvas.drawRect(rect.left, rect.bottom - Math.max(1.5f, rowHeight * .014f),
                        rect.left + (float) (rect.width() * Math.min(1d, progress)), rect.bottom, paint);
            }
            x += w + Math.max(1.5f, rowHeight * .018f);
        }
    }

    private static Bitmap decodeArt(String dataUrl) {
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0 || !dataUrl.substring(0, comma).contains("base64")) return null;
            byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception ignored) { return null; }
    }

    private static void drawDecor(Canvas canvas, Paint paint, float left, float right, float top,
                                  float bottom, int shelf, JSONArray source) {
        if (source == null) return;
        float rowHeight = bottom - top;
        float baseline = bottom - Math.max(6f, rowHeight * .10f);
        for (int i = 0; i < source.length(); i++) {
            JSONObject item = source.optJSONObject(i);
            if (item == null || item.optInt("shelf", -1) != shelf) continue;
            float x = left + (right - left) * Math.max(0f, Math.min(1f,
                    (float) item.optDouble("position", 50) / 100f));
            String type = item.optString("type", "object").toLowerCase();
            if (type.contains("plant") || type.contains("succulent") || type.contains("air")) {
                paint.setColor(Color.rgb(111, 73, 42));
                canvas.drawRoundRect(new RectF(x - rowHeight * .07f, baseline - rowHeight * .13f,
                        x + rowHeight * .07f, baseline), 3, 3, paint);
                paint.setColor(Color.rgb(66, 132, 66));
                for (int leaf = -2; leaf <= 2; leaf++) canvas.drawCircle(x + leaf * rowHeight * .028f,
                        baseline - rowHeight * (.16f + .025f * Math.abs(leaf)), rowHeight * .05f, paint);
            } else if (type.contains("frame") || type.contains("painting")) {
                RectF frame = new RectF(x - rowHeight * .14f, baseline - rowHeight * .37f,
                        x + rowHeight * .14f, baseline);
                paint.setColor(Color.rgb(176, 124, 49)); canvas.drawRect(frame, paint);
                paint.setColor(Color.rgb(33, 61, 78)); canvas.drawRect(new RectF(frame.left + 3,
                        frame.top + 3, frame.right - 3, frame.bottom - 3), paint);
            } else if (type.contains("globe")) {
                paint.setColor(Color.rgb(52, 98, 117)); canvas.drawCircle(x,
                        baseline - rowHeight * .17f, rowHeight * .12f, paint);
                paint.setColor(Color.rgb(173, 119, 55)); canvas.drawRect(x - 2, baseline - rowHeight * .06f,
                        x + 2, baseline, paint);
            } else {
                paint.setColor(Color.rgb(210, 159, 72));
                canvas.drawCircle(x, baseline - rowHeight * .10f, rowHeight * .09f, paint);
            }
        }
    }

    private static void drawShelfLedge(Canvas canvas, Paint paint, float left, float right,
                                       float y, float rowHeight, Palette palette) {
        float ledge = Math.max(5f, rowHeight * .085f);
        paint.setColor(Color.argb(150, 0, 0, 0));
        canvas.drawRect(left, y - ledge * .1f, right, y + ledge * .75f, paint);
        paint.setShader(new LinearGradient(0, y - ledge, 0, y + ledge * .25f,
                palette.ledgeLight, palette.ledgeDark, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(left, y - ledge, right, y + ledge * .2f),
                ledge * .25f, ledge * .25f, paint);
        paint.setShader(null);
    }

    private static final class Palette {
        final int frameDark, frameLight, back, backTop, ledgeDark, ledgeLight;
        Palette(String dark, String light, String back, String backTop, String ledgeDark, String ledgeLight) {
            this.frameDark = Color.parseColor(dark); this.frameLight = Color.parseColor(light);
            this.back = Color.parseColor(back); this.backTop = Color.parseColor(backTop);
            this.ledgeDark = Color.parseColor(ledgeDark); this.ledgeLight = Color.parseColor(ledgeLight);
        }
        static Palette forName(String name) {
            String value = name == null ? "" : name.toLowerCase();
            if (value.contains("oak")) return new Palette("#5c3218", "#a36b37", "#3b2415", "#21130b", "#4b2915", "#b17840");
            if (value.contains("cherry")) return new Palette("#42130f", "#8b3224", "#220c09", "#120504", "#3d130f", "#a74330");
            if (value.contains("espresso") || value.contains("black")) return new Palette("#150d0a", "#422b20", "#0d0907", "#050302", "#140c09", "#503629");
            if (value.contains("white") || value.contains("lacquer")) return new Palette("#6c665c", "#ded3bf", "#5a5248", "#292521", "#625b50", "#eee2ca");
            return new Palette("#2a1208", "#70401f", "#140a06", "#080403", "#35180b", "#81502b");
        }
    }
}
