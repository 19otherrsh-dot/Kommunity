# Komunity Native Mobile Apps (Capacitor)

Komunity ships as a responsive web app wrapped with [Capacitor](https://capacitorjs.com/)
to produce **native iOS and Android** binaries for the App Store / Play Store.

The same `dist/` web build powers both platforms. Push notifications use the
existing Firebase Cloud Messaging setup (`@capacitor/push-notifications`).

## Prerequisites

| Platform | Requirements |
|---|---|
| Android | Android Studio, JDK 17 (already scaffolded in `android/`) |
| iOS | **macOS** + Xcode 15+, CocoaPods (`sudo gem install cocoapods`) |

> The iOS project (`ios/`) is **not** committed because it can only be generated
> and built on macOS. Run the one-time `ios:add` step below on a Mac.

## iOS — first-time setup (run on macOS)

```bash
cd komunity/frontend
npm install                 # installs @capacitor/ios
npm run ios:add             # generates the ios/ Xcode project (one time)
npm run ios:sync            # builds the web app and copies it into ios/
npm run ios:open            # opens Xcode
```

In Xcode:
1. Select the **Komunity** target → Signing & Capabilities → set your Team.
2. Add the **Push Notifications** capability and the **Background Modes →
   Remote notifications** capability.
3. Drop your Firebase `GoogleService-Info.plist` into the app target.
4. Run on a simulator/device, then Archive → distribute to App Store Connect.

## iOS — subsequent builds

```bash
npm run ios:sync && npm run ios:open
```

## Android

```bash
npm run build:mobile        # vite build + cap sync (android already exists)
npm run android:open        # opens Android Studio
```

## Notes

- `capacitor.config.json` sets `ios.contentInset: "always"` so content clears the
  notch/status bar, and configures push presentation options for both platforms.
- Auth uses an httpOnly cookie. Capacitor's WebView persists cookies, so the
  native apps stay signed in across launches just like the PWA.
- If you point the app at a remote API, ensure CORS `credentials: true` and a
  cookie `SameSite`/`Secure` policy compatible with the WebView origin.
