package com.nthreader.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Arrays;
import java.util.Comparator;

/** Read-only bridge that lets the active launcher load exact-size widget artwork. */
public final class WidgetImageProvider extends ContentProvider {
    private static final String DIRECTORY = "widget-rendered-images";

    static File imageDirectory(Context context) {
        return new File(context.getFilesDir(), DIRECTORY);
    }

    static Uri uriFor(Context context, File image) {
        return new Uri.Builder()
                .scheme("content")
                .authority(context.getPackageName() + ".widgetimages")
                .appendPath(image.getName())
                .build();
    }

    static void trimWidgetImages(Context context, int widgetId, File current) {
        File[] files = imageDirectory(context).listFiles((directory, name) ->
                name.startsWith("widget-" + widgetId + "-") && name.endsWith(".png"));
        if (files == null || files.length <= 3) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        for (int i = 3; i < files.length; i++) {
            if (!files[i].equals(current)) deleteGrantedImage(context, files[i]);
        }
    }

    static void deleteWidgetImages(Context context, int widgetId) {
        File[] files = imageDirectory(context).listFiles((directory, name) ->
                name.startsWith("widget-" + widgetId + "-") && name.endsWith(".png"));
        if (files == null) return;
        for (File file : files) deleteGrantedImage(context, file);
    }

    private static void deleteGrantedImage(Context context, File file) {
        context.revokeUriPermission(uriFor(context, file),
                android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
        file.delete();
    }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) { return "image/png"; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode == null || !mode.startsWith("r")) throw new FileNotFoundException("Read only");
        return ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection,
                                  String[] selectionArgs, String sortOrder) {
        try {
            File file = resolve(uri);
            String[] columns = projection == null
                    ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
                    : projection;
            MatrixCursor cursor = new MatrixCursor(columns, 1);
            MatrixCursor.RowBuilder row = cursor.newRow();
            for (String column : columns) {
                if (OpenableColumns.DISPLAY_NAME.equals(column)) row.add(file.getName());
                else if (OpenableColumns.SIZE.equals(column)) row.add(file.length());
                else row.add(null);
            }
            return cursor;
        } catch (FileNotFoundException ignored) { return null; }
    }

    private File resolve(Uri uri) throws FileNotFoundException {
        Context context = getContext();
        if (context == null || uri == null
                || !(context.getPackageName() + ".widgetimages").equals(uri.getAuthority())
                || uri.getPathSegments().size() != 1) {
            throw new FileNotFoundException("Invalid widget image");
        }
        String filename = uri.getLastPathSegment();
        if (filename == null || !filename.matches("widget-[0-9]+-[0-9]+x[0-9]+-[0-9]+\\.png")) {
            throw new FileNotFoundException("Invalid widget image");
        }
        File file = new File(imageDirectory(context), filename);
        try {
            String root = imageDirectory(context).getCanonicalPath() + File.separator;
            if (!file.getCanonicalPath().startsWith(root) || !file.isFile()) {
                throw new FileNotFoundException("Widget image unavailable");
            }
        } catch (java.io.IOException error) {
            throw new FileNotFoundException("Widget image unavailable");
        }
        return file;
    }

    @Override public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read only");
    }

    @Override public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read only");
    }

    @Override public int update(Uri uri, ContentValues values, String selection,
                                String[] selectionArgs) {
        throw new UnsupportedOperationException("Read only");
    }
}
