import { StyleSheet, View } from 'react-native';

import { getAdMob } from '@/lib/admob';
import { getBannerAdUnitId } from '@/lib/ad-units';

// Bu dosya sadece iOS/Android'de kullanılır. Metro, dosya adındaki ".web"
// eki sayesinde web derlemesi için otomatik olarak ad-banner.web.tsx'i seçer
// ve bu dosyanın kodunu web bundle'ına hiç dahil etmez.
//
// google-mobile-ads paketi en tepede `import` edilmiyor: native modül eksikse
// (Expo Go, paket eklenmeden önce derlenmiş eski build) import satırı bundle
// yüklenirken patlıyor ve tüm uygulamayı açılışta çökertiyordu. Bunun yerine
// admob.ts üzerinden güvenli lazy require kullanılıyor; modül yoksa banner
// hiç render edilmiyor ve uygulama reklamsız çalışmaya devam ediyor.
export function AdBanner() {
  const admob = getAdMob();
  if (!admob) return null;

  const { BannerAd, BannerAdSize } = admob;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getBannerAdUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
});
