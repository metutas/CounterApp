import { SoundThemeId } from './sound-themes';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Bağımsız (btoa / Buffer gerektirmeyen) base64 kodlayıcı. Native (Hermes) ortamında
// ne `btoa` (yalnızca tarayıcıda var) ne de `Buffer` (bu projede polyfill edilmemiş)
// global olarak bulunuyor — eskiden ikisi de yoksa `Buffer.from(...)` çağrısı
// "ReferenceError: Buffer is not defined" ile çöküyordu ve bu SADECE native build'de
// ortaya çıkıyordu (web'de btoa var olduğu için hiç tetiklenmiyordu).
function encodeBase64(bytes: Uint8Array): string {
  let output = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : undefined;
    const b2 = i + 2 < len ? bytes[i + 2] : undefined;

    output += BASE64_CHARS[b0 >> 2];
    output += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 !== undefined ? b1 >> 4 : 0)];
    output += b1 !== undefined ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 !== undefined ? b2 >> 6 : 0)] : '=';
    output += b2 !== undefined ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return output;
}

const WAV_CACHE: Partial<Record<SoundThemeId, string>> = {};

// Deterministic PRNG (mulberry32) so every generation run produces identical noise,
// keeping the app-side preview/loop bit-for-bit consistent with the baked .wav assets
// shipped for native notification sounds (see scripts/bake-sound-assets.js).
function makeRandom(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Basit ADSR zarfı (0..1 aralığında amplitüd çarpanı üretir).
function envelope(t: number, attack: number, decay: number, sustainLevel: number, sustainEnd: number, release: number): number {
  if (t < attack) return t / attack;
  if (t < attack + decay) {
    const d = (t - attack) / decay;
    return 1 - d * (1 - sustainLevel);
  }
  if (t < sustainEnd) return sustainLevel;
  if (t < sustainEnd + release) {
    const r = (t - sustainEnd) / release;
    return sustainLevel * (1 - r);
  }
  return 0;
}

// Zengin (temel + üst armonikler) bir sinüs tonu — tek bir sinüsten daha "gerçek" ve dolgun çalar.
function richTone(freq: number, t: number): number {
  return (
    Math.sin(2 * Math.PI * freq * t) * 1.0 +
    Math.sin(2 * Math.PI * freq * 2 * t) * 0.28 +
    Math.sin(2 * Math.PI * freq * 3 * t) * 0.12
  );
}

export type ThemeSampleFn = (t: number, sampleRate: number, next: () => number, brownState: { v: number }) => number;

const SAMPLE_RATE = 44100;

const THEME_DURATIONS: Record<SoundThemeId, number> = {
  classic: 1.4,
  digital: 1.3,
  melodic: 2.0,
  soft: 2.2,
  energetic: 1.6,
  rain: 3.0,
  ocean: 4.0,
  forest: 4.0,
  focus: 4.0,
  white_noise: 3.0,
};

// Her tema için tek örnek üreten saf fonksiyon — hem uygulama içi (data URI) hem de
// native bildirim sesleri için gömülen gerçek .wav dosyaları (scripts/bake-sound-assets.js)
// AYNI matematikten üretilir, böylece önizleme/çalma her yerde birebir tutarlı olur.
export function computeThemeSample(
  themeId: SoundThemeId,
  t: number,
  next: () => number,
  brownState: { v: number }
): number {
  switch (themeId) {
    case 'rain': {
      // Yağmur: yumuşatılmış (üç örnek ortalaması) pembe gürültü tabanı + rastgele damla vuruşları
      const n1 = next();
      const n2 = next();
      const n3 = next();
      const pink = (n1 + n2 + n3) / 3 - 0.5;
      const isDrop = next() > 0.988;
      const drop = isDrop ? Math.sin(2 * Math.PI * (1100 + next() * 700) * t) * 0.5 * envelope(t % 0.06, 0.002, 0.02, 0.3, 0.03, 0.02) : 0;
      return pink * 0.42 + drop;
    }
    case 'ocean': {
      // Deniz: kahverengi (brown/red) gürültüyle taşan yavaş dalga zarfı + köpük tısı
      const leak = 0.985;
      brownState.v = brownState.v * leak + (next() - 0.5) * 0.25;
      const brown = Math.max(-1, Math.min(1, brownState.v * 2.4));
      const waveEnv = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.18 * t), 1.6);
      const rumble = richTone(90, t) * 0.18;
      const foam = (next() - 0.5) * 0.22;
      return waveEnv * (brown * 0.55 + rumble + foam);
    }
    case 'forest': {
      // Orman: kahverengi rüzgar gürültüsü + iki uyumlu ton + ara sıra kısa kuş cıvıltısı
      const leak = 0.98;
      brownState.v = brownState.v * leak + (next() - 0.5) * 0.18;
      const wind = Math.max(-1, Math.min(1, brownState.v * 2.2)) * 0.28;
      const sway = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.22 * t);
      const tone1 = Math.sin(2 * Math.PI * 329.63 * t) * 0.16;
      const tone2 = Math.sin(2 * Math.PI * 493.88 * t) * 0.1;
      const chirp = next() > 0.9985 ? Math.sin(2 * Math.PI * (2200 + next() * 900) * ((t * 37) % 1)) * 0.22 : 0;
      return wind + sway * (tone1 + tone2) + chirp;
    }
    case 'focus': {
      // Odaklanma: 210Hz taşıyıcı + 14Hz izokronik beta vuruşu, yumuşak zarfla
      const beatShape = 0.5 + 0.5 * Math.sin(2 * Math.PI * 14 * t);
      const beat = Math.pow(beatShape, 1.4);
      const carrier = richTone(210, t) * 0.34;
      return beat * carrier;
    }
    case 'white_noise': {
      // Beyaz/pembe gürültü: birkaç örneğin ortalaması ile daha yumuşak, kulağa daha "gerçek" gelen doku
      const n1 = next();
      const n2 = next();
      const n3 = next();
      const n4 = next();
      return ((n1 + n2 + n3 + n4) / 4 - 0.5) * 0.6;
    }
    case 'classic': {
      // Radar Klasik: iki net bip (880Hz -> 1760Hz), zengin armonik + net zarf
      if (t < 0.16) {
        return richTone(880, t) * 0.5 * envelope(t, 0.005, 0.03, 0.75, 0.1, 0.05);
      }
      if (t >= 0.2 && t < 0.42) {
        const lt = t - 0.2;
        return richTone(1760, t) * 0.5 * envelope(lt, 0.005, 0.03, 0.75, 0.13, 0.05);
      }
      return 0;
    }
    case 'digital': {
      // Dijital Saat: 523Hz civarında 3 net stakkato vuruş, yumuşatılmış kare dalga (üst armonikler azaltılarak)
      const bursts: [number, number][] = [
        [0.0, 0.09],
        [0.13, 0.22],
        [0.26, 0.35],
      ];
      for (const [start, end] of bursts) {
        if (t >= start && t < end) {
          const lt = t - start;
          const env = envelope(lt, 0.004, 0.02, 0.8, end - start - 0.03, 0.02);
          return richTone(523.25, t) * 0.45 * env;
        }
      }
      return 0;
    }
    case 'melodic': {
      // Melodik Akor: 4 nota (C5 -> E5 -> G5 -> C6), zil gibi üstel sönümlü zarf
      const notes: [number, number, number][] = [
        [523.25, 0, 0.16],
        [659.25, 0.15, 0.16],
        [783.99, 0.3, 0.16],
        [1046.5, 0.45, 0.32],
      ];
      let sample = 0;
      for (const [freq, start, len] of notes) {
        if (t >= start && t < start + len + 0.15) {
          const lt = t - start;
          const decay = Math.exp(-lt * 5.5);
          sample += richTone(freq, t) * 0.42 * decay;
        }
      }
      return sample;
    }
    case 'soft': {
      // Yumuşak Melodi: sakin iki nota (A4 -> C#5), hafif vibrato ile geniş yumuşak zarf
      if (t < 0.4) {
        const env = Math.sin(Math.PI * Math.min(1, t / 0.4));
        const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
        return richTone(440 * vibrato, t) * 0.38 * env;
      }
      if (t >= 0.44 && t < 0.95) {
        const lt = t - 0.44;
        const env = Math.sin(Math.PI * Math.min(1, lt / 0.51));
        const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
        return richTone(554.37 * vibrato, t) * 0.4 * env;
      }
      return 0;
    }
    case 'energetic': {
      // Enerjik Alert: hızlı dönüşümlü yüksek uyarı vuruşları, keskin zarf
      if (t < 0.5) {
        const slot = Math.floor(t * 10);
        const freq = slot % 2 === 0 ? 1318.5 : 1760.0;
        const lt = t - slot / 10;
        const env = envelope(lt, 0.003, 0.02, 0.7, 0.06, 0.02);
        return richTone(freq, t) * 0.45 * env;
      }
      return 0;
    }
  }
}

