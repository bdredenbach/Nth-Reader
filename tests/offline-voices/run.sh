#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
output_dir=$(mktemp -d)
trap 'rm -rf "$output_dir"' EXIT
# Small API doubles exercise selection failures without a device or speech provider.
javac -d "$output_dir" tests/offline-voices/android/speech/tts/*.java \
  android-native/app/src/main/java/com/nthreader/app/OfflineVoices.java \
  tests/offline-voices/com/nthreader/app/Test.java
java -cp "$output_dir" com.nthreader.app.Test
node tests/offline-voices/browser.cjs
