/* ═══════════════════════════════════════════════════════
   analysis.js — Veri Analiz Pipeline'ı
   ═══════════════════════════════════════════════════════
   Ayrıştırılmış N1470 log kayıtlarını alarak I-V analiz
   sonuçlarını üretir. İşlem adımları:

   1. Kanal 0 filtreleme: Gürültülü kanal 0 verileri atılır
   2. VMon eşleştime: Her IMonH okuması, aynı kanalın en
      son VMon değeriyle eşleştirilir
   3. Voltaj gruplandırma: Okunan VMon değerleri, beklenen
      voltaj adımlarına (250V katları) yuvarlanarak nominal
      voltaj seviyelerine gruplandırılır
   4. İstatistiksel hesaplama: Her voltaj seviyesinde kanal
      başına ortalama (⟨I⟩) ve standart sapma (σ) hesaplanır
   5. Toplam akım: I_total = ⟨I_ch1⟩ + ⟨I_ch2⟩
   6. Bipolar düzeltme: V_total = V_nominal × bipolar_faktor
   ═══════════════════════════════════════════════════════ */

import { mean, stddev } from './utils.js';

/**
 * findNominalVoltages — Nominal Voltaj Seviyelerini Belirleme
 *
 * Toplanan tüm VMon okumalarından kararlı voltaj platolarını
 * tespit eder. Her okunan voltaj, en yakın adım katına
 * yuvarlanır (ör: 2498V → 2500V, 2753V → 2750V).
 * Yuvarlanan değer ile gerçek değer arasındaki fark tolerans
 * sınırını (±tolerance) aşıyorsa o okuma atlanır — bu,
 * voltaj rampa geçişlerindeki ara değerlerin filtrelenmesini
 * sağlar.
 *
 * Sıfır ve çok düşük nominal değerler (kanal 0 sızıntısı)
 * filtrelenir: yalnızca step değerinin üzerindeki nominaller
 * kabul edilir.
 *
 * @param {number[]} voltages  - Tüm kanallardan toplanan VMon okumaları
 * @param {number}   step      - Beklenen voltaj adımı (varsayılan: 250V)
 * @param {number}   tolerance - Gruplandırma toleransı (varsayılan: ±5V)
 * @returns {number[]} Tespit edilen nominal voltaj seviyeleri (sıralı, artan)
 */
export function findNominalVoltages(voltages, step, tolerance) {
  const nomSet = new Set();
  for (const v of voltages) {
    const rounded = Math.round(v / step) * step;
    if (Math.abs(v - rounded) <= tolerance) nomSet.add(rounded);
  }
  return [...nomSet].filter(n => n >= step).sort((a, b) => a - b);
}

/**
 * analyze — Ana Analiz Pipeline'ı
 *
 * Ayrıştırılmış log kayıtlarını alarak tam I-V analiz sonuçlarını
 * üretir. Bu fonksiyon şu adımları sırasıyla uygular:
 *
 * Adım 1 — Kanal Filtreleme ve VMon Eşleştirme:
 *   Kanal 0 gürültülü olduğundan tamamen atlanır.
 *   Her kanal (1, 2) için en son okunan VMon değeri takip edilir.
 *   Bir IMonH okuması geldiğinde, o kanalın son VMon'u ile
 *   eşleştirilir. Voltajı ch0Threshold'un altındaki okumalar
 *   atlanır (rampa geçişleri).
 *
 * Adım 2 — Nominal Voltaj Tespiti:
 *   Tüm kanallardan toplanan VMon değerleri ile findNominalVoltages()
 *   çağrılarak kararlı plato seviyeleri belirlenir.
 *
 * Adım 3 — Akım Gruplandırma:
 *   Her IMonH okuması, en yakın nominal voltaj seviyesine atanır
 *   (tolerans dahilinde). Uzaktaki okumalar reddedilir.
 *
 * Adım 4 — İstatistiksel Hesaplama:
 *   Her nominal voltaj seviyesinde:
 *   - Ch1 ve Ch2 için ayrı ayrı ⟨I⟩ (aritmetik ortalama) hesaplanır
 *   - Ch1 ve Ch2 için ayrı ayrı σ (standart sapma, Bessel düzeltmeli)
 *   - Toplam akım: I_total = ⟨I_ch1⟩ + ⟨I_ch2⟩
 *   - Toplam voltaj: V_total = V_nominal × bipolar_faktor
 *
 * @param {Array} records      - parseLog() çıktısı (yapılandırılmış kayıtlar)
 * @param {Object} settings    - Analiz ayarları
 * @param {number} settings.tolerance   - Voltaj gruplandırma toleransı (V)
 * @param {number} settings.stepSize    - Beklenen voltaj adımı (V)
 * @param {number} settings.ch0Thresh   - Düşük voltaj eşiği (V)
 * @param {number} settings.bipolar     - Bipolar çarpan (1 veya 2)
 *
 * @returns {{ results: Array, chData: Object } | null}
 *   results: Sıralı analiz sonuçları dizisi
 *   chData:  Kanal bazında ham okuma verileri ({1: [...], 2: [...]})
 *   Geçerli veri bulunamazsa null döner
 */
