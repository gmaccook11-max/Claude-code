# RE-Mind on the App Store

The iPhone app is the web app in `public/`, wrapped with [Capacitor](https://capacitorjs.com) in `ios/`.
Inside the app, reminders are scheduled on the phone with the local notifications plugin
(iOS allows 64 at a time, so the next 60 are kept scheduled), and the school calendar relay
is reached at `https://appp.gmaccook11.workers.dev/`.

## Build and run (on a Mac with Xcode)

```
npm install
npx cap sync ios
npx cap open ios
```

In Xcode, pick an iPhone simulator at the top and press Run. To run on your own iPhone,
plug it in, choose it at the top, and under Signing & Capabilities pick your Apple account
as the Team.

Run `npx cap sync ios` again after any change in `public/`.

## Publish

1. Join the Apple Developer Program (a parent or guardian enrolls if you are under 18).
2. In App Store Connect, create an app with the bundle ID `com.gmaccook11.remind`.
3. In Xcode: Product → Archive, then Distribute App → App Store Connect.
4. In App Store Connect add screenshots, a description, the privacy policy URL
   (`https://appp.gmaccook11.workers.dev/privacy.html`), the privacy answers
   ("Data Not Collected"), then submit for review.
