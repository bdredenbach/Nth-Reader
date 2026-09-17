package com.nthreader.app;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Never select the engine default implicitly: it may be a network voice. */
final class OfflineVoices {
    static final String HELP = "No installed offline voice is available. In Android Settings, open Text-to-speech, install offline voice data, then reopen Nth Reader.";

    static boolean eligible(Voice voice) {
        return voice != null && !voice.isNetworkConnectionRequired()
                && (voice.getFeatures() == null || !voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));
    }

    static List<Voice> available(TextToSpeech engine) {
        List<Voice> voices = new ArrayList<>();
        if (engine.getVoices() != null) {
            for (Voice voice : engine.getVoices()) if (eligible(voice)) voices.add(voice);
        }
        Locale locale = Locale.getDefault();
        voices.sort(Comparator.comparingInt((Voice v) -> v.getLocale().equals(locale) ? 0
                : v.getLocale().getLanguage().equals(locale.getLanguage()) ? 1 : 2)
                .thenComparing(Voice::getName));
        return voices;
    }

    static Voice select(TextToSpeech engine, String preferred) {
        List<Voice> voices = available(engine);
        voices.sort(Comparator.comparingInt(v -> v.getName().equals(preferred) ? 0 : 1));
        for (Voice voice : voices) {
            if (engine.setVoice(voice) == TextToSpeech.SUCCESS) {
                Voice actual = engine.getVoice();
                if (eligible(actual) && actual.getName().equals(voice.getName())) return actual;
            }
        }
        return null;
    }
}
