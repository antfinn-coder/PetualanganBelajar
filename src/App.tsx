import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 1. AUDIO ENGINE (Web Audio API Prosedural)
// ==========================================
class WebAudioEngine {
  ctx: AudioContext | null = null;
  bgmGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  bgmVolume = 0.4;
  sfxVolume = 0.7;
  isMuted = false;
  timerId: number | null = null;
  stepIndex = 0;
  currentTheme = 'menu';

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    this.bgmGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setBgmVolume(val: number) {
    this.bgmVolume = val;
    if (!this.isMuted && this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(val: number) {
    this.sfxVolume = val;
    if (!this.isMuted && this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmGain && this.sfxGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.isMuted ? 0 : this.bgmVolume, this.ctx.currentTime, 0.05);
      this.sfxGain.gain.setTargetAtTime(this.isMuted ? 0 : this.sfxVolume, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  duckBgm(duck = true) {
    if (!this.bgmGain || this.isMuted || !this.ctx) return;
    const target = duck ? this.bgmVolume * 0.25 : this.bgmVolume;
    this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  playNote(freq: number, dur = 0.3, type: OscillatorType = 'sine', dest: GainNode | null = this.bgmGain) {
    if (!this.ctx || this.isMuted || !dest) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      g.gain.setValueAtTime(0.2, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);

      osc.connect(g);
      g.connect(dest);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch {
      // AudioContext fallback
    }
  }

  startBgm(theme = 'menu') {
    this.init();
    this.resume();
    if (this.timerId) clearInterval(this.timerId);
    this.currentTheme = theme;
    this.stepIndex = 0;

    const C4 = 261.6, D4 = 293.7, E4 = 329.6, G4 = 392.0, A4 = 440.0;
    const C5 = 523.3, D5 = 587.3, E5 = 659.3;

    let melody: number[] = [];
    let intervalTime = 300;

    if (theme === 'menu') {
      melody = [C4, E4, G4, A4, G4, E4, C5, A4, G4, E4, D4, C4];
      intervalTime = 280;
    } else if (theme === 'game') {
      melody = [E4, G4, A4, G4, E4, D4, E4, C4];
      intervalTime = 380;
    } else if (theme === 'win') {
      melody = [C4, E4, G4, C5, E5, C5, G4, C5];
      intervalTime = 220;
    }

    this.timerId = window.setInterval(() => {
      const note = melody[this.stepIndex % melody.length];
      this.playNote(note, 0.45, 'triangle', this.bgmGain);
      if (this.stepIndex % 4 === 0) {
        this.playNote(130.8, 0.5, 'sine', this.bgmGain);
      }
      this.stepIndex++;
    }, intervalTime);
  }

  stopBgm() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  playSfx(type: 'tap' | 'correct' | 'wrong' | 'star' | 'pop' | 'fanfare') {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    try {
      switch (type) {
        case 'tap': {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
          g.gain.setValueAtTime(0.3, now);
          g.gain.linearRampToValueAtTime(0.01, now + 0.08);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start();
          osc.stop(now + 0.08);
          break;
        }
        case 'correct': {
          this.playNote(523.3, 0.15, 'sine', this.sfxGain);
          setTimeout(() => this.playNote(659.3, 0.15, 'sine', this.sfxGain), 120);
          setTimeout(() => this.playNote(784.0, 0.35, 'sine', this.sfxGain), 240);
          break;
        }
        case 'wrong': {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(140, now + 0.35);
          g.gain.setValueAtTime(0.2, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start();
          osc.stop(now + 0.35);
          break;
        }
        case 'star': {
          [659.3, 784.0, 987.8, 1318.5].forEach((f, i) => {
            setTimeout(() => this.playNote(f, 0.2, 'triangle', this.sfxGain), i * 80);
          });
          break;
        }
        case 'pop': {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
          g.gain.setValueAtTime(0.25, now);
          g.gain.linearRampToValueAtTime(0.01, now + 0.1);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start();
          osc.stop(now + 0.1);
          break;
        }
        case 'fanfare': {
          [523.3, 659.3, 784.0, 1046.5].forEach((f, i) => {
            setTimeout(() => this.playNote(f, 0.4, 'square', this.sfxGain), i * 140);
          });
          break;
        }
      }
    } catch {
      // AudioContext fallback
    }
  }
}

const audioEngine = new WebAudioEngine();

// ==========================================
// 2. TYPES & DATA STRUKTUR
// ==========================================
type IslandKey = 'huruf' | 'angka' | 'warna' | 'alam' | 'budi' | 'kreasi';

interface IslandStars {
  huruf: number;
  angka: number;
  warna: number;
  alam: number;
  budi: number;
  kreasi: number;
}

interface Question {
  type: 'choice' | 'tap_count' | 'memory' | 'puzzle' | 'draw';
  q: string;
  prompt?: string;
  speech: string;
  options?: string[];
  correct?: string | number;
  count?: number;
  icon?: string;
}

const QUESTION_BANK: Record<IslandKey, Question[]> = {
  huruf: [
    { type: 'choice', q: "Cari huruf A besar!", prompt: "Cari Huruf: [ ? ]", speech: "Yang manakah huruf A besar?", options: ["A", "B", "C", "D"], correct: "A" },
    { type: 'choice', q: "Pasangan huruf kecil B adalah...", prompt: "B ➔ [ ? ]", speech: "Cari huruf kecil untuk huruf B!", options: ["b", "d", "p", "q"], correct: "b" },
    { type: 'choice', q: "Apel diawali huruf apa?", prompt: "🍎 [ ? ] - PEL", speech: "Apel yang manis diawali huruf apa ya?", options: ["A", "M", "P", "K"], correct: "A" },
    { type: 'choice', q: "Bola diawali huruf apa?", prompt: "⚽ [ ? ] - LA", speech: "Bola yang bulat diawali huruf apa?", options: ["B", "C", "O", "T"], correct: "B" },
    { type: 'choice', q: "Gajah diawali huruf apa?", prompt: "🐘 [ ? ] - JAH", speech: "Gajah yang besar diawali huruf apa?", options: ["G", "J", "H", "F"], correct: "G" },
    { type: 'choice', q: "Ikan diawali huruf apa?", prompt: "🐟 [ ? ] - KAN", speech: "Ikan yang lincah diawali huruf apa?", options: ["I", "L", "U", "O"], correct: "I" },
    { type: 'choice', q: "Lengkapi kata BOLA!", prompt: "⚽ BO - L [ ? ]", speech: "Lengkapi kata Bola. Huruf apa yang hilang di belakang?", options: ["A", "I", "U", "E"], correct: "A" },
    { type: 'choice', q: "Lengkapi kata IBU!", prompt: "👩 I - B [ ? ]", speech: "Lengkapi kata Ibu. Huruf terakhirnya apa ya?", options: ["U", "A", "O", "E"], correct: "U" },
    { type: 'choice', q: "Lengkapi kata AYAM!", prompt: "🐔 A - YA - [ ? ]", speech: "Lengkapi kata Ayam. Huruf apa di ujung kata?", options: ["M", "N", "K", "S"], correct: "M" },
    { type: 'choice', q: "Lengkapi kata BUKU!", prompt: "📖 BU - K [ ? ]", speech: "Lengkapi kata Buku. Kurang huruf apa ya?", options: ["U", "I", "A", "O"], correct: "U" }
  ],
  angka: [
    { type: 'choice', q: "Tunjukkan angka 3!", prompt: "Tiga 🌸🌸🌸", speech: "Pilih lambang angka tiga!", options: ["3", "1", "5", "2"], correct: "3" },
    { type: 'choice', q: "Tunjukkan angka 7!", prompt: "Tujuh 🎈", speech: "Pilih lambang angka tujuh!", options: ["7", "4", "9", "1"], correct: "7" },
    { type: 'tap_count', q: "Hitung ada berapa jeruk di layar?", count: 4, icon: "🍊", speech: "Sentuh tiap jeruk untuk menghitungnya ya!", correct: 4 },
    { type: 'tap_count', q: "Hitung ada berapa bintang cerah?", count: 5, icon: "⭐", speech: "Ayo hitung ada berapa bintang di atas!", correct: 5 },
    { type: 'choice', q: "Ada berapa bebek di sini?", prompt: "🦆 🦆 🦆", speech: "Ayo hitung, ada berapa bebek di situ?", options: ["3", "2", "4", "5"], correct: "3" },
    { type: 'choice', q: "Angka berapa yang hilang?", prompt: "1 , 2 , [ ? ] , 4", speech: "Satu, dua, lalu angka berapa sebelum empat?", options: ["3", "5", "0", "6"], correct: "3" },
    { type: 'choice', q: "Angka berapa yang hilang?", prompt: "4 , 5 , [ ? ] , 7", speech: "Empat, lima, setelah itu angka berapa?", options: ["6", "8", "3", "9"], correct: "6" },
    { type: 'choice', q: "Berapa jumlah permen?", prompt: "🍬 + 🍬 = [ ? ]", speech: "Satu permen ditambah satu permen, jadi berapa ya?", options: ["2", "1", "3", "4"], correct: "2" },
    { type: 'choice', q: "Berapa jumlah balon?", prompt: "🎈🎈 + 🎈🎈 = [ ? ]", speech: "Dua balon ditambah dua balon, jadi berapa?", options: ["4", "3", "5", "6"], correct: "4" },
    { type: 'choice', q: "Ada 3 kue, dimakan 1. Sisa berapa?", prompt: "🧁🧁🧁 - 🧁 = [ ? ]", speech: "Ada tiga kue lezat, dimakan satu. Sisa berapa ya?", options: ["2", "1", "3", "0"], correct: "2" }
  ],
  warna: [
    { type: 'choice', q: "Warna buah stroberi yang manis?", prompt: "🍓 Stroberi", speech: "Buah stroberi manis ini warnanya apa ya?", options: ["🔴 Merah", "🔵 Biru", "🟡 Kuning", "🟢 Hijau"], correct: "🔴 Merah" },
    { type: 'choice', q: "Warna daun pohon yang segar?", prompt: "🍃 Daun Segar", speech: "Daun pohon yang segar ini warnanya apa?", options: ["🟢 Hijau", "🟣 Ungu", "🟠 Jingga", "⚪ Putih"], correct: "🟢 Hijau" },
    { type: 'choice', q: "Warna buah pisang yang sudah matang?", prompt: "🍌 Pisang Matang", speech: "Pisang matang yang manis warnanya apa ya?", options: ["🟡 Kuning", "🔵 Biru", "🔴 Merah", "⚫ Hitam"], correct: "🟡 Kuning" },
    { type: 'choice', q: "Bentuk apakah roda sepeda?", prompt: "🚲 ⚙️ Roda Sepeda", speech: "Roda sepeda yang berputar bentuknya apa ya?", options: ["Lingkaran ⭕", "Persegi ⬛", "Segitiga 🔺", "Bintang ⭐"], correct: "Lingkaran ⭕" },
    { type: 'choice', q: "Bentuk apakah atap rumah ini?", prompt: "🏠 Atap Rumah", speech: "Atap rumah yang mengerucut bentuknya apa?", options: ["Segitiga 🔺", "Persegi ⬛", "Hati ❤️", "Lonjong ⬭"], correct: "Segitiga 🔺" },
    { type: 'choice', q: "Bentuk apakah bingkai foto ini?", prompt: "🖼️ Bingkai Foto", speech: "Bingkai foto yang sisinya sama panjang bentuknya apa?", options: ["Persegi ⬛", "Lingkaran ⭕", "Bintang ⭐", "Segitiga 🔺"], correct: "Persegi ⬛" },
    { type: 'choice', q: "Cari bentuk HATI penuh kasih sayang!", prompt: "Kasih Sayang 💖", speech: "Yang manakah bentuk hati lambang cinta?", options: ["Hati ❤️", "Kotak ⬛", "Bintang ⭐", "Lingkaran ⭕"], correct: "Hati ❤️" },
    { type: 'choice', q: "Lanjutkan pola warna:", prompt: "🔴 🔵 🔴 [ ? ]", speech: "Merah, biru, merah, setelah itu warna apa?", options: ["🔵 Biru", "🔴 Merah", "🟡 Kuning", "🟢 Hijau"], correct: "🔵 Biru" },
    { type: 'choice', q: "Lanjutkan pola buah:", prompt: "🍎 🍌 🍎 [ ? ]", speech: "Apel, pisang, apel, setelah itu buah apa?", options: ["🍌 Pisang", "🍎 Apel", "🍇 Anggur", "🍊 Jeruk"], correct: "🍌 Pisang" },
    { type: 'choice', q: "Campuran warna Merah dan Kuning jadi apa?", prompt: "🔴 + 🟡 = [ ? ]", speech: "Cat merah dicampur warna kuning, jadi warna apa?", options: ["🟠 Jingga", "🟢 Hijau", "🟣 Ungu", "🟤 Cokelat"], correct: "🟠 Jingga" }
  ],
  alam: [
    { type: 'choice', q: "Hewan yang bersuara 'Embeeek'?", prompt: '"Mbeeek! 🌿"', speech: "Siapakah yang suka bersuara embeeeek?", options: ["🐐 Kambing", "🐱 Kucing", "🦁 Singa", "🐔 Ayam"], correct: "🐐 Kambing" },
    { type: 'choice', q: "Hewan yang berkokok di pagi hari?", prompt: '"Kukuruyuk! 🌅"', speech: "Siapa yang berkokok membangunkan kita di pagi hari?", options: ["🐔 Ayam Jago", "🦆 Bebek", "🐄 Sapi", "🐸 Katak"], correct: "🐔 Ayam Jago" },
    { type: 'choice', q: "Hewan yang menghasilkan susu?", prompt: "🥛 Penghasil Susu", speech: "Hewan pemakan rumput yang menghasilkan susu sehat?", options: ["🐄 Sapi", "🐱 Kucing", "🐯 Harimau", "🐊 Buaya"], correct: "🐄 Sapi" },
    { type: 'choice', q: "Hewan yang hidup dan berenang di air?", prompt: "🌊 Berenang Bebas", speech: "Hewan apa yang hidup dan berenang di dalam air?", options: ["🐟 Ikan", "🐰 Kelinci", "🐒 Monyet", "🐎 Kuda"], correct: "🐟 Ikan" },
    { type: 'choice', q: "Hewan lincah yang suka buah pisang?", prompt: "🍌 Suka Pisang", speech: "Hewan lincah yang suka bergelantungan di pohon?", options: ["🐒 Monyet", "🐘 Gajah", "🐢 Kura-kura", "🦌 Kancil"], correct: "🐒 Monyet" },
    { type: 'choice', q: "Tanaman perlu disiram dengan apa?", prompt: "🪴 🌻 Tanaman", speech: "Agar tanaman tumbuh subur dan berbunga, harus disiram apa?", options: ["💧 Air", "🛢️ Minyak", "🥤 Sirup", "🏖️ Pasir"], correct: "💧 Air" },
    { type: 'choice', q: "Benda langit terang di siang hari?", prompt: "Siang Hari ☀️", speech: "Benda langit yang terbit di pagi hari menyinari bumi?", options: ["☀️ Matahari", "🌙 Bulan", "⭐ Bintang", "🌧️ Awan Gelap"], correct: "☀️ Matahari" },
    { type: 'choice', q: "Air yang turun beramai-ramai dari langit?", prompt: "☁️ 🌧️ ☔", speech: "Air berjatuhan dari langit beramai-ramai, cuaca apa ya?", options: ["🌧️ Hujan", "☀️ Panas", "🌪️ Angin", "❄️ Salju"], correct: "🌧️ Hujan" },
    { type: 'choice', q: "Bagian tubuh untuk melihat benda?", prompt: "Melihat Benda 🖼️", speech: "Bagian tubuh yang kita gunakan untuk melihat?", options: ["👀 Mata", "👂 Telinga", "👃 Hidung", "🦶 Kaki"], correct: "👀 Mata" },
    { type: 'choice', q: "Bagian tubuh untuk mendengar suara?", prompt: "Mendengar Suara 🎵", speech: "Bagian tubuh yang kita gunakan untuk mendengar suara?", options: ["👂 Telinga", "👄 Mulut", "🖐️ Tangan", "👅 Lidah"], correct: "👂 Telinga" }
  ],
  budi: [
    { type: 'choice', q: "Sebelum makan lezat, apa yang kita lakukan?", prompt: "🍽️ Hendak Makan", speech: "Sebelum kita menikmati makanan, kita harus apa dulu ya?", options: ["Cuci Tangan & Doa", "Langsung Lari", "Tidur", "Menangis"], correct: "Cuci Tangan & Doa" },
    { type: 'choice', q: "Di mana kita membuang bungkus sampah?", prompt: "🧃 Bungkus Snack", speech: "Kalau ada bungkus makanan, buangnya ke mana?", options: ["Tempat Sampah 🗑️", "Lantai Kamar 🛋️", "Sungai 🌊", "Halaman 🌿"], correct: "Tempat Sampah 🗑️" },
    { type: 'choice', q: "Saat bertemu teman dan guru, kita...", prompt: "🏫 Bertemu Guru", speech: "Ketika berpapasan dengan guru dan teman, sikap kita?", options: ["Menyapa Ramah 😊", "Sembunyi 🫣", "Marah-marah 😡", "Diam Saja 🤐"], correct: "Menyapa Ramah 😊" },
    { type: 'choice', q: "Bila teman tidak membawa pensil warna, kita...", prompt: "🖍️ Butuh Pensil", speech: "Jika teman tidak punya pensil warna, apa yang kita lakukan?", options: ["Berbagi Pensil 🤝", "Mengejek 😜", "Sembunyikan 🙈", "Marahi 😠"], correct: "Berbagi Pensil 🤝" },
    { type: 'choice', q: "Saat mengantre bermain ayunan, kita harus...", prompt: "🎠 Main Bersama", speech: "Agar rukun bergantian main ayunan, kita harus apa?", options: ["Antre Sabar 🚶♀️", "Mendorong 🫸", "Menyerobot 🏃", "Berteriak 📢"], correct: "Antre Sabar 🚶♀️" },
    { type: 'choice', q: "Bila tidak sengaja menyenggol teman, ucapkan...", prompt: "Menyenggol Teman", speech: "Kalau kita berbuat keliru tanpa sengaja, kita ucapkan apa?", options: ["Minta Maaf 🙏", "Biarin Aja 😝", "Tertawa 😆", "Marah 😠"], correct: "Minta Maaf 🙏" },
    { type: 'choice', q: "Bila diberi kue atau hadiah, kita ucapkan...", prompt: "🎁 Diberi Hadiah", speech: "Saat diberi hadiah atau kue lezat, apa yang kita katakan?", options: ["Terima Kasih 🥰", "Minta Tambah 🤲", "Diam Saja 😶", "Pergi Lari 🏃"], correct: "Terima Kasih 🥰" },
    { type: 'choice', q: "Sebelum tidur di malam hari, sebaiknya...", prompt: "🛏️ Sebelum Tidur", speech: "Sebelum tidur malam di kasur yang empuk, kita sebaiknya apa?", options: ["Doa & Sikat Gigi ✨", "Main HP Terus 📱", "Makan Permen 🍬", "Menangis 😭"], correct: "Doa & Sikat Gigi ✨" },
    { type: 'choice', q: "Wajah tersenyum riang menandakan rasa...", prompt: "😃 Tersenyum", speech: "Wajah tersenyum gembira menandakan perasaan apa?", options: ["Senang Banget 🥰", "Sedih Sekali 😢", "Takut 😨", "Marah 😡"], correct: "Senang Banget 🥰" },
    { type: 'choice', q: "Melihat sahabat sedang menangis sedih, kita...", prompt: "😢 Sahabat Sedih", speech: "Melihat sahabat sedang bersedih, apa yang kita lakukan?", options: ["Hibur Teman 🫂", "Ikut Meledek 😆", "Tinggalkan 🚶", "Cemberut 😠"], correct: "Hibur Teman 🫂" }
  ],
  kreasi: [
    { type: 'memory', q: "Cari pasangan gambar yang sama!", speech: "Ayo buka kartu dan cari pasangan hewan yang kembar!" },
    { type: 'puzzle', q: "Susun puzzle buah segar ini!", speech: "Tekan kepingan gambar hingga tersusun rapi!" },
    { type: 'draw', q: "Warnai gambar bebas sesukamu!", speech: "Gunakan jarimu dan pilih warna indah kesukaanmu!" }
  ]
};

const ISLANDS_INFO: Array<{ key: IslandKey; title: string; icon: string }> = [
  { key: 'huruf', title: 'Pulau Huruf', icon: '🔤' },
  { key: 'angka', title: 'Pulau Angka', icon: '🔢' },
  { key: 'warna', title: 'Warna & Bentuk', icon: '🎨' },
  { key: 'alam', title: 'Hewan & Alam', icon: '🦁' },
  { key: 'budi', title: 'Budi Pekerti', icon: '🤲' },
  { key: 'kreasi', title: 'Pulau Kreasi', icon: '🧩' },
];

const BADGES_CONFIG = [
  { name: "Kancil Lincah", icon: "🦌", req: 3 },
  { name: "Gajah Kuat", icon: "🐘", req: 6 },
  { name: "Burung Cerdas", icon: "🦜", req: 9 },
  { name: "Kucing Manis", icon: "🐱", req: 12 },
  { name: "Lumba Ceria", icon: "🐬", req: 15 },
  { name: "Mahkota Emas", icon: "👑", req: 18 }
];

// ==========================================
// 3. KOMPONEN MASKOT SI KANCIL
// ==========================================
const KancilSvg: React.FC<{ mood?: 'happy' | 'sad' | 'idle'; isSpeaking?: boolean }> = ({ mood = 'idle' }) => {
  const moodClass = mood === 'happy' ? 'kancil-happy' : mood === 'sad' ? 'kancil-sad' : 'kancil-breathe';

  return (
    <div className={`w-20 h-20 flex-shrink-0 drop-shadow-md ${moodClass}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Telinga Kiri */}
        <ellipse cx="27" cy="22" rx="9" ry="18" transform="rotate(-28 27 22)" fill="#c27803" stroke="#9a3412" strokeWidth="1.5" />
        <ellipse cx="27" cy="22" rx="5" ry="12" transform="rotate(-28 27 22)" fill="#fca5a5" />
        {/* Telinga Kanan */}
        <ellipse cx="73" cy="22" rx="9" ry="18" transform="rotate(28 73 22)" fill="#c27803" stroke="#9a3412" strokeWidth="1.5" />
        <ellipse cx="73" cy="22" rx="5" ry="12" transform="rotate(28 73 22)" fill="#fca5a5" />
        {/* Badan */}
        <path d="M 24 82 C 20 60, 32 50, 50 50 C 68 50, 80 60, 76 82 C 72 94, 28 94, 24 82 Z" fill="#d97706" />
        {/* Dada Putih */}
        <path d="M 37 58 Q 50 56 63 58 Q 60 84 50 86 Q 40 84 37 58 Z" fill="#fffbeb" />
        {/* Bintik Putih Kancil */}
        <circle cx="27" cy="70" r="2.2" fill="#ffffff" opacity="0.9" />
        <circle cx="28" cy="78" r="1.8" fill="#ffffff" opacity="0.9" />
        <circle cx="73" cy="70" r="2.2" fill="#ffffff" opacity="0.9" />
        <circle cx="72" cy="78" r="1.8" fill="#ffffff" opacity="0.9" />
        {/* Kepala */}
        <ellipse cx="50" cy="40" rx="26" ry="22" fill="#f59e0b" />
        <ellipse cx="50" cy="47" rx="13" ry="9" fill="#fffdf5" />
        {/* Tanduk Mini / Jambul */}
        <path d="M 45 20 Q 50 12 55 19 Q 58 14 60 21 Z" fill="#d97706" />
        {/* Mata Kiri */}
        <ellipse cx="37" cy="37" rx="6" ry="7.5" fill="#0f172a" />
        <ellipse cx="37" cy="38" rx="4.5" ry="5.5" fill="#78350f" />
        <circle cx="35" cy="34.5" r="2.5" fill="#ffffff" />
        <circle cx="39" cy="40" r="1.2" fill="#ffffff" />
        <path d="M 31 34 Q 36 30 42 33" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* Mata Kanan */}
        <ellipse cx="63" cy="37" rx="6" ry="7.5" fill="#0f172a" />
        <ellipse cx="63" cy="38" rx="4.5" ry="5.5" fill="#78350f" />
        <circle cx="61" cy="34.5" r="2.5" fill="#ffffff" />
        <circle cx="65" cy="40" r="1.2" fill="#ffffff" />
        <path d="M 58 33 Q 64 30 69 34" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* Pipi Merona */}
        <ellipse cx="28" cy="44" rx="4.5" ry="2.8" fill="#fb7185" opacity="0.75" />
        <ellipse cx="72" cy="44" rx="4.5" ry="2.8" fill="#fb7185" opacity="0.75" />
        {/* Hidung */}
        <path d="M 47 43.5 Q 50 42 53 43.5 Q 50 46.5 47 43.5 Z" fill="#1e1b4b" />
        <circle cx="49" cy="43" r="0.6" fill="#ffffff" />
        {/* Mulut Senyum */}
        <path d="M 46 47 Q 50 50 54 47" stroke="#1e1b4b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M 47.5 48 Q 50 52 52.5 48 Z" fill="#f43f5e" />
        {/* Syal Petualang Merah & Bros Emas */}
        <path d="M 33 55 Q 50 63 67 55 Q 50 69 33 55 Z" fill="#ef4444" />
        <polygon points="50,62 44,72 56,70" fill="#dc2626" />
        <circle cx="50" cy="62" r="2.5" fill="#facc15" />
        {/* Kaki Depan Lucu */}
        <ellipse cx="44" cy="72" rx="4.5" ry="5.5" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
        <ellipse cx="56" cy="72" rx="4.5" ry="5.5" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
        <ellipse cx="44" cy="75.5" rx="3" ry="1.5" fill="#78350f" />
        <ellipse cx="56" cy="75.5" rx="3" ry="1.5" fill="#78350f" />
      </svg>
    </div>
  );
};

// ==========================================
// 4. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [screen, setScreen] = useState<'splash' | 'menu' | 'game' | 'result'>('splash');
  const [playerName, setPlayerName] = useState('Kapten Cilik');
  const [islandStars, setIslandStars] = useState<IslandStars>({
    huruf: 0,
    angka: 0,
    warna: 0,
    alam: 0,
    budi: 0,
    kreasi: 0
  });

  // Audio & Speech Settings
  const [bgmVolume, setBgmVolumeState] = useState(0.4);
  const [sfxVolume, setSfxVolumeState] = useState(0.7);
  const [voiceVolume, setVoiceVolume] = useState(0.9);
  const [speechRate, setSpeechRate] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState<number>(0);

  // Mascot Speech State
  const [speechText, setSpeechText] = useState('Halo Kapten Cilik! Pilih pulau petualanganmu yuk!');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mascotMood, setMascotMood] = useState<'idle' | 'happy' | 'sad'>('idle');

  // Game Play State
  const [currentIsland, setCurrentIsland] = useState<IslandKey>('huruf');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [countedTaps, setCountedTaps] = useState<number[]>([]);
  const [activeChoiceFeedback, setActiveChoiceFeedback] = useState<{ index: number; isCorrect: boolean } | null>(null);
  const [revealedBlank, setRevealedBlank] = useState<string | null>(null);

  // Activity States (Kreasi)
  const [memoryCards, setMemoryCards] = useState<Array<{ id: number; icon: string; flipped: boolean; matched: boolean }>>([]);
  const [firstFlipped, setFirstFlipped] = useState<number | null>(null);
  const [puzzleState, setPuzzleState] = useState<string[]>(['🍎', '🍐', '🍊', '🍇']);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedPaintColor, setSelectedPaintColor] = useState('#f43f5e');
  const isDrawingRef = useRef(false);

  // Modals
  const [showStarBook, setShowStarBook] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showParentGate, setShowParentGate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [parentGateQuestion, setParentGateQuestion] = useState<{ text: string; answer: number; options: number[] }>({
    text: '3 + 4 = ?',
    answer: 7,
    options: [5, 7, 8]
  });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetNotification, setResetNotification] = useState(false);

  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);

  // Total Stars & Progress
  const totalStars = Object.values(islandStars).reduce((a, b) => a + b, 0);
  const progressPercent = Math.min(100, Math.round((totalStars / 18) * 100));

  // Load Saved Data
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kancil_island_v2_save');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.playerName) setPlayerName(parsed.playerName);
        if (parsed.islandStars) setIslandStars(parsed.islandStars);
      }
    } catch {
      // LocalStorage fallback
    }

    // Load voices
    if ('speechSynthesis' in window) {
      const loadV = () => {
        const all = window.speechSynthesis.getVoices();
        const idVoices = all.filter(v => v.lang.includes('id') || v.lang.includes('ID'));
        const finalVoices = idVoices.length > 0 ? idVoices : all;
        setVoices(finalVoices);
      };
      loadV();
      window.speechSynthesis.onvoiceschanged = loadV;
    }
  }, []);

  // Save Progress
  const saveProgress = (newStars: IslandStars, newName = playerName) => {
    setIslandStars(newStars);
    try {
      localStorage.setItem('kancil_island_v2_save', JSON.stringify({
        playerName: newName,
        islandStars: newStars
      }));
    } catch {
      // Storage fallback
    }
  };

  // Web Speech helper
  const speakText = (text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window) || !text) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    audioEngine.duckBgm(true);
    setIsSpeaking(true);

    const utter = new SpeechSynthesisUtterance(text);
    if (voices[selectedVoiceIdx]) {
      utter.voice = voices[selectedVoiceIdx];
    }
    utter.rate = speechRate;
    utter.pitch = 1.3;
    utter.volume = voiceVolume;

    utter.onend = () => {
      setIsSpeaking(false);
      audioEngine.duckBgm(false);
      if (onEnd) onEnd();
    };

    utter.onerror = () => {
      setIsSpeaking(false);
      audioEngine.duckBgm(false);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utter);
  };

  // Start Splash to Menu
  const handleStartGame = () => {
    audioEngine.init();
    audioEngine.startBgm('menu');
    audioEngine.playSfx('pop');

    setScreen('menu');
    const greet = `Halo Kapten ${playerName}! Aku Si Kancil. Mau berlayar ke pulau mana kita hari ini?`;
    setSpeechText(greet);
    speakText(greet);
  };

  // Start an Island
  const handleStartIsland = (key: IslandKey) => {
    audioEngine.playSfx('tap');
    audioEngine.startBgm('game');

    setCurrentIsland(key);
    const bank = QUESTION_BANK[key];
    const randomized = [...bank].sort(() => 0.5 - Math.random()).slice(0, key === 'kreasi' ? 3 : 10);
    setQuestions(randomized);
    setCurrentIndex(0);
    setScoreEarned(0);
    setActiveChoiceFeedback(null);
    setRevealedBlank(null);
    setCountedTaps([]);
    setScreen('game');

    setupQuestion(randomized[0]);
  };

  const setupQuestion = (q: Question) => {
    if (!q) return;
    setRevealedBlank(null);
    setActiveChoiceFeedback(null);
    setCountedTaps([]);
    setSpeechText(q.speech);
    speakText(q.speech);

    if (q.type === 'memory') {
      const icons = ['🐱', '🐶', '🐰', '🐼'];
      const raw = [...icons, ...icons].sort(() => 0.5 - Math.random());
      setMemoryCards(raw.map((ic, i) => ({ id: i, icon: ic, flipped: false, matched: false })));
      setFirstFlipped(null);
    } else if (q.type === 'puzzle') {
      const pieces = ['🍎', '🍐', '🍊', '🍇'];
      setPuzzleState([pieces[1], pieces[0], pieces[3], pieces[2]]);
    } else if (q.type === 'draw') {
      setTimeout(() => initDrawingCanvas(), 100);
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      speakText("Ayo Kapten Cilik, kamu pasti bisa! Mau Kancil ulangi pertanyaannya?");
    }, 8500);
  };

  // Drawing Canvas setup
  const initDrawingCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initial tropical outline
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(140, 85, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Palm tree / sun sketch guide
    ctx.beginPath();
    ctx.arc(60, 40, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    drawOnCanvas(e.nativeEvent.offsetX, e.nativeEvent.offsetY, true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    drawOnCanvas(e.nativeEvent.offsetX, e.nativeEvent.offsetY, false);
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    isDrawingRef.current = true;
    drawOnCanvas(touch.clientX - rect.left, touch.clientY - rect.top, true);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    drawOnCanvas(touch.clientX - rect.left, touch.clientY - rect.top, false);
  };

  const drawOnCanvas = (x: number, y: number, isStart: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isStart) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.strokeStyle = selectedPaintColor;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  // Choice Answer Handle
  const handleSelectChoice = (opt: string, idx: number) => {
    if (activeChoiceFeedback) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    const q = questions[currentIndex];
    const isCorrect = opt === q.correct;

    if (isCorrect) {
      audioEngine.playSfx('correct');
      setMascotMood('happy');
      setActiveChoiceFeedback({ index: idx, isCorrect: true });
      setScoreEarned(s => s + 1);
      if (q.prompt && q.prompt.includes('[ ? ]')) {
        setRevealedBlank(String(q.correct));
      }

      const praises = ["Hebat sekali!", "Pintar!", "Yeay, benar!", "Luar biasa!"];
      const chosen = praises[Math.floor(Math.random() * praises.length)];
      speakText(chosen, () => {
        setTimeout(() => {
          advanceNextQuestion();
        }, 350);
      });
    } else {
      audioEngine.playSfx('wrong');
      setMascotMood('sad');
      setActiveChoiceFeedback({ index: idx, isCorrect: false });

      const cheers = ["Ayo coba lagi, kamu pasti bisa!", "Jangan menyerah, yuk coba lagi!", "Kancil tetap bangga, ayo fokus!"];
      const chosen = cheers[Math.floor(Math.random() * cheers.length)];
      speakText(chosen, () => {
        setTimeout(() => {
          setActiveChoiceFeedback(null);
          setMascotMood('idle');
        }, 700);
      });
    }
  };

  // Tap Count Handle
  const handleTapItem = (index: number, totalCount: number) => {
    if (countedTaps.includes(index)) return;
    audioEngine.playSfx('pop');
    const updated = [...countedTaps, index];
    setCountedTaps(updated);
    speakText(String(updated.length));

    if (updated.length === totalCount) {
      audioEngine.playSfx('correct');
      setMascotMood('happy');
      setScoreEarned(s => s + 1);
      speakText("Hebat, hitunganmu tepat!", () => {
        setTimeout(() => {
          advanceNextQuestion();
        }, 400);
      });
    }
  };

  // Memory Card Handle
  const handleFlipCard = (index: number) => {
    const card = memoryCards[index];
    if (card.flipped || card.matched || firstFlipped === index) return;
    audioEngine.playSfx('pop');

    const updated = memoryCards.map((c, i) => i === index ? { ...c, flipped: true } : c);
    setMemoryCards(updated);

    if (firstFlipped === null) {
      setFirstFlipped(index);
    } else {
      const firstCard = memoryCards[firstFlipped];
      if (firstCard.icon === card.icon) {
        audioEngine.playSfx('correct');
        const matched = updated.map(c => (c.icon === card.icon ? { ...c, matched: true, flipped: true } : c));
        setMemoryCards(matched);
        setFirstFlipped(null);

        if (matched.every(c => c.matched)) {
          speakText("Hebat, semua pasangan hewan kembar ketemu!", () => {
            setTimeout(() => advanceNextQuestion(), 700);
          });
        }
      } else {
        const revertIndex = firstFlipped;
        setFirstFlipped(null);
        setTimeout(() => {
          setMemoryCards(cards => cards.map((c, i) => (i === index || i === revertIndex ? { ...c, flipped: false } : c)));
        }, 700);
      }
    }
  };

  // Puzzle Piece Handle
  const handleSwapPuzzle = (idx: number) => {
    audioEngine.playSfx('pop');
    const targetIdx = (idx + 1) % puzzleState.length;
    const nextArr = [...puzzleState];
    const temp = nextArr[idx];
    nextArr[idx] = nextArr[targetIdx];
    nextArr[targetIdx] = temp;
    setPuzzleState(nextArr);

    const targetSolution = ['🍎', '🍐', '🍊', '🍇'];
    if (nextArr.every((p, i) => p === targetSolution[i])) {
      audioEngine.playSfx('correct');
      speakText("Puzzle buah berhasil tersusun rapi!", () => {
        setTimeout(() => advanceNextQuestion(), 700);
      });
    }
  };

  // Advance to next question or finish
  const advanceNextQuestion = () => {
    setMascotMood('idle');
    const nextIdx = currentIndex + 1;
    if (nextIdx >= questions.length) {
      finishIsland();
    } else {
      setCurrentIndex(nextIdx);
      setupQuestion(questions[nextIdx]);
    }
  };

  // Finish Island
  const finishIsland = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    audioEngine.startBgm('win');
    audioEngine.playSfx('fanfare');
    launchConfetti();

    let starsEarned = 3;
    if (currentIsland !== 'kreasi') {
      const ratio = scoreEarned / questions.length;
      if (ratio >= 0.8) starsEarned = 3;
      else if (ratio >= 0.5) starsEarned = 2;
      else starsEarned = 1;
    }

    const currentBest = islandStars[currentIsland] || 0;
    if (starsEarned > currentBest) {
      const updated = { ...islandStars, [currentIsland]: starsEarned };
      saveProgress(updated);
    }

    setScreen('result');
    const winSpeech = `Yeay! Kamu mendapatkan ${starsEarned} Bintang Kejora! Kancil bangga padamu!`;
    setSpeechText(winSpeech);
    speakText(winSpeech);
  };

  // Launch Confetti
  const launchConfetti = () => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const particles = Array.from({ length: 90 }).map(() => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      r: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 3 + Math.random() * 5
    }));

    let frames = 0;
    const anim = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      frames++;
      if (frames < 140) requestAnimationFrame(anim);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    anim();
  };

  // Parent Gate Math Trigger
  const triggerParentGate = () => {
    const a = Math.floor(Math.random() * 5) + 3;
    const b = Math.floor(Math.random() * 4) + 2;
    const correctAns = a + b;
    const options = [correctAns, correctAns - 1, correctAns + 2].sort(() => 0.5 - Math.random());

    setParentGateQuestion({
      text: `${a} + ${b} = ?`,
      answer: correctAns,
      options
    });
    setShowParentGate(true);
  };

  const handleParentGateAnswer = (val: number) => {
    if (val === parentGateQuestion.answer) {
      audioEngine.playSfx('correct');
      setShowParentGate(false);
      setShowSettings(true);
    } else {
      audioEngine.playSfx('wrong');
    }
  };

  // FEATURE 2: RESET PROGRESS BELAJAR
  const handleResetProgress = () => {
    const blankStars: IslandStars = {
      huruf: 0,
      angka: 0,
      warna: 0,
      alam: 0,
      budi: 0,
      kreasi: 0
    };
    saveProgress(blankStars);
    audioEngine.playSfx('wrong');
    setResetConfirmOpen(false);
    setResetNotification(true);
    setTimeout(() => setResetNotification(false), 3000);
  };

  // Return to Map
  const handleReturnToMap = () => {
    audioEngine.playSfx('tap');
    audioEngine.startBgm('menu');
    setScreen('menu');
    const greet = `Halo Kapten ${playerName}! Mau mencoba pulau yang mana lagi?`;
    setSpeechText(greet);
    speakText(greet);
  };

  return (
    <div className="relative min-h-screen min-h-[100dvh] flex flex-col justify-between items-center px-3 py-2 text-slate-900 select-none overflow-x-hidden">
      {/* Global Fixed Watermark */}
      <div className="watermark-global">Karya : Antfinn</div>

      {/* Confetti Canvas */}
      <canvas ref={confettiCanvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-[9998]" />

      {/* ========================================================= */}
      {/* 1. LAYAR SPLASH / PEMBUKA */}
      {/* ========================================================= */}
      {screen === 'splash' && (
        <section className="flex flex-col items-center justify-center flex-1 w-full max-w-[580px] my-auto text-center py-6 animate-fadeIn">
          {/* Logo 3D Banner */}
          <div className="flex flex-col items-center mb-2 w-full">
            <div className="bg-gradient-to-b from-white to-sky-100 text-sky-700 text-xs font-black tracking-widest px-4 py-1 rounded-full shadow border-2 border-sky-200 uppercase inline-flex items-center gap-1.5 mb-1.5">
              <span>🏝️</span> PULAU PETUALANGAN <span>🏝️</span>
            </div>
            <div className="flex flex-col items-center leading-none my-1">
              <span className="title-word title-petualangan">PETUALANGAN</span>
              <span className="title-word title-belajar">BELAJAR</span>
            </div>
            <div className="text-sm font-extrabold text-white bg-sky-900/60 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-white/40 shadow">
              Bersama Si Kancil di Pulau Cerdas
            </div>
          </div>

          {/* Maskot Kancil Besar */}
          <div className="w-36 h-36 my-3 drop-shadow-xl flex items-center justify-center">
            <KancilSvg mood="idle" />
          </div>

          {/* Input Nama Kapten Cilik */}
          <div className="mb-4 w-full max-w-[290px]">
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                const val = e.target.value;
                setPlayerName(val);
                saveProgress(islandStars, val);
              }}
              placeholder="Ketik Namamu Di Sini..."
              className="w-full px-4 py-3 text-base rounded-full border-3 border-orange-500 text-center font-black outline-none text-slate-800 bg-white shadow-lg focus:ring-4 focus:ring-orange-300 transition"
            />
          </div>

          {/* Tombol Berlayar */}
          <button onClick={handleStartGame} className="btn-big mb-4">
            <span>⛵</span> AYO BERLAYAR!
          </button>

          <div className="text-xs font-black text-white drop-shadow">Karya : Antfinn</div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 2. LAYAR MENU PETA 6 PULAU SAMUDRA */}
      {/* ========================================================= */}
      {screen === 'menu' && (
        <section className="flex flex-col items-center flex-1 w-full max-w-[580px] py-2 animate-fadeIn">
          {/* Top Navigation */}
          <div className="w-full flex justify-between items-center mb-2 px-1">
            <div className="flex gap-2 items-center">
              <button
                onClick={() => {
                  audioEngine.playSfx('star');
                  setShowStarBook(true);
                  speakText("Ini adalah peti bintang dan stiker hebat milikmu!");
                }}
                className="btn-circle"
                title="Buku Bintang & Koleksi Hewan"
              >
                ⭐
              </button>
              <button
                onClick={() => {
                  audioEngine.playSfx('pop');
                  setShowCertificate(true);
                  speakText("Selamat atas keberhasilanmu menaklukkan pulau cerdas!");
                }}
                className="btn-circle"
                title="Piagam Juara"
              >
                📜
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => {
                  const muted = audioEngine.toggleMute();
                  setIsMuted(muted);
                }}
                className="btn-circle"
                title="Bisukan Audio"
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <button
                onPointerDown={() => {
                  didHoldRef.current = false;
                  holdTimerRef.current = window.setTimeout(() => {
                    didHoldRef.current = true;
                    audioEngine.playSfx('pop');
                    setShowSettings(true);
                  }, 1500);
                }}
                onPointerUp={() => {
                  if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                }}
                onPointerLeave={() => {
                  if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                }}
                onClick={() => {
                  if (!didHoldRef.current) {
                    audioEngine.playSfx('tap');
                    triggerParentGate();
                  }
                }}
                className="btn-circle"
                title="Ruang Guru & Orang Tua (Tekan atau Tahan 1.5s)"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Mascot Speech Container */}
          <div className="flex items-center gap-3 bg-white/95 border-3 border-orange-200 p-2.5 rounded-3xl shadow-md w-full mb-2">
            <KancilSvg mood="idle" />
            <div className={`speech-bubble ${isSpeaking ? 'is-speaking' : ''}`}>
              {speechText}
            </div>
          </div>

          {/* Grid 6 Pulau Samudra */}
          <div className="grid grid-cols-2 gap-3 w-full my-auto">
            {ISLANDS_INFO.map(island => {
              const stars = islandStars[island.key] || 0;
              return (
                <div
                  key={island.key}
                  onClick={() => handleStartIsland(island.key)}
                  className="island-card"
                >
                  <div className="text-4xl mb-1 filter drop-shadow">{island.icon}</div>
                  <div className="text-base font-black text-emerald-900 mb-1">{island.title}</div>
                  <div className="text-sm bg-emerald-950/40 text-white/70 px-2 py-0.5 rounded-full flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className={i < stars ? 'text-amber-300 drop-shadow' : 'text-slate-400'}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs font-black text-white drop-shadow mt-4 mb-2">Karya : Antfinn</div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 3. LAYAR PERMAINAN (SOAL / AKTIVITAS) */}
      {/* ========================================================= */}
      {screen === 'game' && questions.length > 0 && (
        <section className="flex flex-col items-center flex-1 w-full max-w-[580px] py-1 animate-fadeIn">
          {/* Top Bar Game */}
          <div className="w-full flex justify-between items-center mb-2 px-1">
            <button
              onClick={handleReturnToMap}
              className="btn-circle !bg-gradient-to-b !from-rose-500 !to-rose-700 !shadow-[0_4px_0_#9f1239]"
              title="Kembali ke Peta"
            >
              ⬅️
            </button>
            {/* Indikator Bintang Soal */}
            <div className="flex gap-1 bg-sky-950 border-2 border-sky-400 px-3 py-1 rounded-full shadow-inner">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={`text-sm transition-all ${i < currentIndex ? 'text-amber-400 font-bold scale-110 drop-shadow' : 'text-slate-500'}`}
                >
                  ★
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                audioEngine.playSfx('tap');
                const q = questions[currentIndex];
                if (q) speakText(q.speech);
              }}
              className="btn-circle !bg-gradient-to-b !from-amber-400 !to-amber-600 !shadow-[0_4px_0_#b45309]"
              title="Ulangi Suara Kancil"
            >
              🔊
            </button>
          </div>

          {/* Maskot Kancil Pertanyaan */}
          <div className="flex items-center gap-3 bg-white/95 border-3 border-orange-200 p-2.5 rounded-3xl shadow-md w-full mb-2">
            <KancilSvg mood={mascotMood} />
            <div className={`speech-bubble ${isSpeaking ? 'is-speaking' : ''}`}>
              {speechText}
            </div>
          </div>

          {/* Area Permainan Utama */}
          <div className="w-full bg-gradient-to-b from-white to-amber-50/50 border-4 border-amber-100 rounded-3xl p-4 shadow-[0_10px_0_#0284c7,0_16px_28px_rgba(0,0,0,0.22)] flex flex-col items-center justify-around flex-1 min-h-[340px]">
            {/* TIPE 1: PILIHAN GANDA BIASA / TEBAK HURUF & KATA */}
            {questions[currentIndex].type === 'choice' && (
              <div className="w-full flex flex-col items-center">
                <div className="text-3xl md:text-4xl min-h-[58px] mb-3 flex items-center justify-center gap-2 flex-wrap font-black text-slate-900 text-center">
                  {questions[currentIndex].prompt?.includes('[ ? ]') ? (
                    <>
                      <span>{questions[currentIndex].prompt?.split('[ ? ]')[0]}</span>
                      <span className="blank-box">
                        {revealedBlank || '?'}
                      </span>
                      <span>{questions[currentIndex].prompt?.split('[ ? ]')[1]}</span>
                    </>
                  ) : (
                    <span>{questions[currentIndex].prompt || questions[currentIndex].q}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  {questions[currentIndex].options?.map((opt, idx) => {
                    const isLong = opt.length > 4;
                    const feedback = activeChoiceFeedback?.index === idx;
                    let extraClass = '';
                    if (feedback) {
                      extraClass = activeChoiceFeedback.isCorrect ? 'correct-choice' : 'wrong-choice';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectChoice(opt, idx)}
                        className={`choice-btn ${isLong ? 'text-base font-black px-2' : 'text-3xl font-black'} ${extraClass}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TIPE 2: HITUNG SENTUH (TAP COUNT) */}
            {questions[currentIndex].type === 'tap_count' && (
              <div className="w-full flex flex-col items-center">
                <div className="text-lg font-black text-slate-800 mb-3 text-center">
                  {questions[currentIndex].q}
                </div>
                <div className="flex flex-wrap justify-center gap-3 max-w-[420px] mb-3">
                  {Array.from({ length: questions[currentIndex].count || 0 }).map((_, i) => {
                    const counted = countedTaps.includes(i);
                    return (
                      <div
                        key={i}
                        onClick={() => handleTapItem(i, questions[currentIndex].count || 0)}
                        className={`text-5xl cursor-pointer p-2.5 rounded-2xl transition-all shadow-sm ${
                          counted ? 'bg-amber-300 scale-95 shadow-amber-400 drop-shadow' : 'bg-sky-100 hover:scale-105'
                        }`}
                      >
                        {questions[currentIndex].icon}
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm font-extrabold text-sky-800 bg-sky-100 px-4 py-1 rounded-full">
                  Disentuh: {countedTaps.length} / {questions[currentIndex].count}
                </div>
              </div>
            )}

            {/* TIPE 3: KARTU MEMORI HEWAN KEMBAR */}
            {questions[currentIndex].type === 'memory' && (
              <div className="w-full flex flex-col items-center">
                <div className="text-base font-black text-emerald-800 mb-2">
                  🃏 Cocokkan Pasangan Hewan Kembar!
                </div>
                <div className="grid grid-cols-4 gap-2 w-full max-w-[340px]">
                  {memoryCards.map((c, i) => (
                    <div
                      key={c.id}
                      onClick={() => handleFlipCard(i)}
                      className={`aspect-square rounded-xl flex items-center justify-center text-3xl cursor-pointer transition-transform ${
                        c.flipped || c.matched
                          ? 'bg-white border-3 border-orange-400 shadow-sm'
                          : 'bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-[0_4px_0_#9a3412]'
                      }`}
                    >
                      {c.flipped || c.matched ? c.icon : '❓'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TIPE 4: PUZZLE BUAH SEGAR */}
            {questions[currentIndex].type === 'puzzle' && (
              <div className="w-full flex flex-col items-center">
                <div className="text-base font-black text-emerald-800 mb-2">
                  🧩 Susun Kepingan Buah Segar!
                </div>
                <div className="grid grid-cols-2 gap-2.5 w-[220px] mb-3">
                  {puzzleState.map((piece, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSwapPuzzle(idx)}
                      className="aspect-square bg-white border-3 border-teal-600 rounded-2xl flex items-center justify-center text-4xl cursor-pointer shadow-md active:scale-95 transition"
                    >
                      {piece}
                    </div>
                  ))}
                </div>
                <div className="text-xs font-bold text-slate-500">
                  Target urutan: 🍎 🍐 🍊 🍇 (Sentuh untuk menukar posisi)
                </div>
              </div>
            )}

            {/* TIPE 5: KANVAS MEWARNAI PANTAI TROPIS */}
            {questions[currentIndex].type === 'draw' && (
              <div className="w-full flex flex-col items-center">
                <div className="text-base font-black text-emerald-800 mb-1">
                  🎨 Kanvas Warna Pantai Tropis
                </div>
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={180}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasMouseUp}
                  className="bg-white border-3 border-dashed border-orange-400 rounded-2xl shadow-inner cursor-crosshair touch-none"
                />

                {/* Palet Warna */}
                <div className="flex gap-2 my-2 justify-center flex-wrap">
                  {['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#0f172a'].map(col => (
                    <div
                      key={col}
                      onClick={() => {
                        audioEngine.playSfx('tap');
                        setSelectedPaintColor(col);
                      }}
                      className={`w-9 h-9 rounded-full border-2 border-white cursor-pointer shadow transition-transform ${
                        selectedPaintColor === col ? 'ring-4 ring-orange-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    audioEngine.playSfx('correct');
                    speakText("Lukisanmu sungguh indah dan penuh warna!", () => {
                      setTimeout(() => advanceNextQuestion(), 700);
                    });
                  }}
                  className="btn-big !min-h-[46px] !text-sm !py-2"
                >
                  ✨ Selesai Mewarnai!
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 4. LAYAR HASIL HARTA KARUN */}
      {/* ========================================================= */}
      {screen === 'result' && (
        <section className="flex flex-col items-center justify-center flex-1 w-full max-w-[580px] my-auto text-center py-6 animate-fadeIn">
          <div className="text-2xl md:text-3xl font-black text-white drop-shadow mb-2">
            🎉 HARTA KARUN DITEMUKAN! 🎉
          </div>

          <div className="text-5xl my-3 filter drop-shadow">
            {'⭐'.repeat(islandStars[currentIsland] || 3)}
          </div>

          <div className="speech-bubble max-w-[440px] mx-auto mb-6 text-slate-800">
            {speechText}
          </div>

          <button onClick={handleReturnToMap} className="btn-big mx-auto">
            <span>🗺️</span> KEMBALI KE SAMUDRA
          </button>

          <div className="text-xs font-black text-white drop-shadow mt-6">Karya : Antfinn</div>
        </section>
      )}

      {/* ========================================================= */}
      {/* MODAL: KUNCI TANTANGAN ORANG TUA (PARENT GATE) */}
      {/* ========================================================= */}
      {showParentGate && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fadeIn">
          <div className="bg-white border-4 border-orange-200 rounded-3xl p-5 max-w-[380px] w-full text-center shadow-2xl">
            <div className="text-4xl mb-1">🔒</div>
            <h3 className="text-sky-700 font-black text-xl mb-1">Gerbang Orang Tua & Guru</h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Selesaikan hitungan sederhana ini untuk masuk ke pengaturan:
            </p>
            <div className="text-2xl font-black text-amber-600 mb-3 bg-amber-50 p-2.5 rounded-2xl border-2 border-dashed border-amber-400">
              {parentGateQuestion.text}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {parentGateQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleParentGateAnswer(opt)}
                  className="choice-btn text-2xl font-black !min-h-[52px]"
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowParentGate(false)}
              className="w-full py-2 rounded-xl border-2 border-slate-300 font-black text-sm text-slate-600 hover:bg-slate-100 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: BUKU BINTANG & KOLEKSI STIKER */}
      {/* ========================================================= */}
      {showStarBook && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fadeIn">
          <div className="bg-white border-4 border-orange-200 rounded-3xl p-5 max-w-[460px] w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-orange-600 font-black text-xl mb-1">⭐ Peti Bintang & Koleksi Hewan</h2>
            <p className="text-xs font-bold text-slate-600 mb-3">Kumpulkan bintang dari setiap pulau untuk membuka hewan!</p>

            <div className="text-xl font-black text-amber-600 mb-3">
              Total Bintang: {totalStars} / 18
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {BADGES_CONFIG.map((b, i) => {
                const unlocked = totalStars >= b.req;
                return (
                  <div
                    key={i}
                    className={`rounded-2xl p-2.5 flex flex-col items-center border-2 ${
                      unlocked ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-slate-50 border-dashed border-slate-300'
                    }`}
                  >
                    <div className={`text-3xl ${unlocked ? '' : 'grayscale opacity-40'}`}>{b.icon}</div>
                    <div className="text-xs font-black text-slate-800 mt-1">{b.name}</div>
                    <div className="text-[10px] font-extrabold text-slate-500 mt-0.5">
                      {unlocked ? 'Terbuka! 🎉' : `${b.req} ★`}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowStarBook(false)}
              className="btn-big mx-auto !min-h-[46px] !text-sm !py-2"
            >
              TUTUP
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PIAGAM PENGHARGAAN ANAK HEBAT */}
      {/* ========================================================= */}
      {showCertificate && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fadeIn">
          <div className="bg-white border-4 border-orange-200 rounded-3xl p-5 max-w-[520px] w-full text-center shadow-2xl">
            <div className="bg-[#fffef2] border-4 border-double border-amber-600 rounded-2xl p-4 relative mb-4">
              <div className="text-2xl font-black text-amber-700 mb-1">📜 PIAGAM ANAK HEBAT 📜</div>
              <div className="text-xs text-slate-500 font-bold mb-2">Diberikan dengan penuh bangga kepada:</div>
              <div className="text-2xl font-black text-sky-700 underline mb-2 tracking-wide uppercase">
                {playerName || 'KAPTEN CILIK'}
              </div>
              <div className="text-xs font-semibold leading-relaxed text-slate-700 mb-3">
                Telah berhasil menaklukkan 6 Pulau Pintar, mengenal huruf, berhitung, bersopan santun, dan belajar cerdas bersama Si Kancil!
              </div>
              <div className="flex justify-around items-center border-t-2 border-dashed border-slate-300 pt-2 text-xs">
                <div>
                  <div className="text-2xl">🦌</div>
                  <div className="font-black text-slate-800">Kancil Cerdik</div>
                </div>
                <div className="font-black text-slate-500 text-right">
                  Karya : Antfinn
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCertificate(false)}
              className="btn-big mx-auto !min-h-[46px] !text-sm !py-2"
            >
              TUTUP
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RUANG GURU & ORANG TUA + PROGRES BELAJAR & RESET */}
      {/* ========================================================= */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fadeIn">
          <div className="bg-white border-4 border-orange-200 rounded-3xl p-5 max-w-[460px] w-full text-center shadow-2xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-slate-900 font-black text-xl mb-0.5">⚙️ Ruang Guru & Orang Tua</h2>
            <p className="text-xs text-slate-500 mb-3">Pengaturan Audio dan Pantauan Progres Belajar</p>

            {/* Notification alert on reset */}
            {resetNotification && (
              <div className="bg-emerald-100 border border-emerald-400 text-emerald-800 text-xs font-black p-2 rounded-xl mb-3 animate-fadeIn">
                ✓ Seluruh bintang dan progres berhasil direset ke 0!
              </div>
            )}

            {/* BAGIAN 1: LAPORAN PROGRES BELAJAR ANAK */}
            <div className="text-xs font-black text-sky-700 flex items-center gap-1.5 mb-1.5 text-left">
              <span>📊</span> Laporan Progres Belajar Anak
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-left mb-3">
              <div className="flex justify-between items-center text-xs font-black text-slate-800">
                <span>Siswa: <span className="text-sky-600">{playerName || 'Kapten Cilik'}</span></span>
                <span className="text-emerald-600 font-extrabold">{progressPercent}%</span>
              </div>
              <div className="text-[11px] font-extrabold text-slate-500 mt-0.5">
                Total Bintang: <span className="text-amber-600 font-black">{totalStars} / 18</span>
              </div>

              {/* Progress Bar Visual */}
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden my-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Rincian Tiap Pulau */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-extrabold text-slate-700 mb-3">
                {ISLANDS_INFO.map(island => {
                  const s = islandStars[island.key] || 0;
                  return (
                    <div key={island.key} className="flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <span>{island.icon} {island.title.split(' ')[1] || island.title}:</span>
                      <span className={s > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}>
                        {'★'.repeat(s)}{'☆'.repeat(3 - s)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* TOMBOL RESET PROGRES BELAJAR */}
              <button
                onClick={() => setResetConfirmOpen(true)}
                className="w-full min-h-[40px] border-2 border-dashed border-rose-500 rounded-xl bg-rose-50 text-rose-600 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-rose-100 active:scale-98 transition"
              >
                <span>🔄</span> Reset Seluruh Bintang & Progres
              </button>
            </div>

            {/* BAGIAN 2: PENGATURAN AUDIO & SUARA */}
            <div className="text-xs font-black text-sky-700 flex items-center gap-1.5 mb-1.5 text-left">
              <span>🔊</span> Pengaturan Audio & Karakter
            </div>

            <div className="space-y-2 text-left mb-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Musik Latar (BGM):</span>
                  <span className="text-orange-600">{Math.round(bgmVolume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bgmVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBgmVolumeState(val);
                    audioEngine.setBgmVolume(val);
                  }}
                  className="w-full h-2 rounded accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Efek Suara (SFX):</span>
                  <span className="text-orange-600">{Math.round(sfxVolume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSfxVolumeState(val);
                    audioEngine.setSfxVolume(val);
                  }}
                  className="w-full h-2 rounded accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Suara Karakter (Bicara):</span>
                  <span className="text-orange-600">{Math.round(voiceVolume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                  className="w-full h-2 rounded accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Kecepatan Bicara:</span>
                  <span className="text-orange-600">{speechRate < 0.75 ? 'Lambat' : speechRate > 1.05 ? 'Cepat' : 'Sedang'} ({speechRate}x)</span>
                </label>
                <input
                  type="range"
                  min="0.6"
                  max="1.3"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-2 rounded accent-orange-500 cursor-pointer"
                />
              </div>

              {voices.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Pilihan Suara Indonesia:
                  </label>
                  <select
                    value={selectedVoiceIdx}
                    onChange={(e) => setSelectedVoiceIdx(parseInt(e.target.value))}
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                  >
                    {voices.map((v, i) => (
                      <option key={i} value={i}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tombol Tes Audio */}
            <div className="flex gap-2 justify-center mb-4">
              <button
                onClick={() => audioEngine.playNote(440, 0.5, 'triangle', audioEngine.bgmGain)}
                className="choice-btn text-xs !min-h-[36px] px-3 py-1 text-slate-700"
              >
                Tes Musik
              </button>
              <button
                onClick={() => audioEngine.playSfx('correct')}
                className="choice-btn text-xs !min-h-[36px] px-3 py-1 text-slate-700"
              >
                Tes SFX
              </button>
              <button
                onClick={() => speakText("Halo ayah dan bunda, suara Kancil terdengar sangat jelas!")}
                className="choice-btn text-xs !min-h-[36px] px-3 py-1 text-slate-700"
              >
                Tes Bicara
              </button>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="btn-big w-full !min-h-[46px] !text-sm !py-2"
            >
              SIMPAN & TUTUP
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DIALOG KONFIRMASI RESET PROGRES BELAJAR */}
      {/* ========================================================= */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-[10010] p-4 animate-fadeIn">
          <div className="bg-white border-4 border-rose-300 rounded-3xl p-5 max-w-[360px] w-full text-center shadow-2xl">
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-rose-700 font-black text-lg mb-1">Konfirmasi Reset Progres</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed font-semibold">
              Apakah Ayah, Bunda, atau Guru yakin ingin mereset <strong>SELURUH bintang</strong> dan progres belajar anak kembali ke awal (0 bintang)?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-300 font-black text-xs text-slate-700 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                onClick={handleResetProgress}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-md transition"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
