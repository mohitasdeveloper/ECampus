# ECampus - Offline-First Web & Android App

Campus management system with **offline-first architecture**, Service Worker caching, and native Android support via Capacitor.

## 🎯 Features

- ✅ **Works Offline** - Full app functionality without internet
- ✅ **Blazing Fast** - Loads in <1 second from cache
- ✅ **Smart Sync** - Auto-syncs when connection restored
- ✅ **Native Android** - Installable app on Play Store
- ✅ **Web Version** - Still deployed to GitHub Pages
- ✅ **Same Code** - One source for web + Android

## 🚀 Quick Start

```bash
npm install
npm run health-check
npm run build:web
npx cap add android
npx cap open android
```

## 📱 Android App

Build APK using Android Studio or GitHub Actions.

**GitHub Actions:** Auto-builds APK when you push code
**Local Build:** Open in Android Studio, build manually

## 📚 More Info

- [Offline-First Architecture](./OFFLINE_FIRST.md)
- [Android Building Guide](./ANDROID.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---
