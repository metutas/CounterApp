// react-native-google-mobile-ads NATIVE bir modül: paketin JS girişi, import edilir
// edilmez TurboModuleRegistry.getEnforcing('RNGoogleMobileAdsModule') çağırıyor ve
// modül native binary'de yoksa ANINDA hata fırlatıyor (getEnforcing = "bulamazsan patla").
//
// Bu, en tepedeki `import` satırında, hiçbir component render edilmeden gerçekleştiği için
// component içindeki try/catch'ler işe yaramıyor ve tüm uygulama açılışta çöküyordu.
// Native modülün bulunmadığı durumlar: Expo Go, paket eklenmeden önce derlenmiş eski bir
// development build, ya da prebuild/native build adımı atlanmış bir kurulum.
//
// Çözüm: import yerine try/catch içinde lazy require. Modül yoksa null döner ve uygulama
// reklamsız olarak sorunsuz çalışmaya devam eder.
type AdMobModule = typeof import('react-native-google-mobile-ads');

// undefined = henüz denenmedi, null = denendi ve yok. Her ikisini ayırt etmek gerekiyor ki
// modül eksikken her çağrıda tekrar require deneyip console'u uyarıyla doldurmayalım.
let cached: AdMobModule | null | undefined;

export function getAdMob(): AdMobModule | null {
  if (cached !== undefined) return cached;

  try {
    cached = require('react-native-google-mobile-ads') as AdMobModule;
  } catch (err) {
    console.warn(
      'AdMob native modülü bulunamadı, reklamlar devre dışı. ' +
        'Expo Go yerine development/preview build kullanman gerekiyor.',
      err
    );
    cached = null;
  }

  return cached;
}

export function isAdMobAvailable(): boolean {
  return getAdMob() !== null;
}
