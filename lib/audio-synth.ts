import { createAudioPlayer } from 'expo-audio';
import { SoundThemeId } from './sound-themes';
import { generateWavDataUri } from './wav-generator';

// Native tarafta (Android/iOS) expo-audio'nun resmi olarak desteklediği kaynaklar:
// require() ile gömülü asset, https URL veya file:// yolu — "data:" URI native'de
// belgelenmiyor ve ExoPlayer/AVPlayer'da güvenilir çalışacağı garanti değil. Bu yüzden
// native'de her zaman gerçek, gömülü .wav dosyalarını (assets/sounds/) require ile
// kullanıyoruz; data URI üretimi (wav-generator.ts) sadece web'de kalıyor (tarayıcıda
// <audio> data: URI'yi sorunsuz çalar).
const NATIVE_SOUND_ASSETS: Record<SoundThemeId, number> = {
  classic: require('../assets/sounds/classic.wav'),
  digital: require('../assets/sounds/digital.wav'),
  melodic: require('../assets/sounds/melodic.wav'),
  soft: require('../assets/sounds/soft.wav'),
  energetic: require('../assets/sounds/energetic.wav'),
  rain: require('../assets/sounds/rain.wav'),
  ocean: require('../assets/sounds/ocean.wav'),
  forest: require('../assets/sounds/forest.wav'),
  focus: require('../assets/sounds/focus.wav'),
  white_noise: require('../assets/sounds/white_noise.wav'),
};

const THEME_DURATIONS_MS: Record<SoundThemeId, number> = {
  classic: 1400,
  digital: 1300,
  melodic: 2000,
  soft: 2200,
  energetic: 1600,
  rain: 3000,
  ocean: 4000,
  forest: 4000,
  focus: 4000,
  white_noise: 3000,
};

class AlarmAudioPlayer {
  private player: any = null;
  private timerRef: any = null;

  async startLoop(themeId: SoundThemeId = 'classic') {
    this.stop();

    try {
      if (typeof window !== 'undefined' && typeof (window as any).Audio !== 'undefined') {
        const uri = generateWavDataUri(themeId);
        const audio = new (window as any).Audio(uri);
        audio.loop = true;
        audio.play().catch(() => {});
        this.player = audio;
      } else {
        const player = createAudioPlayer(NATIVE_SOUND_ASSETS[themeId]);
        player.loop = true;
        player.play();
        this.player = player;
      }
    } catch (e) {
      // Sessiz düşüş: ses çalınamazsa alarm/titreşim akışı yine de devam eder.
    }
  }

  stop() {
    if (this.player) {
      try {
        if (typeof this.player.pause === 'function') {
          this.player.pause();
        }
        if (typeof this.player.remove === 'function') {
          this.player.remove();
        }
      } catch (e) {}
      this.player = null;
    }
    if (this.timerRef) {
      clearInterval(this.timerRef);
      this.timerRef = null;
    }
  }

  async preview(themeId: SoundThemeId) {
    await this.startLoop(themeId);
    // Kısa temaları erken kesmemek, uzunları da gereksiz uzatmamak için
    // önizleme süresini temanın gerçek uzunluğuna göre ayarla (üst sınır 3.2sn).
    const previewMs = Math.min(THEME_DURATIONS_MS[themeId] ?? 2400, 3200);
    setTimeout(() => {
      this.stop();
    }, previewMs);
  }
}

export const alarmAudioPlayer = new AlarmAudioPlayer();
