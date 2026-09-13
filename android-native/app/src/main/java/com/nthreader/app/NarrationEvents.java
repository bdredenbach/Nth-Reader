package com.nthreader.app;

public final class NarrationEvents {
    public interface Sink { void onNarrationState(String json); }
    private static volatile Sink sink;
    private NarrationEvents() {}
    public static void setSink(Sink value) { sink = value; }
    public static void send(String json) {
        Sink current = sink;
        if (current != null) current.onNarrationState(json);
    }
}
