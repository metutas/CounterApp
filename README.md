# ⏳ Odak: Pomodoro & Ders Takibi

Ders çalışmayı ve odaklanmayı kolaylaştırmak için geliştirilmiş, [Expo](https://expo.dev) (React Native) tabanlı bir mobil uygulama. Sayaç, Pomodoro tekniği, görev listesi, istatistikler ve alarmları tek bir uygulamada bir araya getirir.

## ✨ Özellikler

- **Sayaç** — Geri sayım / kronometre ile odak seansları başlatma.
- **Pomodoro** — Klasik Pomodoro tekniğiyle çalışma/mola döngüleri, günlük hedef takibi.
- **Görevler** — Derslere göre gruplanmış çalışma görevleri; ekleme, tamamlama, filtreleme.
- **İstatistikler** — Çalışma sürelerinin ve tamamlanan pomodoroların özet görünümü.
- **Alarmlar** — Özelleştirilebilir alarm kurma, erteleme (snooze) ve zil sesi teması seçimi.
- **Ses temaları** — Yağmur, deniz dalgası, orman, odaklanma frekansı gibi ortam sesleri ile klasik/dijital/melodik alarm sesleri arasından seçim.
- **Tema tercihi** — Otomatik / Açık / Koyu tema desteği.
- **Reklamlar** — Google AdMob entegrasyonu (react-native-google-mobile-ads).

## 🚀 Başlarken

1. Bağımlılıkları kur:

   ```bash
   npm install
   ```

2. Uygulamayı başlat:

   ```bash
   npx expo start
   ```

   > **Not:** Bu proje `expo-notifications`, `react-native-google-mobile-ads` gibi native modüller kullandığı için standart **Expo Go** ile çalışmaz. Bir [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:android` / `npx expo run:ios` veya EAS Build) ile çalıştırılması gerekir.

## 🛠️ Kullanılan teknolojiler

- [Expo](https://docs.expo.dev/versions/v54.0.0/) SDK 54 (React Native, yeni mimari aktif)
- [Expo Router](https://docs.expo.dev/router/introduction/) — dosya tabanlı gezinme
- `expo-notifications` — yerel bildirimler ve alarm zamanlama
- `expo-audio` — ses çalma
- `react-native-google-mobile-ads` — reklamlar
- `@react-native-async-storage/async-storage` — yerel veri saklama

## 📁 Proje yapısı

```
app/
  (tabs)/        # Sayaç, Pomodoro, Görevler, İstatistik, Alarmlar sekmeleri
  _layout.tsx    # Kök layout (tema, veri sağlayıcıları, alarm modalı)
components/      # Paylaşılan UI bileşenleri
lib/             # İş mantığı: bildirimler, ses üretimi, tema/veri sağlayıcıları
assets/          # İkonlar, sesler, görseller
scripts/         # Yardımcı build script'leri (ör. ses varlıklarını üretme)
```

## 📄 Lisans

Bu proje kişisel/özel kullanım amaçlıdır.
