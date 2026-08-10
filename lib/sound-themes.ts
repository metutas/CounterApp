export type SoundThemeId =
  | 'classic'
  | 'digital'
  | 'melodic'
  | 'soft'
  | 'energetic'
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'focus'
  | 'white_noise';

export type SoundTheme = {
  id: SoundThemeId;
  name: string;
  badge: string;
  description: string;
  category?: 'alarm' | 'ambient';
};

export const SOUND_THEMES: SoundTheme[] = [
  {
    id: 'rain',
    name: 'Yağmur Sesi',
    badge: 'Yağmur 🌧️',
    description: 'Huzur veren ritmik yağmur damlaları',
    category: 'ambient',
  },
  {
    id: 'ocean',
    name: 'Deniz Dalgaları',
    badge: 'Dalga 🌊',
    description: 'Dinlendirici okyanus dalgası sesi',
    category: 'ambient',
  },
  {
    id: 'forest',
    name: 'Orman & Rüzgar',
    badge: 'Orman 🌿',
    description: 'Doğa melodileri ve hafif rüzgar',
    category: 'ambient',
  },
  {
    id: 'focus',
    name: 'Odaklanma Frekansı',
    badge: 'Odak 🧠',
    description: 'Derin ders çalışma 14Hz Beta tonu',
    category: 'ambient',
  },
  {
    id: 'white_noise',
    name: 'Beyaz Gürültü',
    badge: 'Gürültü 📻',
    description: 'Sakinleştirici arka plan çalışma sesi',
    category: 'ambient',
  },
  {
    id: 'classic',
    name: 'Radar Klasik',
    badge: 'Klasik',
    description: 'Yüksek ve keskin ikili bip sesi',
    category: 'alarm',
  },
  {
    id: 'digital',
    name: 'Dijital Saat',
    badge: 'Dijital',
    description: 'Retro 8-bit stakkato saat alarmı',
    category: 'alarm',
  },
  {
    id: 'melodic',
    name: 'Melodik Akor',
    badge: 'Melodik',
    description: 'Yükselen 4 notalı zil melodisi',
    category: 'alarm',
  },
  {
    id: 'soft',
    name: 'Yumuşak Melodi',
    badge: 'Yumuşak',
    description: 'Sakin ve dinlendirici ılık ton',
    category: 'alarm',
  },
  {
    id: 'energetic',
    name: 'Enerjik Alert',
    badge: 'Enerjik',
    description: 'Hızlı ve dikkat çekici yüksek ton',
    category: 'alarm',
  },
];
