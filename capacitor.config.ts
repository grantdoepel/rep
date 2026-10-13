import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app is a native shell around the deployed web app, so every Vercel deploy ships to the
// phone without an App Store review. Native features (Apple Health, camera, push, haptics) come
// from the plugins in package.json and reach the page through window.Capacitor.
// UVU_APP_URL lets you point a dev build at a preview deploy or your laptop (http://<lan-ip>:3000).
const url = process.env.UVU_APP_URL ?? "https://rep-xi-five.vercel.app";

const config: CapacitorConfig = {
  appId: "app.uvu.ios",
  appName: "uvu",
  webDir: "native-shell",
  backgroundColor: "#0C0D11",
  server: {
    url,
    cleartext: url.startsWith("http://"),
    allowNavigation: ["rep-xi-five.vercel.app", "*.vercel.app", "kwsyubyfsxjifsulofxa.supabase.co", "appleid.apple.com", "accounts.google.com"],
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
    scheme: "uvu",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
