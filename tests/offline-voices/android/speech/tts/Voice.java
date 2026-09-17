package android.speech.tts;
import java.util.*;
public class Voice {
 public String name; public boolean network; public Set<String> features = new HashSet<>();
 public Voice(String n, boolean net) {name=n;network=net;}
 public String getName(){return name;} public boolean isNetworkConnectionRequired(){return network;}
 public Locale getLocale(){return Locale.US;} public Set<String> getFeatures(){return features;}
}
