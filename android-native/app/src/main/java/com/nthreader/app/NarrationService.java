package com.nthreader.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

public final class NarrationService extends Service implements TextToSpeech.OnInitListener {
    public static final String ACTION_PLAY = "com.nthreader.PLAY";
    public static final String ACTION_PAUSE = "com.nthreader.PAUSE";
    public static final String ACTION_STOP = "com.nthreader.STOP";
    public static final String ACTION_SKIP = "com.nthreader.SKIP";
    public static final String ACTION_SEEK = "com.nthreader.SEEK";
    public static final String ACTION_RATE = "com.nthreader.RATE";
    public static final String ACTION_VOICE = "com.nthreader.VOICE";
    private static final String CHANNEL = "nth_narration";
    private static final int NOTIFICATION_ID = 32;

    private TextToSpeech tts;
    private boolean ready = false, pendingPlay = false;
    private MediaSession mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private PowerManager.WakeLock wakeLock;

    @Override public void onCreate() {
        super.onCreate();
        NarrationStore.load(this);
        createChannel();
        setupMediaSession();
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NthReader:Narration");
        wakeLock.setReferenceCounted(false);
        tts = new TextToSpeech(this, this);
        startForeground(NOTIFICATION_ID, notification());
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, notification());
        String action = intent == null ? ACTION_PLAY : intent.getAction();
        if (ACTION_PAUSE.equals(action)) pauseNarration();
        else if (ACTION_STOP.equals(action)) stopNarration();
        else if (ACTION_SKIP.equals(action)) {
            NarrationStore.move(intent.getIntExtra("delta", 0));
            NarrationStore.saveProgress(this);
            if (NarrationStore.playing) speakCurrent(); else publish();
        } else if (ACTION_SEEK.equals(action)) {
            NarrationStore.seek(intent.getDoubleExtra("progress", 0));
            NarrationStore.saveProgress(this);
            if (NarrationStore.playing) speakCurrent(); else publish();
        } else if (ACTION_RATE.equals(action)) {
            NarrationStore.rate = (float) Math.max(.5, Math.min(2, intent.getDoubleExtra("rate", 1)));
            NarrationStore.saveProgress(this);
            if (NarrationStore.playing) speakCurrent(); else publish();
        } else if (ACTION_VOICE.equals(action)) {
            applySelectedVoice();
            NarrationStore.saveProgress(this);
            if (NarrationStore.playing) speakCurrent(); else publish();
        } else playNarration();
        return START_STICKY;
    }

    @Override public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (!ready) {
            NarrationStore.error = "Android's text-to-speech service is unavailable. Install or enable a voice in system settings.";
            NarrationStore.playing = false;
            publish();
            return;
        }
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { publish(); }
            @Override public void onDone(String id) {
                if (!NarrationStore.playing) return;
                if (NarrationStore.advance()) speakCurrent();
                else finishNarration();
            }
            @Override public void onError(String id) { narrationError("The phone could not speak this sentence."); }
            @Override public void onError(String id, int code) { narrationError("Android narration stopped (error " + code + ")."); }
        });
        if (pendingPlay || NarrationStore.playing) speakCurrent();
    }

    private void playNarration() {
        if (NarrationStore.size() == 0) {
            NarrationStore.error = "No narrated book is prepared."; publish(); return;
        }
        NarrationStore.active = true;
        NarrationStore.playing = true;
        NarrationStore.paused = false;
        NarrationStore.finished = false;
        NarrationStore.error = "";
        pendingPlay = !ready;
        requestAudioFocus();
        if (ready) speakCurrent(); else publish();
    }

    private void speakCurrent() {
        NarrationStore.Unit unit = NarrationStore.current();
        if (!ready || unit == null || !NarrationStore.playing) return;
        pendingPlay = false;
        if (!applySelectedVoice()) { narrationError(OfflineVoices.HELP); return; }
        if (!wakeLock.isHeld()) wakeLock.acquire(60 * 60 * 1000L);
        tts.setSpeechRate(NarrationStore.rate);
        if (tts.speak(unit.text, TextToSpeech.QUEUE_FLUSH, new Bundle(), "nth-" + NarrationStore.index) == TextToSpeech.ERROR) {
            narrationError("Offline narration could not start. Check your installed voice data.");
            return;
        }
        NarrationStore.saveProgress(this);
        publish();
    }

    private void pauseNarration() {
        pendingPlay = false;
        if (tts != null) tts.stop();
        NarrationStore.playing = false;
        NarrationStore.paused = NarrationStore.active;
        releaseAudio();
        publish();
    }

    private void stopNarration() {
        pendingPlay = false;
        if (tts != null) tts.stop();
        NarrationStore.active = false;
        NarrationStore.playing = false;
        NarrationStore.paused = false;
        releaseAudio();
        publish();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void finishNarration() {
        NarrationStore.playing = false;
        NarrationStore.paused = false;
        NarrationStore.finished = true;
        NarrationStore.active = true;
        releaseAudio();
        publish();
    }

    private void narrationError(String message) {
        pendingPlay = false;
        NarrationStore.error = message;
        NarrationStore.playing = false;
        NarrationStore.paused = false;
        if (tts != null) tts.stop();
        releaseAudio();
        publish();
    }

    private void publish() {
        updateMediaState();
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, notification());
        NarrationEvents.send(NarrationStore.stateJson());
    }

    private void createChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                getString(R.string.narration_channel), NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.narration_channel_description));
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private void setupMediaSession() {
        mediaSession = new MediaSession(this, "NthReaderNarration");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { playNarration(); }
            @Override public void onPause() { pauseNarration(); }
            @Override public void onStop() { stopNarration(); }
            @Override public void onSkipToNext() { NarrationStore.move(1); if (NarrationStore.playing) speakCurrent(); else publish(); }
            @Override public void onSkipToPrevious() { NarrationStore.move(-1); if (NarrationStore.playing) speakCurrent(); else publish(); }
        });
        mediaSession.setActive(true);
        updateMediaState();
    }

    private void updateMediaState() {
        if (mediaSession == null) return;
        int state = NarrationStore.playing ? PlaybackState.STATE_PLAYING
                : NarrationStore.paused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_STOPPED;
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_STOP
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS;
        mediaSession.setPlaybackState(new PlaybackState.Builder().setActions(actions)
                .setState(state, NarrationStore.index, NarrationStore.rate).build());
        mediaSession.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, NarrationStore.title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, NarrationStore.author)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "Nth Reader")
                .build());
    }

    private Notification notification() {
        NarrationStore.Unit unit = NarrationStore.current();
        String text = unit == null ? "Ready to read" : unit.text;
        Intent launch = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Action previous = action(android.R.drawable.ic_media_previous, "Previous", ACTION_SKIP, -1);
        Notification.Action toggle = action(NarrationStore.playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                NarrationStore.playing ? "Pause" : "Play", NarrationStore.playing ? ACTION_PAUSE : ACTION_PLAY, 0);
        Notification.Action next = action(android.R.drawable.ic_media_next, "Next", ACTION_SKIP, 1);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_narration).setContentTitle(NarrationStore.title)
                .setContentText(text).setStyle(new Notification.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
                .setContentIntent(content).setOngoing(NarrationStore.playing).setOnlyAlertOnce(true)
                .addAction(previous).addAction(toggle).addAction(next).build();
    }

    private Notification.Action action(int icon, String title, String action, int delta) {
        Intent intent = new Intent(this, NarrationService.class).setAction(action);
        if (ACTION_SKIP.equals(action)) intent.putExtra("delta", delta);
        int requestCode = ACTION_SKIP.equals(action) ? 100 + delta : action.hashCode();
        PendingIntent pending = PendingIntent.getService(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Action.Builder(icon, title, pending).build();
    }

    private void requestAudioFocus() {
        if (focusRequest != null) return;
        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes).setOnAudioFocusChangeListener(change -> {
                    if (change == AudioManager.AUDIOFOCUS_LOSS) pauseNarration();
                }).build();
        audioManager.requestAudioFocus(focusRequest);
    }

    private void releaseAudio() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (audioManager != null && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        focusRequest = null;
    }

    private boolean applySelectedVoice() {
        if (!ready || tts == null) return false;
        Voice selected = OfflineVoices.select(tts, NarrationStore.voiceName);
        if (selected == null) return false;
        NarrationStore.voiceName = selected.getName();
        return true;
    }

    @Override public void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        releaseAudio();
        if (mediaSession != null) mediaSession.release();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
