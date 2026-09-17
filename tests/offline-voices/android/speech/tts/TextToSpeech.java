package android.speech.tts;
import java.util.*;
public class TextToSpeech {
 public static final int SUCCESS=0;
 public static class Engine {public static final String KEY_FEATURE_NOT_INSTALLED="notInstalled";}
 public Set<Voice> voices=new HashSet<>(); public Voice actual; public boolean reject=false,wrong=false;
 public Set<Voice> getVoices(){return voices;}
 public int setVoice(Voice v){if(reject)return -1; if(!wrong)actual=v;return SUCCESS;}
 public Voice getVoice(){return actual;}
}