export function analyze(records, { tolerance, stepSize, ch0Thresh, bipolar }) {
  // Adım 1: Kanal filtreleme ve VMon eşleştirme
  const latestVMon = {};  // ch → son VMon değeri
  const chData = {};      // ch → [ { voltage, current, timestamp } ]

  for (const rec of records) {
    if (rec.ch === 0) continue; // Kanal 0'ı tamamen atla (gürültülü)
    if (rec.par === 'VMon') {
      latestVMon[rec.ch] = rec.val;
    } else if (rec.par === 'IMonH') {
      const v = latestVMon[rec.ch];
      if (v === undefined) continue;   // Henüz VMon okunmadı
      if (v < ch0Thresh) continue;     // Rampa geçişi, düşük voltaj
      if (!chData[rec.ch]) chData[rec.ch] = [];
      chData[rec.ch].push({ voltage: v, current: rec.val, timestamp: rec.timestamp });
    }
  }

  // Tüm VMon değerlerini topla
  const allVoltages = [];
  for (const ch of Object.keys(chData)) {
    for (const d of chData[ch]) allVoltages.push(d.voltage);
  }
  if (!allVoltages.length) return null;

  // Adım 2: Nominal voltaj tespiti
  const nominals = findNominalVoltages(allVoltages, stepSize, tolerance);

  // Adım 3: IMonH'ı nominal voltaja göre gruplandır
  const grouped = {};  // nominalV → { ch1: [akım_değerleri], ch2: [akım_değerleri] }
  for (const nom of nominals) grouped[nom] = { ch1: [], ch2: [] };

  for (const ch of Object.keys(chData)) {
    const chKey = `ch${ch}`;
    for (const d of chData[ch]) {
      // En yakın nominal voltajı bul
      let best = null, bestDist = Infinity;
      for (const nom of nominals) {
        const dist = Math.abs(d.voltage - nom);
        if (dist < bestDist) { bestDist = dist; best = nom; }
      }
      if (best !== null && bestDist <= tolerance) {
        if (grouped[best][chKey]) grouped[best][chKey].push(d.current);
      }
    }
  }

  // Adım 4: İstatistiksel hesaplama
  const results = [];
  for (const nom of nominals) {
    const g = grouped[nom];
    const ch1Avg = mean(g.ch1);      // Kanal 1 ortalama akım
    const ch2Avg = mean(g.ch2);      // Kanal 2 ortalama akım
    const ch1Std = stddev(g.ch1);    // Kanal 1 standart sapma
    const ch2Std = stddev(g.ch2);    // Kanal 2 standart sapma
    const totalI = ch1Avg + ch2Avg;  // Toplam akım
    const totalV = nom * bipolar;    // Toplam voltaj (bipolar düzeltme)

    results.push({
      nominalV: nom,
      totalV,
      ch1Avg, ch2Avg, totalI,
      ch1Std, ch2Std,
      ch1N: g.ch1.length,
      ch2N: g.ch2.length,
    });
  }

  // Voltaja göre artan sırala
  results.sort((a, b) => a.totalV - b.totalV);

  return { results, chData };
}
