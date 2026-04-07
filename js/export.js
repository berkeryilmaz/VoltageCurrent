/* ═══════════════════════════════════════════════════════
   export.js — Dışa Aktarma Modülü (Export Functions)
   ═══════════════════════════════════════════════════════
   Analiz sonuçlarını üç farklı formatta dışa aktarma
   fonksiyonlarını içerir:

   1. CSV  — Tablo verisini virgülle ayrılmış metin dosyası
              olarak indirir (spreadsheet uyumlu)
   2. PNG  — Mevcut I-V grafiğini ekran görüntüsü olarak
              indirir (Chart.js native export)
   3. Science — Yayın kalitesinde (publication-quality) bilimsel
              figür üretir:
              - Beyaz arka plan
              - Serif yazı tipi (Times New Roman)
              - Hata çubukları (error bars) σ_total ile
              - 300 DPI eşdeğeri yüksek çözünürlük
              - Siyah-beyaz renk şeması (basıma uygun)
   ═══════════════════════════════════════════════════════ */

import { downloadBlob, niceScale } from './utils.js';
import { getIVChart } from './charts.js';

/**
 * exportCSV — Analiz Sonuçlarını CSV Olarak Dışa Aktarma
 *
 * Analiz sonuçlarından virgülle ayrılmış bir metin dosyası
 * oluşturur. Her satır bir voltaj seviyesini temsil eder.
 *
 * CSV sütunları:
 *   Total_Voltage_V     — Toplam voltaj (bipolar düzeltmeli)
 *   Nominal_V           — Nominal set voltajı
 *   Ch1_Mean_I_uA       — Kanal 1 ortalama akım (µA)
 *   Ch2_Mean_I_uA       — Kanal 2 ortalama akım (µA)
 *   Total_I_uA          — Toplam akım = Ch1 + Ch2 (µA)
 *   Ch1_Sigma_uA        — Kanal 1 standart sapma (µA)
 *   Ch2_Sigma_uA        — Kanal 2 standart sapma (µA)
 *   Ch1_N               — Kanal 1 veri noktası sayısı
 *   Ch2_N               — Kanal 2 veri noktası sayısı
 *
 * Sayısal değerler 6 ondalık basamakla yazılır.
 *
 * @param {Array}  results       - Analiz sonuçları
 * @param {string} sourceFileName - Kaynak dosya adı (uzantısız)
 */
export function exportCSV(results, sourceFileName) {
  if (!results || !results.length) return;
  let csv = 'Total_Voltage_V,Nominal_V,Ch1_Mean_I_uA,Ch2_Mean_I_uA,Total_I_uA,Ch1_Sigma_uA,Ch2_Sigma_uA,Ch1_N,Ch2_N\n';
  for (const r of results) {
    csv += `${r.totalV},${r.nominalV},${r.ch1Avg.toFixed(6)},${r.ch2Avg.toFixed(6)},${r.totalI.toFixed(6)},${r.ch1Std.toFixed(6)},${r.ch2Std.toFixed(6)},${r.ch1N},${r.ch2N}\n`;
  }
  downloadBlob(csv, `${sourceFileName}_iv_results.csv`, 'text/csv');
}

/**
 * exportPNG — Ekran Grafiğini PNG Olarak İndirme
 *
 * Chart.js'in dahili toBase64Image() metodunu kullanarak
 * mevcut I-V grafiğini aynen ekranda göründüğü şekliyle
 * PNG dosyası olarak indirir. Çözünürlük ekran piksel
 * yoğunluğuna bağlıdır.
 *
 * @param {string} sourceFileName - Kaynak dosya adı (uzantısız)
 */
