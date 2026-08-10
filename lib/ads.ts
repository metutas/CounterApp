import { getAdMob } from './admob';

// Sadece iOS/Android'de kullanılır (bkz. ads.web.ts).
export function initializeAds() {
  // Native modül yoksa (Expo Go / eski build) sessizce atla — uyarı getAdMob içinde bir kez basılır.
  const admob = getAdMob();
  if (!admob) return;

  try {
    admob
      .default()
      .initialize()
      .catch(() => {});
  } catch (e) {
    console.warn('AdMob initialize error:', e);
  }
}
