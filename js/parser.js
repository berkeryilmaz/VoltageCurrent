/* ═══════════════════════════════════════════════════════
   parser.js — N1470 Log Dosyası Ayrıştırıcı (Parser)
   ═══════════════════════════════════════════════════════
   CAEN N1470 HV güç kaynağının ürettiği ham .txt log
   dosyalarını satır satır okuyarak yapılandırılmış veri
   kayıtlarına dönüştürür.

   Log Dosyası Formatı:
   [2026-03-31T14:31:33.050]: [N1470] bd [0] ch [2] par [IMonH] val [0.1];

   Her satırda:
   - Zaman damgası (ISO 8601 formatı)
   - Board (bd) numarası
   - Kanal (ch) numarası: 0, 1 veya 2
   - Parametre adı (par): VMon, IMonH, VSet, vb.
   - Değer (val): sayısal veya boolean
   ═══════════════════════════════════════════════════════ */

/**
 * LINE_RE — Satır Ayrıştırma Düzenli İfadesi
 *
 * N1470 log formatını yakalayan regex deseni.
 * Capture grupları:
 *   [1] timestamp  — "2026-03-31T14:31:33.050"
 *   [2] bd         — Board numarası (genellikle "0")
 *   [3] ch         — Kanal numarası ("0", "1", "2")
 *   [4] par        — Parametre adı ("VMon", "IMonH", vb.)
 *   [5] val        — Okunan değer (sayı veya "true"/"false")
 */
const LINE_RE = /^\[([^\]]+)\]:\s*\[N1470\]\s*bd\s*\[(\d+)\]\s*ch\s*\[(\d+)\]\s*par\s*\[(\w+)\]\s*val\s*\[([^\]]+)\]/;

/**
 * parseLog — Ham Log Metnini Yapılandırılmış Kayıtlara Dönüştürme
 *
 * Verilen ham metin bloğunu satır satır okur ve her satırı LINE_RE
 * regex ile eşleştirir. Eşleşen satırlardan yapılandırılmış
 * kayıtlar oluşturur. Eşleşmeyen satırlar (boş satırlar, yorum
 * satırları, farklı formatlı satırlar) sessizce atlanır.
 *
 * Değer dönüşümleri:
 * - "true"  → 1 (sayısal)
 * - "false" → 0 (sayısal)
 * - Diğer   → parseFloat() ile ondalık sayıya
 *
 * @param {string} text - Ham log dosyası içeriği
 * @returns {Array<{timestamp:string, bd:number, ch:number, par:string, val:number}>}
 *   Ayrıştırılmış kayıtların dizisi
 */
export function parseLog(text) {
  const lines = text.split(/\r?\n/);
  const records = [];
  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    records.push({
      timestamp: m[1],
      bd:  parseInt(m[2], 10),
      ch:  parseInt(m[3], 10),
      par: m[4],
      val: m[5] === 'true' ? 1 : m[5] === 'false' ? 0 : parseFloat(m[5]),
    });
  }
  return records;
}
