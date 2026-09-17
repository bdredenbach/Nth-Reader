package com.nthreader.app;
import android.speech.tts.*;
public class Test {
 static void check(boolean v){if(!v)throw new AssertionError();}
 public static void main(String[] args){
  TextToSpeech t=new TextToSpeech(); Voice local=new Voice("local",false), remote=new Voice("online",true),missing=new Voice("missing",false);
  missing.features.add(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
  t.voices.add(remote);t.voices.add(missing);t.actual=remote;
  check(OfflineVoices.select(t,"online")==null);
  t.voices.add(local);check(OfflineVoices.available(t).size()==1);
  check(OfflineVoices.select(t,"online")==local);check(OfflineVoices.select(t,"deleted")==local);
  t.reject=true;check(OfflineVoices.select(t,"local")==null);
  t.reject=false;t.wrong=true;t.actual=remote;check(OfflineVoices.select(t,"local")==null);
  t.voices.clear();check(OfflineVoices.select(t,"")==null);
  System.out.println("PASS: network-only, missing data, stale choices, selection failure, unexpected engine default, empty voices");
 }
}
