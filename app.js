/* ═══════════════════════════════════════════════════════
   app.js — Ana Giriş Noktası (Main Entry Point)
   ═══════════════════════════════════════════════════════
   Uygulamanın merkezi orkestratörü. Tüm modülleri bir
   araya getirir, uygulama durumunu (state) yönetir ve
   DOM olay dinleyicilerini bağlar.

   Modül Yapısı:
   ─────────────
   js/utils.js     — İstatistik ve yardımcı fonksiyonlar
   js/parser.js    — N1470 log dosyası ayrıştırıcı
   js/analysis.js  — Veri analiz pipeline'ı
   js/theme.js     — Tema yönetimi (light/dark)
   js/charts.js    — Chart.js grafik çizimi
   js/export.js    — CSV, PNG, bilimsel figür dışa aktarma
   app.js          — Durum yönetimi ve olay bağlama (bu dosya)

   Veri Akışı:
   ───────────
   1. Kullanıcı .txt dosyasını sürükle-bırak ile yükler
   2. FileReader ile ham metin okunur → rawText
   3. "Analyze" butonuna basılır → parseLog → analyze
   4. Sonuçlar grafiklere, tabloya ve özet kartlara yansıtılır
   5. Export butonları ile CSV/PNG/Science çıktısı alınır
   ═══════════════════════════════════════════════════════ */

import { formatBytes }    from './js/utils.js';
import { parseLog }       from './js/parser.js';
import { analyze }        from './js/analysis.js';
import { getTheme, setTheme, initTheme } from './js/theme.js';
import {
  destroyCharts,
  renderIVChart,
  renderChannelCharts,
  renderStats,
  renderOverview,
} from './js/charts.js';
import {
  exportCSV,
  exportPNG,
  exportScientificFigure,
} from './js/export.js';

/* ═══════════════════════════════════════
   DOM Referansları
   ═══════════════════════════════════════ */

// Dosya import elemanları
const dropZone     = document.getElementById('drop-zone');
const fileInput    = document.getElementById('file-input');
const fileInfo     = document.getElementById('file-info');
const fileName     = document.getElementById('file-name');
const fileSizeEl   = document.getElementById('file-size');
const clearFileBtn = document.getElementById('clear-file-btn');
const analyzeBtn   = document.getElementById('analyze-btn');
const statusBadge  = document.getElementById('status-badge');

// Sonuç bölümleri
const resultsSec   = document.getElementById('results-section');
const statsSec     = document.getElementById('stats-section');
const channelSec   = document.getElementById('channel-section');
const rawSec       = document.getElementById('raw-section');
const statsBody    = document.getElementById('stats-body');
const overviewGrid = document.getElementById('overview-grid');

// Aksiyon butonları
const exportCSVBtn     = document.getElementById('export-csv-btn');
const exportPNGBtn     = document.getElementById('export-png-btn');
const exportScienceBtn = document.getElementById('export-science-btn');
const xaxisOriginBtn   = document.getElementById('xaxis-origin-btn');
const themeToggleBtn   = document.getElementById('theme-toggle-btn');

/* ═══════════════════════════════════════
   Uygulama Durumu (Application State)
   ═══════════════════════════════════════
   Tüm modüller arası paylaşılan durum burada merkezi
   olarak tutulur. Modüller durumu parametre olarak alır.
*/

let rawText        = null;    // Ham log dosyası içeriği
let parsedData     = [];      // Ayrıştırılmış kayıtlar
let analysisData   = null;    // Analiz sonuçları
let chData         = null;    // Kanal bazlı ham okuma verileri
let xAxisFromZero  = false;   // X ekseni 0'dan mı başlasın?
let sourceFileName = 'n1470_data';  // İndirme dosya adı tabanı


/* ═══════════════════════════════════════
   TEMA YÖNETİMİ
   ═══════════════════════════════════════ */

/**
 * onThemeChange — Tema değiştiğinde grafikleri yeniden çiz.
 * Tema renk paleti değiştiği için aktif grafikler güncellenmeli.
 */
function onThemeChange() {
  if (analysisData) {
    renderIVChart(analysisData, xAxisFromZero);
    renderChannelCharts(analysisData);
  }
}

// Kaydedilmiş tema tercihini yükle (varsa)
initTheme(onThemeChange);

// Tema geçiş butonu: light ↔ dark
themeToggleBtn.addEventListener('click', () => {
  setTheme(getTheme() === 'light' ? 'dark' : 'light', onThemeChange);
});


/* ═══════════════════════════════════════
   X EKSENİ BAŞLANGIÇ NOKTASI TOGGLe
   ═══════════════════════════════════════ */

/**
 * X ekseni başlangıcını değiştirir:
 * - "Auto": Verideki en düşük değerden başlar (varsayılan)
 * - "Zero": X ekseni 0'dan başlar
 */
xaxisOriginBtn.addEventListener('click', () => {
  xAxisFromZero = !xAxisFromZero;
  xaxisOriginBtn.textContent = xAxisFromZero ? 'X: Zero' : 'X: Auto';
  xaxisOriginBtn.classList.toggle('active', xAxisFromZero);
  if (analysisData) renderIVChart(analysisData, xAxisFromZero);
});


/* ═══════════════════════════════════════
   DOSYA İÇE AKTARMA (File Import)
   ═══════════════════════════════════════ */

// Drop zone tıklama → dosya seçici aç
dropZone.addEventListener('click', () => fileInput.click());

// Sürükleme olayları — görsel geri bildirim
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

// Dosya bırakma — sürükle-bırak ile yükleme
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

// Dosya seçici ile yükleme
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

