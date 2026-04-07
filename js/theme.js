/* ═══════════════════════════════════════════════════════
   theme.js — Tema Yönetimi (Light/Dark Theme Manager)
   ═══════════════════════════════════════════════════════
   Uygulamanın aydınlık (light) ve karanlık (dark) tema
   geçişlerini yönetir. Kullanıcı tercihini localStorage'da
   saklar, böylece sayfa yenileme sonrasında da seçim korunur.

   Grafik rengleri tema ile senkronize edilir — Chart.js
   tooltip, grid, eksen ve efsane (legend) renkleri tema
   değiştikçe güncellenir.
   ═══════════════════════════════════════════════════════ */

const STORAGE_KEY = 'n1470-theme';

/**
 * getTheme — Geçerli Tema Adını Döndürme
 *
 * HTML kök elementinden (documentElement) data-theme attribute'unu
 * okuyarak geçerli temayı döndürür. Attribute yoksa varsayılan
 * olarak 'light' döner.
 *
 * @returns {'light'|'dark'} Geçerli tema adı
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * setTheme — Temayı Değiştirme
 *
 * Verilen tema adını HTML kök elementine uygular ve localStorage'a
 * kaydeder. Tema değiştiğinde sağlanan callback fonksiyonu
 * çağrılır (grafiklerin yeniden çizilmesi için).
 *
 * CSS değişkenleri (--bg-primary, --text-primary, vb.) otomatik
 * olarak güncellenir çünkü index.css'de html[data-theme="dark"]
 * ve html[data-theme="light"] kuralları tanımlıdır.
 *
 * @param {string}   theme    - 'light' veya 'dark'
 * @param {Function} onChange - Tema değiştikten sonra çağrılacak callback
 */
export function setTheme(theme, onChange) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  if (onChange) onChange();
}

/**
 * initTheme — Kaydedilmiş Temayı Yükleme
 *
 * Sayfa yüklendiğinde localStorage'dan daha önce kaydedilmiş
 * tema tercihini okur ve uygular. Kayıtlı tema yoksa HTML'deki
 * varsayılan tema (light) korunur.
 *
 * @param {Function} onChange - Tema uygulandıktan sonra çağrılacak callback
 */
export function initTheme(onChange) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) setTheme(saved, onChange);
}

/**
 * chartColors — Tema Bazlı Grafik Renk Paleti
 *
 * Geçerli temaya göre Chart.js grafiklerinde kullanılacak
 * renk setini döndürür. Aydınlık temada koyu metin/açık
 * grid, karanlık temada açık metin/koyu grid kullanılır.
 *
 * Dönen nesne Chart.js konfigürasyonunda doğrudan kullanılabilir:
 * - gridColor:    Izgara çizgisi rengi
 * - tickColor:    Eksen tick etiketleri rengi
 * - titleColor:   Grafik başlığı rengi
 * - legendColor:  Efsane (legend) metin rengi
 * - tooltipBg:    Tooltip arka plan rengi
 * - tooltipTitle: Tooltip başlık rengi
 * - tooltipBody:  Tooltip gövde metin rengi
 * - tooltipBorder:Tooltip kenarlık rengi
 * - pointBorder:  Veri noktası kenarlık rengi (kontrast için)
 *
 * @returns {Object} Tema renk paleti
 */
export function chartColors() {
  const dark = getTheme() === 'dark';
  return {
    gridColor:     dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)',
    tickColor:     dark ? '#a0a0a0' : '#5a6070',
    titleColor:    dark ? '#e0e0e0' : '#1a1d23',
    legendColor:   dark ? '#a0a0a0' : '#5a6070',
    tooltipBg:     dark ? 'rgba(30,30,30,.95)' : 'rgba(255,255,255,.95)',
    tooltipTitle:  dark ? '#e0e0e0' : '#1a1d23',
    tooltipBody:   dark ? '#a0a0a0' : '#5a6070',
    tooltipBorder: dark ? '#333' : '#e0e3ea',
    pointBorder:   dark ? '#1e1e1e' : '#ffffff',
  };
}
