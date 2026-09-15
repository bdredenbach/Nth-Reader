# Google Play release build

Nth Reader targets Android 16 (API 36) and builds its Play upload as an Android App Bundle (`.aab`). The upload key and its passwords are not stored in this repository.

## One-time GitHub setup

Create these four repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The complete upload keystore encoded as Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password |
| `ANDROID_KEY_ALIAS` | The upload-key alias (currently `nth-reader-upload`) |
| `ANDROID_KEY_PASSWORD` | The key password |

On Windows PowerShell, copy the keystore as Base64 without writing a second unprotected file:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\Reden\Projects\nth-reader-upload.jks")) | Set-Clipboard
```

Paste the clipboard contents into `ANDROID_KEYSTORE_BASE64`. Never paste a key or password into an issue, workflow file, commit, pull request, or chat.

## Build the signed bundle

1. Open the repository's **Actions** tab.
2. Select **Android Play release**.
3. Choose **Run workflow**, select the `Android` branch, and run it.
4. Download the `Nth-Reader-Play-release` artifact from the completed run.
5. Extract `app-release.aab` and upload that file to a Google Play Console testing track.

The workflow refuses to build if any signing secret is missing, verifies the resulting bundle's JAR signature, publishes a SHA-256 checksum, and removes its temporary keystore copy even if the build fails.

## Local Android Studio option

The normal **Build → Generate Signed App Bundle or APK** wizard remains supported. Choose **Android App Bundle**, select the backed-up `.jks`, enter its alias and passwords, and use the `release` build variant. Do not enable password storage on a shared computer.

Every Play update must keep the same application ID (`com.nthreader.app`) and use the same upload key. Increase `versionCode` before each later upload.