function synthesizeThemePCM(themeId: SoundThemeId): Int16Array {
  const duration = THEME_DURATIONS[themeId];
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const pcm = new Int16Array(numSamples);
  const next = makeRandom(1337);
  const brownState = { v: 0 };

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const raw = computeThemeSample(themeId, t, next, brownState);
    const clamped = Math.max(-1, Math.min(1, raw));
    pcm[i] = Math.round(clamped * 32767);
  }
  return pcm;
}

export function generateWavDataUri(themeId: SoundThemeId): string {
  if (WAV_CACHE[themeId]) {
    return WAV_CACHE[themeId]!;
  }

  const pcm = synthesizeThemePCM(themeId);
  const dataSize = pcm.length * 2; // 16-bit = 2 bayt/örnek
  const fileSize = 44 + dataSize;

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // RIFF başlığı
  buffer.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, fileSize - 8, true);
  buffer.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt alt-bloğu
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (PCM için 16)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, SAMPLE_RATE, true); // SampleRate
  view.setUint32(28, SAMPLE_RATE * 2, true); // ByteRate (16-bit mono)
  view.setUint16(32, 2, true); // BlockAlign (16-bit mono)
  view.setUint16(34, 16, true); // BitsPerSample

  // data alt-bloğu
  buffer.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * 2, pcm[i], true);
  }

  const base64 = encodeBase64(buffer);
  const uri = `data:audio/wav;base64,${base64}`;
  WAV_CACHE[themeId] = uri;
  return uri;
}
