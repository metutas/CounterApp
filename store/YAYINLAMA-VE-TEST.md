# Test Etme ve Yayınlama Rehberi

## 1. QR kodu neden "kullanılabilir veri bulunamadı" diyor?

`npx expo start` çıktısındaki QR kod, **development build** (dev client) için üretilmiş bir
`counterapp://expo-development-client/...` bağlantısı içerir. iPhone'un Kamera uygulaması bu özel
şemayı, o şemayı kaydeden uygulama telefonda kurulu olmadığı için açamaz — bu yüzden
"kullanılabilir veri bulunamadı" der. Yani QR bozuk değil, telefonda okuyacak uygulama yok.

**Expo Go ile de açılmaz.** Bu proje Expo Go'da bulunmayan native modüller kullanıyor:

- `react-native-google-mobile-ads` (AdMob)
- `expo-notifications` için özel ses kanalları (`assets/sounds/*.wav` native build'e gömülüyor)

Bu yüzden uygulamayı denemenin tek yolu **kendi development build'ini kurmak**.

## 2. Nasıl test edilir?

### a) Android telefon (senin için en pratik yol)

```bash
npx eas build --profile development --platform android
```

Build bitince EAS bir APK linki + QR verir. Telefondan o QR'ı okut, APK'yı indir ve kur.
Sonra bilgisayarda:

```bash
npx expo start --dev-client
```

Telefondaki uygulamayı aç, aynı Wi-Fi'da bilgisayarındaki sunucuya bağlanır ve kod
değişikliklerin anında yansır.

Sadece "uygulama nasıl görünüyor" demek istiyorsan derlemesi daha hızlı olan paylaşılabilir APK:

```bash
npx eas build --profile preview --platform android
```

### b) Tarayıcı (kurulum gerektirmez, en hızlı)

```bash
npm run web
```

Sayaç, Pomodoro, Görevler ve İstatistik ekranlarının tamamı tarayıcıda çalışır.
Çalışmayanlar: sistem bildirimleri, titreşim ve reklamlar (bunlar sadece telefonda çalışır).

### c) iPhone

Windows bilgisayarda iPhone'da test etmenin **ücretsiz bir yolu yok**. Gerekenler:

1. Apple Developer Program üyeliği (yılda 99 USD)
2. `npx eas build --profile development --platform ios` (bulutta derlenir, Mac gerekmez)
3. Test cihazının UDID'sini kaydetmek: `npx eas device:create`

Alternatif olarak TestFlight üzerinden dağıtım (aşağıya bak) — o da aynı üyeliği gerektirir.

## 3. iOS'ta yayınlama adımları

Yapılandırma tarafı hazır: `app.json` içinde `ios.bundleIdentifier`, `buildNumber`, export
uyumluluğu (`ITSAppUsesNonExemptEncryption`) ve reklam izni metni (`NSUserTrackingUsageDescription`)
tanımlı; `eas.json` içinde iOS build ve submit profilleri var.

Apple hesabı alındıktan sonra sıra:

1. **Apple Developer Program** üyeliği alınır (99 USD/yıl, onay 24-48 saat sürebilir).
2. **App Store Connect**'te yeni uygulama oluşturulur; bundle ID olarak
   `com.merentutas.counterapp` seçilir.
3. `eas.json` → `submit.production.ios` içindeki iki alan doldurulur:
   - `ascAppId`: App Store Connect'teki uygulamanın Apple ID numarası
   - `appleTeamId`: Apple Developer hesabındaki Team ID
4. **AdMob'da iOS uygulaması oluşturulur.** Şu an `app.json`'daki `iosAppId` ve
   `lib/ad-units.ts`'teki iOS banner kimliği Google'ın **test** kimlikleri. Gerçek kimlikler
   alınmadan yayına çıkılırsa reklam geliri olmaz (ama uygulama çalışır).
5. Build ve gönderim:

```bash
npx eas build --profile production --platform ios
```

```bash
npx eas submit --profile production --platform ios
```

6. App Store Connect'te doldurulması gerekenler:
   - Gizlilik politikası URL'si (`store/privacy-policy.html` yayına alınmalı — GitHub Pages yeterli)
   - **App Privacy** formu: AdMob reklam kimliği topladığı için "Identifiers → Advertising Data" işaretlenir
   - Ekran görüntüleri: 6.7" (1290x2796) ve 6.5" (1242x2688) zorunlu
   - Yaş sınırı, kategori (Education veya Productivity önerilir)

### Dikkat edilmesi gerekenler

- **Uygulama adı**: "Odak: Pomodoro & Ders Takibi" olarak güncellendi (`app.json` → `name`).
  `slug` bilerek `CounterApp` bırakıldı — değiştirilirse EAS proje bağı ve mevcut build geçmişi bozulur.
  Play Console'daki mağaza başlığı ayrı bir alandır, oradan da elle güncellenmeli.
- **ATT (izleme izni)**: Kişiselleştirilmiş reklam gösterilecekse `expo-tracking-transparency`
  eklenip izin istenmeli. İstenmezse reklamlar kişiselleştirilmez ama uygulama sorunsuz çalışır.
- **iOS'ta arka planda ses**: Şu an pomodoro sesi uygulama arka plana alınınca susar. Sürekli
  çalması isteniyorsa `UIBackgroundModes: ["audio"]` eklenmeli — ancak Apple bu izni gerçekten
  gerektirmeyen uygulamaları reddedebilir.
