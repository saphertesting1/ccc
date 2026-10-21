# Chandu Chicken Center — Android Capacitor Packaging & Google Play Guide

This guide details how to build and package the unified React + TypeScript codebase into a native Android APK / AAB using Capacitor, including hardware back-button configuration, safe areas, signed release builds, and Google Play Store publishing.

---

## 1. Architecture Overview

Chandu Chicken Center uses a **single shared codebase**:
- The web frontend and native Android app share 100% of the UI components, cart management, guest checkout, order tracking, and admin dashboard.
- **Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`)** bridges native Android platform capabilities:
  - Hardware back-button routing handled via `src/hooks/useBackButton.ts`.
  - Offline network detection handled via `src/components/NetworkStatus.tsx`.
  - Safe-area insets handled via Tailwind CSS utility classes `safe-top` and `safe-bottom`.
  - Android scheme configured to `https://` with cleartext support in `capacitor.config.ts`.

---

## 2. Prerequisites for Android Build

1. **Node.js** (v18+ or v20+)
2. **Android Studio** (Hedgehog, Iguana, or later)
3. **Android SDK** (API 34 / Android 14 recommended)
4. **Java Development Kit (JDK)**: OpenJDK 17 or 21

---

## 3. Local Android Project Initialization

From the project root:

```bash
# 1. Install dependencies
npm install

# 2. Build the production web bundle
npm run build

# 3. Add the native Android platform (first time only)
npx cap add android

# 4. Sync web assets and plugins to native Android folder
npx cap sync android
```

This generates the standard Android directory structure under `/android`:
```
android/
  ├── app/
  │   ├── build.gradle
  │   └── src/main/
  │       ├── AndroidManifest.xml
  │       ├── java/com/chanduchicken/app/MainActivity.java
  │       └── res/
  ├── build.gradle
  └── settings.gradle
```

---

## 4. Running in Development (Android Emulator / Device)

```bash
# Open project in Android Studio
npx cap open android
```

Inside Android Studio:
1. Select your target physical device (with USB Debugging enabled) or an Android Virtual Device (AVD).
2. Click **Run 'app'** (`Shift + F10`).
3. For live development connecting to your local Node server:
   - In `capacitor.config.ts`, you can configure:
     ```ts
     server: {
       url: 'http://10.0.2.2:3000', // 10.0.2.2 maps to host localhost in Android Emulator
       cleartext: true
     }
     ```

---

## 5. Generating a Signed Release Build (APK / AAB)

Google Play Store requires an **Android App Bundle (.aab)** signed with a release keystore.

### Step 5.1: Generate a Release Keystore
Run `keytool` from your terminal:
```bash
keytool -genkey -v -keystore chandu-chicken-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias chandu-key
```
*Keep this keystore file and passwords safe in your private credentials vault. Never commit `.jks` files to GitHub.*

### Step 5.2: Configure Gradle Signing
In `android/app/build.gradle`:
```groovy
android {
    ...
    signingConfigs {
        release {
            storeFile file("path/to/chandu-chicken-release-key.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "chandu-key"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 5.3: Build the App Bundle (.aab)
```bash
cd android
./gradlew bundleRelease
```
The generated bundle will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 6. Publishing Checklist for Google Play Console

1. **Google Play Developer Account:** Create or sign in to your verified developer console.
2. **Create New App:**
   - App Name: `Chandu Chicken Center`
   - Default Language: `English (India)`
   - Type: `App` / `Free`
3. **App Content Declarations:**
   - Privacy Policy: Link to your hosted privacy URL.
   - App Access: State that full guest ordering is available without credentials; provide demo admin credentials for reviewer evaluation if requested.
   - Ads: Select "No ads".
   - Target Audience: 18+ (Food & Grocery delivery).
4. **Store Listing Assets:**
   - High-res App Icon (512x512 PNG, featuring Chandu Chicken Center `#D92332` mark).
   - Feature Graphic (1024x500 PNG).
   - Mobile Screenshots (minimum 4 screens: Home, Fresh Cuts, Guest Checkout, Live Tracking).
5. **Upload Production Release:**
   - Upload `app-release.aab`.
   - Add release notes: *"Initial production release for Chandu Chicken Center online poultry ordering and tracking."*
   - Submit for Google Play review.