export function exportPNG(sourceFileName) {
  const chart = getIVChart();
  if (!chart) return;
  const url = chart.toBase64Image('image/png', 1);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sourceFileName}_iv_chart.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * exportScientificFigure — Bilimsel Yayın Kalitesinde Figür Üretme
 *
 * Bilimsel makale ve tez için uygun, yayın kalitesinde (publication-quality)
 * bir I-V karakteristik figürü üretir. Tamamen bağımsız bir canvas üzerinde
 * sıfırdan çizilir (Chart.js kullanılmaz).
 *
 * Bilimsel Standartlar:
 * ─────────────────────
 * - Arka plan:     Beyaz (#ffffff) — baskı uyumlu
 * - Yazı tipi:     Times New Roman (serif) — akademik standart
 * - Eksen çizgileri: Siyah, kalın, L-şeklinde (sol + alt)
 * - Tick işaretleri: Eksen dışına doğru, her nice-scale değerinde
 * - Izgara:        Açık gri, kesikli — veri okunabilirliği için
 * - Veri çizgisi:  Siyah düz çizgi — baskıda net görünür
 * - Veri noktaları: Dolu siyah daireler (filled circles)
 *
 * Hata Çubuğu Hesaplaması (Error Bars):
 * ──────────────────────────────────────
 * Toplam akım iki kanalın toplamı olduğundan, toplam hatanın
 * propagasyonu (error propagation) uygulanır:
 *
 *   σ_total = √(σ_ch1² + σ_ch2²)
 *
 * Bu, bağımsız ölçümlerin toplamının standart sapmasıdır.
 * Hata çubukları dikey çizgi + yatay kapaklar (caps) şeklinde
 * her veri noktasının üstüne ve altına çizilir.
 *
 * Çözünürlük:
 * ───────────
 * DPI_SCALE = 4 → Canvas boyutları 4x büyütülür.
 * 800×600 temel → 3200×2400 piksel çıktı.
 * Tipik 96 DPI ekranda bu ~300 DPI baskı kalitesine karşılık gelir.
 *
 * @param {Array}   results       - Analiz sonuçları
 * @param {boolean} xAxisFromZero - X ekseni başlangıç modu
 * @param {string}  sourceFileName - Kaynak dosya adı (uzantısız)
 */
export function exportScientificFigure(results, xAxisFromZero, sourceFileName) {
  if (!results || !results.length) return;

  // ── Çözünürlük Konfigürasyonu ──
  const DPI_SCALE = 4;          // 4x büyütme → ~300 DPI
  const W = 800 * DPI_SCALE;    // Toplam genişlik (piksel)
  const H = 600 * DPI_SCALE;    // Toplam yükseklik (piksel)
  const PAD = {
    top:    60 * DPI_SCALE,     // Üst boşluk (başlık için)
    right:  40 * DPI_SCALE,     // Sağ boşluk
    bottom: 100 * DPI_SCALE,    // Alt boşluk (X ekseni etiketleri için)
    left:   100 * DPI_SCALE,    // Sol boşluk (Y ekseni etiketleri için)
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Beyaz arka plan ──
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // ── Veri hazırlama ──
  const xVals = results.map(r => r.totalV);
  const yVals = results.map(r => r.totalI);
  const errCh1 = results.map(r => r.ch1Std);
  const errCh2 = results.map(r => r.ch2Std);

  // Hata propagasyonu: σ_total = √(σ₁² + σ₂²)
  const errTotal = results.map((_, i) => Math.sqrt(errCh1[i] ** 2 + errCh2[i] ** 2));

  // Eksen sınırları — %5 marjin ile
  const xMin = xAxisFromZero ? 0 : Math.min(...xVals) * 0.95;
  const xMax = Math.max(...xVals) * 1.05;
  const yMin = 0;
  const yMax = Math.max(...yVals.map((y, i) => y + errTotal[i])) * 1.15;

  // Koordinat dönüşüm fonksiyonları
  function toCanvasX(v) { return PAD.left + ((v - xMin) / (xMax - xMin)) * plotW; }
  function toCanvasY(v) { return PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH; }

  // ── Eksen çizgileri (L-şekli: sol + alt) ──
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * DPI_SCALE;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);            // Y ekseni
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);     // X ekseni
  ctx.stroke();

  // ── Yazı tipleri (serif — akademik standart) ──
  const serifFont      = `${12 * DPI_SCALE}px "Times New Roman", Georgia, serif`;
  const serifFontBold  = `bold ${14 * DPI_SCALE}px "Times New Roman", Georgia, serif`;
  const serifFontTitle = `bold ${16 * DPI_SCALE}px "Times New Roman", Georgia, serif`;

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5 * DPI_SCALE;

  // ── X ekseni tick'leri ve etiketleri ──
  const xTicks = niceScale(xMin, xMax, 8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = serifFont;
  for (const t of xTicks) {
    const cx = toCanvasX(t);
    if (cx < PAD.left - 2 || cx > PAD.left + plotW + 2) continue;
    // Tick işareti (eksen dışına doğru)
    ctx.beginPath();
    ctx.moveTo(cx, PAD.top + plotH);
    ctx.lineTo(cx, PAD.top + plotH + 8 * DPI_SCALE);
    ctx.stroke();
    // Sayısal etiket
    ctx.fillText(t.toFixed(0), cx, PAD.top + plotH + 12 * DPI_SCALE);
  }

  // ── Y ekseni tick'leri ve etiketleri ──
  const yTicks = niceScale(yMin, yMax, 6);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    const cy = toCanvasY(t);
    if (cy < PAD.top - 2 || cy > PAD.top + plotH + 2) continue;
    // Tick işareti
    ctx.beginPath();
    ctx.moveTo(PAD.left, cy);
    ctx.lineTo(PAD.left - 8 * DPI_SCALE, cy);
    ctx.stroke();
    // Sayısal etiket
    ctx.fillText(t.toFixed(2), PAD.left - 12 * DPI_SCALE, cy);

    // Yatay kılavuz çizgi (açık gri, kesikli)
    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5 * DPI_SCALE;
    ctx.setLineDash([4 * DPI_SCALE, 4 * DPI_SCALE]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, cy);
    ctx.lineTo(PAD.left + plotW, cy);
    ctx.stroke();
    ctx.restore();
  }

  // ── Eksen başlıkları ──
  ctx.fillStyle = '#000000';
  ctx.font = serifFontBold;

  // X ekseni: "Total Voltage (V)"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Total Voltage (V)', PAD.left + plotW / 2, PAD.top + plotH + 50 * DPI_SCALE);

  // Y ekseni: "Current (µA)" — 90° döndürülmüş
  ctx.save();
  ctx.translate(30 * DPI_SCALE, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Current (µA)', 0, 0);
  ctx.restore();

  // ── Veri çizgisi (siyah düz çizgi) ──
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * DPI_SCALE;
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < xVals.length; i++) {
    const cx = toCanvasX(xVals[i]);
    const cy = toCanvasY(yVals[i]);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // ── Hata çubukları (error bars) ──
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1.2 * DPI_SCALE;
  const capW = 4 * DPI_SCALE;
  for (let i = 0; i < xVals.length; i++) {
    const cx = toCanvasX(xVals[i]);
    const cyTop = toCanvasY(yVals[i] + errTotal[i]);
    const cyBot = toCanvasY(yVals[i] - errTotal[i]);
    // Dikey çubuk
    ctx.beginPath();
    ctx.moveTo(cx, cyTop);
    ctx.lineTo(cx, cyBot);
    ctx.stroke();
    // Yatay kapaklar (üst ve alt)
    ctx.beginPath();
    ctx.moveTo(cx - capW, cyTop);
    ctx.lineTo(cx + capW, cyTop);
    ctx.moveTo(cx - capW, cyBot);
    ctx.lineTo(cx + capW, cyBot);
    ctx.stroke();
  }

  // ── Veri noktaları (dolu siyah daireler) ──
  for (let i = 0; i < xVals.length; i++) {
    const cx = toCanvasX(xVals[i]);
    const cy = toCanvasY(yVals[i]);
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * DPI_SCALE, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * DPI_SCALE;
    ctx.stroke();
  }

  // ── Efsane (Legend) ──
  const legendX = PAD.left + 20 * DPI_SCALE;
  const legendY = PAD.top + 16 * DPI_SCALE;
  ctx.font = `${11 * DPI_SCALE}px "Times New Roman", Georgia, serif`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Çizgi + nokta sembolü
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * DPI_SCALE;
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + 24 * DPI_SCALE, legendY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(legendX + 12 * DPI_SCALE, legendY, 3 * DPI_SCALE, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('I_total = ⟨I_ch1⟩ + ⟨I_ch2⟩', legendX + 30 * DPI_SCALE, legendY);

  // ── Figür başlığı ──
  ctx.font = serifFontTitle;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('Detector I-V Characteristic — CAEN N1470', W / 2, PAD.top / 2);

  // ── PNG olarak indirme ──
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sourceFileName}_iv_scientific.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
