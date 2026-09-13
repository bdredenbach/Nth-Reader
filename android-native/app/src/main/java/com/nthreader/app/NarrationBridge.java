package com.nthreader.app;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;

public final class NarrationBridge {
    private final Context context;
    NarrationBridge(Context context) { this.context = context.getApplicationContext(); }

    @JavascriptInterface public boolean isAvailable() { return true; }

    @JavascriptInterface public void beginSession(String metadata) {
        try { NarrationStore.begin(metadata); }
        catch (Exception error) { NarrationStore.error = "Could not prepare narration."; }
        NarrationEvents.send(NarrationStore.stateJson());
    }

    @JavascriptInterface public void appendBatch(String batch) {
        try { NarrationStore.append(batch); }
        catch (Exception error) { NarrationStore.error = "Could not read part of this book."; }
    }

    @JavascriptInterface public void commitAndPlay(int index) {
        if (NarrationStore.size() == 0) {
            NarrationStore.error = "No readable text was found in this book.";
            NarrationEvents.send(NarrationStore.stateJson());
            return;
        }
        NarrationStore.index = Math.max(0, Math.min(index, NarrationStore.size() - 1));
        NarrationStore.active = true;
        NarrationStore.save(context);
        command(NarrationService.ACTION_PLAY);
    }

    @JavascriptInterface public void pause() { command(NarrationService.ACTION_PAUSE); }
    @JavascriptInterface public void resume() { command(NarrationService.ACTION_PLAY); }
    @JavascriptInterface public void stop() { command(NarrationService.ACTION_STOP); }
    @JavascriptInterface public void skip(int delta) {
        Intent intent = new Intent(context, NarrationService.class)
                .setAction(NarrationService.ACTION_SKIP).putExtra("delta", delta);
        context.startForegroundService(intent);
    }
    @JavascriptInterface public void seekProgress(double progress) {
        Intent intent = new Intent(context, NarrationService.class)
                .setAction(NarrationService.ACTION_SEEK).putExtra("progress", progress);
        context.startForegroundService(intent);
    }
    @JavascriptInterface public void setRate(double rate) {
        Intent intent = new Intent(context, NarrationService.class)
                .setAction(NarrationService.ACTION_RATE).putExtra("rate", rate);
        context.startForegroundService(intent);
    }
    @JavascriptInterface public String getState() { return NarrationStore.stateJson(); }

    private void command(String action) {
        context.startForegroundService(new Intent(context, NarrationService.class).setAction(action));
    }
}
