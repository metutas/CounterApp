#!/usr/bin/env node
/**
 * assets/sounds/*.wav dosyalarını üretir.
 *
 * Bu script, lib/wav-generator.ts içindeki senteleme matematiğinin BİREBİR aynısını
 * (Node/CommonJS'e taşınmış hâlini) kullanır. Native bildirim sesleri (expo-notifications
 * "sounds" config plugin) dosya sistemine gömülü gerçek .wav dosyaları gerektirir; JS ile
 * anlık üretilen data URI'ler bildirim sesi olarak KULLANILAMAZ, sadece uygulama-içi önizleme
 * ve alarm çalarken foreground'da loop için kullanılabilir.
 *
 * ÖNEMLİ: lib/wav-generator.ts içindeki tema formüllerini değiştirirsen, buradaki eşleniğini
 * de güncelleyip `node scripts/bake-sound-assets.js` çalıştırarak assets/sounds/ altındaki
 * dosyaları yeniden üret — aksi hâlde uygulama-içi önizleme ile gerçek bildirim sesi
 * birbirinden farklı duyulur.
 *
 * Çalıştırma: node scripts/bake-sound-assets.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

const THEME_DURATIONS = {
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

function makeRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function envelope(t, attack, decay, sustainLevel, sustainEnd, release) {
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

function richTone(freq, t) {
  return (
    Math.sin(2 * Math.PI * freq * t) * 1.0 +
    Math.sin(2 * Math.PI * freq * 2 * t) * 0.28 +
    Math.sin(2 * Math.PI * freq * 3 * t) * 0.12
  );
}

function computeThemeSample(themeId, t, next, brownState) {
  switch (themeId) {
    case 'rain': {
      const n1 = next();
      const n2 = next();
      const n3 = next();
      const pink = (n1 + n2 + n3) / 3 - 0.5;
      const isDrop = next() > 0.988;
      const drop = isDrop
        ? Math.sin(2 * Math.PI * (1100 + next() * 700) * t) * 0.5 * envelope(t % 0.06, 0.002, 0.02, 0.3, 0.03, 0.02)
        : 0;
      return pink * 0.42 + drop;
    }
    case 'ocean': {
      const leak = 0.985;
      brownState.v = brownState.v * leak + (next() - 0.5) * 0.25;
      const brown = Math.max(-1, Math.min(1, brownState.v * 2.4));
      const waveEnv = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.18 * t), 1.6);
      const rumble = richTone(90, t) * 0.18;
      const foam = (next() - 0.5) * 0.22;
      return waveEnv * (brown * 0.55 + rumble + foam);
    }
    case 'forest': {
      const leak = 0.98;
      brownState.v = brownState.v * leak + (next() - 0.5) * 0.18;
      const wind = Math.max(-1, Math.min(1, brownState.v * 2.2)) * 0.28;
      const sway = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.22 * t);
      const tone1 = Math.sin(2 * Math.PI * 329.63 * t) * 0.16;
      const tone2 = Math.sin(2 * Math.PI * 493.88 * t) * 0.1;
      const chirp =
        next() > 0.9985 ? Math.sin(2 * Math.PI * (2200 + next() * 900) * ((t * 37) % 1)) * 0.22 : 0;
      return wind + sway * (tone1 + tone2) + chirp;
    }
    case 'focus': {
      const beatShape = 0.5 + 0.5 * Math.sin(2 * Math.PI * 14 * t);
      const beat = Math.pow(beatShape, 1.4);
      const carrier = richTone(210, t) * 0.34;
      return beat * carrier;
    }
    case 'white_noise': {
      const n1 = next();
      const n2 = next();
      const n3 = next();
      const n4 = next();
      return ((n1 + n2 + n3 + n4) / 4 - 0.5) * 0.6;
    }
    case 'classic': {
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
      const bursts = [
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
      const notes = [
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
      if (t < 0.5) {
        const slot = Math.floor(t * 10);
        const freq = slot % 2 === 0 ? 1318.5 : 1760.0;
        const lt = t - slot / 10;
        const env = envelope(lt, 0.003, 0.02, 0.7, 0.06, 0.02);
        return richTone(freq, t) * 0.45 * env;
      }
      return 0;
    }
    default:
      return 0;
  }
}

function synthesizeThemePCM(themeId) {
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

function writeWavFile(filePath, pcm) {
  const dataSize = pcm.length * 2;
  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8, 'ascii');

  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < pcm.length; i++) {
    buffer.writeInt16LE(pcm[i], 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const themeId of Object.keys(THEME_DURATIONS)) {
  const pcm = synthesizeThemePCM(themeId);
  const filePath = path.join(OUT_DIR, `${themeId}.wav`);
  writeWavFile(filePath, pcm);
  console.log(`✓ ${themeId}.wav (${THEME_DURATIONS[themeId]}s, ${(pcm.length * 2 / 1024).toFixed(0)} KB)`);
}

console.log(`\nTamamlandı: ${Object.keys(THEME_DURATIONS).length} ses dosyası -> ${OUT_DIR}`);