// Dosya temizleme butonu
clearFileBtn.addEventListener('click', resetFile);

/**
 * handleFile — Yüklenen Dosyayı İşleme
 *
 * 1. Dosya adından uzantıyı çıkararak export adı oluşturur
 * 2. UI'ı "dosya yüklendi" durumuna getirir
 * 3. FileReader ile dosya içeriğini asenkron okur → rawText
 *
 * @param {File} file - Kullanıcının seçtiği/bıraktığı dosya
 */
function handleFile(file) {
  sourceFileName = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
  fileName.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileInfo.style.display = 'flex';
  dropZone.style.display = 'none';
  analyzeBtn.disabled = false;
  statusBadge.textContent = 'File Loaded';
  statusBadge.classList.remove('active');

  const reader = new FileReader();
  reader.onload = () => { rawText = reader.result; };
  reader.readAsText(file);
}

/**
 * resetFile — Dosya ve Analiz Durumunu Sıfırlama
 *
 * Tüm uygulama durumunu başlangıç haline döndürür:
 * veri, grafikler, sonuç bölümleri temizlenir.
 */
function resetFile() {
  rawText = null;
  parsedData = [];
  analysisData = null;
  chData = null;
  sourceFileName = 'n1470_data';
  fileInput.value = '';
  fileInfo.style.display = 'none';
  dropZone.style.display = '';
  analyzeBtn.disabled = true;
  statusBadge.textContent = 'No Data';
  statusBadge.classList.remove('active');
  [resultsSec, statsSec, channelSec, rawSec].forEach(s => s.style.display = 'none');
  destroyCharts();
}


/* ═══════════════════════════════════════
   ANALİZ ÇALIŞTIRMA (Run Analysis)
   ═══════════════════════════════════════ */

analyzeBtn.addEventListener('click', runAnalysis);

/**
 * runAnalysis — Tam Analiz Pipeline'ını Çalıştırma
 *
 * Kullanıcının yüklediği ham veriyi ayrıştırır, analiz eder ve
 * tüm görselleştirmeleri (grafik, tablo, özet) günceller.
 *
 * Adımlar:
 * 1. rawText → parseLog() → yapılandırılmış kayıtlar
 * 2. kayıtlar + ayarlar → analyze() → I-V sonuçları
 * 3. sonuçlar → renderIVChart(), renderStats(), renderChannelCharts(), renderOverview()
 * 4. Sayfa sonuçlara kaydırır (smooth scroll)
 */
function runAnalysis() {
  if (!rawText) return;

  // Kullanıcı ayarlarını oku
  const tolerance = parseFloat(document.getElementById('voltage-tolerance').value) || 5;
  const stepSize  = parseFloat(document.getElementById('voltage-step').value) || 250;
  const ch0Thresh = parseFloat(document.getElementById('ch0-threshold').value) || 10;
  const bipolar   = parseInt(document.getElementById('bipolar-factor').value, 10) || 2;

  // 1. Ayrıştırma
  parsedData = parseLog(rawText);
  if (!parsedData.length) {
    alert('No valid N1470 records found in this file.');
    return;
  }

  // 2. Analiz
  const result = analyze(parsedData, { tolerance, stepSize, ch0Thresh, bipolar });
  if (!result) {
    alert('No valid channel 1/2 data found.');
    return;
  }
  analysisData = result.results;
  chData = result.chData;

  // 3. Görselleştirme
  statusBadge.textContent = `${analysisData.length} Voltage Points`;
  statusBadge.classList.add('active');

  resultsSec.style.display = '';
  statsSec.style.display = '';
  channelSec.style.display = '';
  rawSec.style.display = '';

  renderIVChart(analysisData, xAxisFromZero);
  renderStats(analysisData, statsBody);
  renderChannelCharts(analysisData);
  renderOverview(parsedData, chData, analysisData, overviewGrid);

  // 4. Sonuçlara kaydır
  resultsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


/* ═══════════════════════════════════════
   DIŞA AKTARMA BUTONLARI
   ═══════════════════════════════════════ */

// CSV — tablo verisini virgülle ayrılmış dosya olarak
exportCSVBtn.addEventListener('click', () => {
  exportCSV(analysisData, sourceFileName);
});

// PNG — ekrandaki grafiğin görüntüsü
exportPNGBtn.addEventListener('click', () => {
  exportPNG(sourceFileName);
});

// Science — yayın kalitesinde bilimsel figür
exportScienceBtn.addEventListener('click', () => {
  exportScientificFigure(analysisData, xAxisFromZero, sourceFileName);
});


/* ═══════════════════════════════════════
   OTOMATİK YÜKLEME (Test/Geliştirme)
   ═══════════════════════════════════════
   URL'ye ?autoload=dosya_adi.txt eklenerek dosya otomatik
   yüklenebilir ve analiz çalıştırılabilir. HTTP sunucusu
   üzerinden çalıştırılmalıdır (file:// protokolünde fetch
   CORS nedeniyle çalışmaz).

   Örnek: http://localhost:8765/index.html?autoload=data.txt
*/
(async () => {
  const params = new URLSearchParams(window.location.search);
  const autoFile = params.get('autoload');
  if (!autoFile) return;
  try {
    const resp = await fetch(autoFile);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    rawText = text;
    sourceFileName = autoFile.replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
    fileName.textContent = autoFile;
    fileSizeEl.textContent = formatBytes(text.length);
    fileInfo.style.display = 'flex';
    dropZone.style.display = 'none';
    analyzeBtn.disabled = false;
    statusBadge.textContent = 'File Loaded';
    setTimeout(runAnalysis, 100);
  } catch (e) {
    console.error('Auto-load failed:', e);
  }
})();
