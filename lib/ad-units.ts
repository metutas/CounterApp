import { Platform } from 'react-native';

import { getAdMob } from './admob';

// Google'ın resmî banner test ID'si. Normalde paketin TestIds.BANNER sabitinden okunuyor;
// native modül yüklenemediğinde (bkz. admob.ts) paket hiç require edilemediği için bu sabit
// yedek olarak kullanılıyor. Bu durumda zaten hiç banner render edilmiyor, ama ID'yi
// hesaplayan kodun da patlamaması gerekiyor.
const FALLBACK_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

// ÖNEMLİ: Geliştirme/test sırasında ASLA gerçek ID kullanma — kendi reklamına
// yanlışlıkla tıklamak AdMob hesabını askıya aldırabilir. __DEV__ true iken
// (Metro'dan çalıştırırken) her zaman Google'ın resmi test ID'si kullanılır.
function testBannerId(): string {
  return getAdMob()?.TestIds.BANNER ?? FALLBACK_TEST_BANNER_ID;
}

// __DEV__ tek başına yetmiyor: EAS'ın "development" ve "preview" profilleri de release
// modunda derlendiği için __DEV__ orada false oluyor ve gerçek reklamlar dönüyordu.
// Bu build'ler tanıdıklara test amaçlı dağıtıldığından tıklanma riski yüksek; bu yüzden
// eas.json'da bu profillere EXPO_PUBLIC_USE_TEST_ADS=1 tanımlandı (derleme anında koda
// gömülür). Sadece "production" profilinde tanımsız kalır ve gerçek kimlikler devreye girer.
function useTestAds(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === '1';
}

// Sabit export yerine fonksiyon: modül seviyesinde TestIds okumak, paketi import etmeyi
// zorlar ve native modül yokken uygulamayı açılışta çökertirdi.
export function getBannerAdUnitId(): string {
  if (useTestAds()) return testBannerId();

  return (
    Platform.select({
      // AdMob → CounterApp (Android) → "Sayac Alt Banner"
      android: 'ca-app-pub-1463142731660300/5887904422',
      // iOS için henüz AdMob uygulaması oluşturulmadı. Gerçek ID gelene kadar test
      // reklamı gösteriyoruz: geçersiz bir ID kullanmak yerine bu daha güvenli.
      ios: testBannerId(),
    }) ?? testBannerId()
  );
}
