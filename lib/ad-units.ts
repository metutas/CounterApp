import { Platform } from 'react-native';

import { getAdMob } from './admob';

// Google'ın resmî banner test ID'si. Normalde paketin TestIds.BANNER sabitinden okunuyor;
// native modül yüklenemediğinde (bkz. admob.ts) paket hiç require edilemediği için bu sabit
// yedek olarak kullanılıyor. Bu durumda zaten hiç banner render edilmiyor, ama ID'yi
// hesaplayan kodun da patlamaması gerekiyor.
const FALLBACK_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

// AdMob hesabın açılıp gerçek Ad Unit ID'lerin oluşunca sadece bu iki satırı
// kendi ID'lerinle değiştir — geri kalan kod hiç dokunmadan çalışmaya devam eder.
// ÖNEMLİ: Geliştirme/test sırasında ASLA gerçek ID kullanma — kendi reklamına
// yanlışlıkla tıklamak AdMob hesabını askıya aldırabilir. __DEV__ true iken
// (Metro'dan çalıştırırken) her zaman Google'ın resmi test ID'si kullanılır.
function testBannerId(): string {
  return getAdMob()?.TestIds.BANNER ?? FALLBACK_TEST_BANNER_ID;
}

// Sabit export yerine fonksiyon: modül seviyesinde TestIds okumak, paketi import etmeyi
// zorlar ve native modül yokken uygulamayı açılışta çökertirdi.
export function getBannerAdUnitId(): string {
  if (__DEV__) return testBannerId();

  return (
    Platform.select({
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX', // TODO: gerçek Android banner Ad Unit ID
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX', // TODO: gerçek iOS banner Ad Unit ID
    }) ?? testBannerId()
  );
}
