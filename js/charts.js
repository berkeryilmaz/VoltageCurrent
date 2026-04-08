/* ═══════════════════════════════════════════════════════
   charts.js — Grafik Çizim Modülü (Chart Rendering)
   ═══════════════════════════════════════════════════════
   Chart.js (v4) kütüphanesi kullanılarak I-V karakteristik
   eğrisi, kanal bazlı dağılım grafikleri, istatistik tablosu
   ve veri özet panellerinin oluşturulmasından sorumludur.

   Tüm grafikler tema renklerine duyarlıdır — tema
   değiştiğinde yeniden çizilirler.
   ═══════════════════════════════════════════════════════ */

import { chartColors } from './theme.js';

/* ─────────────────────────────────────────
   Grafik referansları — destroy/rebuild döngüsünde kullanılır.
   Module-scope'da tutulur; dışarıdan state.js yerine burada
   yönetilir çünkü yalnızca bu modül yaratır ve yok eder.
   ───────────────────────────────────────── */
let ivChart  = null;
let ch1Chart = null;
let ch2Chart = null;
let tsVChart = null;
let tsIChart = null;

/**
 * destroyCharts — Mevcut Grafikleri Yok Etme
 *
 * Chart.js instance'larının bellek sızıntısını önlemek için
 * yeniden oluşturulmadan önce eski instance'ların yok edilmesi
 * gerekir. Bu fonksiyon aktif grafikleri temizler ve
 * referansları null'a çeker.
 */
export function destroyCharts() {
  if (ivChart)  { ivChart.destroy();  ivChart = null; }
  if (ch1Chart) { ch1Chart.destroy(); ch1Chart = null; }
  if (ch2Chart) { ch2Chart.destroy(); ch2Chart = null; }
  if (tsVChart) { tsVChart.destroy(); tsVChart = null; }
  if (tsIChart) { tsIChart.destroy(); tsIChart = null; }
}

/**
 * getIVChart — Aktif I-V Grafiği Referansını Döndürme
 *
 * Export modülünün (PNG dışa aktarma) aktif grafik instance'ına
 * erişebilmesi için getter fonksiyonu.
 *
 * @returns {Chart|null} Aktif Chart.js instance veya null
 */
export function getIVChart() {
  return ivChart;
}

export function getTsVChart() {
  return tsVChart;
}

export function getTsIChart() {
  return tsIChart;
}

/**
 * renderIVChart — Ana I-V Karakteristik Eğrisi Grafiği
 *
 * Analiz sonuçlarını kullanarak toplam akım vs. toplam voltaj
 * eğrisini çizer. Üç dataset gösterir:
 *
 * 1. Toplam Akım (Ch1 + Ch2): Yeşil düz çizgi, dolu alan
 *    → Dedektörün çektiği toplam akımı temsil eder
 * 2. Kanal 1 ⟨I⟩: Mor kesikli çizgi
 *    → İlk HV kanalının ortalaması
 * 3. Kanal 2 ⟨I⟩: Turuncu kesikli çizgi
 *    → İkinci HV kanalının ortalaması
 *
 * X ekseni 'linear' tipindedir ve xAxisFromZero parametresine
 * göre 0'dan veya veri minimumundan başlar.
 *
 * @param {Array}   results       - Analiz sonuçları
 * @param {boolean} xAxisFromZero - true: X ekseni 0'dan başlar, false: auto
 */
export function renderIVChart(results, xAxisFromZero) {
  destroyCharts();

  const labels  = results.map(r => r.totalV);
  const totals  = results.map(r => r.totalI);
  const ch1Vals = results.map(r => r.ch1Avg);
  const ch2Vals = results.map(r => r.ch2Avg);

  const c = chartColors();
  const ctx = document.getElementById('iv-chart').getContext('2d');

  ivChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Current (Ch1 + Ch2)',
          data: totals,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,.10)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: '#10b981',
          pointBorderColor: c.pointBorder,
          pointBorderWidth: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Ch 1 ⟨I⟩',
          data: ch1Vals,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.06)',
          borderWidth: 1.8,
          borderDash: [6, 3],
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#6366f1',
          tension: 0.3,
          fill: false,
        },
        {
          label: 'Ch 2 ⟨I⟩',
          data: ch2Vals,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,.06)',
          borderWidth: 1.8,
          borderDash: [6, 3],
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f59e0b',
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: c.legendColor, font: { family: "'Inter'", size: 12 }, usePointStyle: true, padding: 20 },
        },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipTitle,
          bodyColor: c.tooltipBody,
          borderColor: c.tooltipBorder,
          borderWidth: 1,
          padding: 14,
          titleFont: { family: "'Inter'", weight: '600' },
          bodyFont: { family: "'JetBrains Mono'", size: 12 },
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)} µA`,
            title: items => `Voltage: ${items[0].label} V`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: xAxisFromZero ? 0 : undefined,
          title: { display: true, text: 'Total Voltage (V)', color: c.tickColor, font: { family: "'Inter'", size: 13, weight: '600' } },
          ticks: { color: c.tickColor, font: { family: "'JetBrains Mono'", size: 11 } },
          grid: { color: c.gridColor },
        },
        y: {
          title: { display: true, text: 'Current (µA)', color: c.tickColor, font: { family: "'Inter'", size: 13, weight: '600' } },
          ticks: { color: c.tickColor, font: { family: "'JetBrains Mono'", size: 11 } },
          grid: { color: c.gridColor },
          beginAtZero: true,
        },
      },
    },
  });
}

/**
 * renderChannelCharts — Kanal Bazlı Bar Grafikleri
 *
 * Kanal 1 ve Kanal 2 için ayrı ayrı bar grafikleri çizer.
 * Her grafik iki dataset içerir:
 *
 * 1. Ortalama Akım (⟨I⟩): Her voltaj seviyesinde kanalın
 *    ortalama akım değeri — ana bar
 * 2. Standart Sapma (σ):  Ölçüm dağılımının genişliği —
 *    daha soluk ikincil bar
 *
 * İki kanal yan yana gösterilir (CSS grid ile).
 *
 * @param {Array} results - Analiz sonuçları
 */
export function renderChannelCharts(results) {
  const labels = results.map(r => r.totalV);
  const c = chartColors();

  // Kanal 1 bar grafiği
  const ctx1 = document.getElementById('ch1-chart').getContext('2d');
  ch1Chart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ch 1 Mean Current (µA)',
        data: results.map(r => r.ch1Avg),
        backgroundColor: 'rgba(99,102,241,.55)',
        borderColor: '#6366f1',
        borderWidth: 1.5, borderRadius: 4,
      }, {
        label: 'Ch 1 σ (µA)',
        data: results.map(r => r.ch1Std),
        backgroundColor: 'rgba(99,102,241,.2)',
        borderColor: 'rgba(99,102,241,.4)',
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: channelChartOpts('Channel 1 — Current Distribution', c),
  });

  // Kanal 2 bar grafiği
  const ctx2 = document.getElementById('ch2-chart').getContext('2d');
  ch2Chart = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ch 2 Mean Current (µA)',
        data: results.map(r => r.ch2Avg),
        backgroundColor: 'rgba(245,158,11,.55)',
        borderColor: '#f59e0b',
        borderWidth: 1.5, borderRadius: 4,
      }, {
        label: 'Ch 2 σ (µA)',
        data: results.map(r => r.ch2Std),
        backgroundColor: 'rgba(245,158,11,.2)',
        borderColor: 'rgba(245,158,11,.4)',
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: channelChartOpts('Channel 2 — Current Distribution', c),
  });
}

/**
 * channelChartOpts — Kanal Grafiği İçin Chart.js Opsiyon Şablonu
 *
 * Her iki kanal grafiği aynı stili paylaşır. Bu fonksiyon ortak
 * Chart.js options nesnesini oluşturur: eksen ayarları, tooltip,
 * legend ve grid konfigürasyonu.
 *
 * @param {string} title - Grafik başlığı (ör: "Channel 1 — Current Distribution")
 * @param {Object} c     - chartColors() çıktısı (tema renk paleti)
 * @returns {Object} Chart.js options nesnesi
 */
function channelChartOpts(title, c) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: c.legendColor, font: { size: 11 }, usePointStyle: true, padding: 14 } },
      title: { display: true, text: title, color: c.titleColor, font: { family: "'Inter'", size: 13, weight: '600' }, padding: { bottom: 14 } },
      tooltip: {
        backgroundColor: c.tooltipBg,
        titleColor: c.tooltipTitle, bodyColor: c.tooltipBody,
        borderColor: c.tooltipBorder, borderWidth: 1,
        bodyFont: { family: "'JetBrains Mono'", size: 11 },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Total Voltage (V)', color: c.tickColor, font: { size: 11 } },
        ticks: { color: c.tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
        grid: { color: c.gridColor },
      },
      y: {
        title: { display: true, text: 'Current (µA)', color: c.tickColor, font: { size: 11 } },
        ticks: { color: c.tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
        grid: { color: c.gridColor },
        beginAtZero: true,
      },
    },
  };
}

/**
 * renderStats — İstatistik Tablosunu Doldurma
 *
 * Analiz sonuçlarını HTML tablosuna (<tbody>) satır satır
 * yazar. Her satırda gösterilen sütunlar:
 *
 * | Toplam V | Nominal V | Ch1 ⟨I⟩ | Ch2 ⟨I⟩ | I_total | σ Ch1 | σ Ch2 | N(Ch1) | N(Ch2) |
 *
 * Total I sütunu yeşil ve kalın yazılarak vurgulanır.
 * Değerler 4 ondalık basamakla gösterilir.
 *
 * @param {Array}       results  - Analiz sonuçları
 * @param {HTMLElement} tbody    - Hedef <tbody> elementi
 */
export function renderStats(results, tbody) {
  tbody.innerHTML = '';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const tr = document.createElement('tr');
    tr.dataset.index = i;
    tr.title = "Click to view raw data points";
    tr.innerHTML = `
      <td>${r.totalV.toFixed(0)}</td>
      <td>${r.nominalV.toFixed(0)}</td>
      <td>${r.ch1Avg.toFixed(4)}</td>
      <td>${r.ch2Avg.toFixed(4)}</td>
      <td style="color:#10b981;font-weight:600">${r.totalI.toFixed(4)}</td>
      <td>${r.ch1Std.toFixed(4)}</td>
      <td>${r.ch2Std.toFixed(4)}</td>
      <td>${r.ch1N}</td>
      <td>${r.ch2N}</td>`;
    tbody.appendChild(tr);
  }
}

/**
 * renderOverview — Veri Özet Kartlarını Oluşturma
 *
 * Ayrıştırılmış tüm log verisinden özet istatistikleri
 * hesaplayarak overview-grid'e kart şeklinde yerleştirir.
 * Gösterilen metrikler:
 *
 * - Toplam Log Kaydı Sayısı
 * - Kanal 1 IMonH Örnek Sayısı
 * - Kanal 2 IMonH Örnek Sayısı
 * - Tespit Edilen Voltaj Plato Sayısı
 * - Voltaj Aralığı (min–max V)
 * - Maksimum Toplam Akım (µA)
 * - Zaman Aralığı (başlangıç–bitiş saat:dakika:saniye)
 *
 * @param {Array}       allRecords - Tüm ayrıştırılmış kayıtlar
 * @param {Object}      chData     - Kanal bazlı veri ({1:[...], 2:[...]})
 * @param {Array}       results    - Analiz sonuçları
 * @param {HTMLElement} container  - Hedef grid elementi
 */
export function renderOverview(allRecords, chData, results, container) {
  const totalRecords = allRecords.length;
  const ch1Records = chData[1] ? chData[1].length : 0;
  const ch2Records = chData[2] ? chData[2].length : 0;
  const vMin = results.length ? results[0].totalV : 0;
  const vMax = results.length ? results[results.length - 1].totalV : 0;
  const iMax = results.length ? Math.max(...results.map(r => r.totalI)) : 0;
  const timeRange = allRecords.length >= 2
    ? `${allRecords[0].timestamp.split('T')[1].substring(0,8)} – ${allRecords[allRecords.length-1].timestamp.split('T')[1].substring(0,8)}`
    : '—';

  const items = [
    { value: totalRecords.toLocaleString(), label: 'Total Log Records' },
    { value: ch1Records.toLocaleString(),   label: 'Ch 1 IMonH Samples' },
    { value: ch2Records.toLocaleString(),   label: 'Ch 2 IMonH Samples' },
    { value: results.length,                label: 'Voltage Plateaus' },
    { value: `${vMin}–${vMax}`,             label: 'Voltage Range (V)' },
    { value: iMax.toFixed(4),               label: 'Max Total I (µA)' },
    { value: timeRange,                     label: 'Time Span' },
  ];

  container.innerHTML = items.map(i => `
    <div class="overview-item">
      <div class="ov-value">${i.value}</div>
      <div class="ov-label">${i.label}</div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────
   Zaman Serisi (Time-Series) Grafikleri
   ───────────────────────────────────────── */

/**
 * Boş olmayan değerler üzerinden (null atlayarak) median filtresi uygular
 */
function applyMedianFilter(data, windowSize) {
  if (!data || windowSize < 1) return data;
  const result = new Array(data.length).fill(null);
  const half = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    if (data[i] === null) continue;
    const windowData = [];
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < data.length && data[j] !== null) {
        windowData.push(data[j]);
      }
    }
    if (windowData.length > 0) {
      windowData.sort((a,b) => a - b);
      const mid = Math.floor(windowData.length / 2);
      result[i] = windowData.length % 2 !== 0 ? windowData[mid] : (windowData[mid - 1] + windowData[mid]) / 2;
    }
  }
  return result;
}

/**
 * renderTimeSeriesCharts
 * Ham loglardaki (records) VMon ve IMonH değerlerini zamana karşı çizer.
 * Hem Kanal 1 hem Kanal 2 için okumaları kendi zaman ekseni etiketlerine eşleştirir.
 * 
 * @param {Array} records - parseLog()'dan gelen ayrıştırılmış tüm log satırları
 */
export function renderTimeSeriesCharts(records) {
  const c = chartColors();

  // Yalnızca geçerli kanalları süzgeçe al
  const validRecords = records.filter(r => r.ch === 1 || r.ch === 2);

  // VMon logları
  const vLogs = validRecords.filter(r => r.par === 'VMon');
  const vRawLabels = [...new Set(vLogs.map(r => r.timestamp))].sort();
  
  // IMonH logları
  const iLogs = validRecords.filter(r => r.par === 'IMonH');
  const iRawLabels = [...new Set(iLogs.map(r => r.timestamp))].sort();

  // Zaman etiketlerini HH:MM:SS formatına çevir, boşlukları null ile doldurmak için lookup map oluştur.
  const createMap = (filteredLogs, channel) => {
    const map = {};
    filteredLogs.filter(r => r.ch === channel).forEach(r => map[r.timestamp] = r.val);
    return map;
  };

  const vCh1Map = createMap(vLogs, 1);
  const vCh2Map = createMap(vLogs, 2);
  const iCh1Map = createMap(iLogs, 1);
  const iCh2Map = createMap(iLogs, 2);

  // Veri Serilerini oluştur (her HH:MM:SS degeri icin map icinde arama yapariz, yoksa null doner spanGaps: true devreye girer)
  const formatTime = (ts) => ts.split('T')[1].substring(0, 8);
  const vDisplayLabels = vRawLabels.map(formatTime);
  const vDataCh1 = vRawLabels.map(ts => vCh1Map[ts] !== undefined ? vCh1Map[ts] : null);
  const vDataCh2 = vRawLabels.map(ts => vCh2Map[ts] !== undefined ? vCh2Map[ts] : null);

  const iDisplayLabels = iRawLabels.map(formatTime);
  const iDataCh1 = iRawLabels.map(ts => iCh1Map[ts] !== undefined ? iCh1Map[ts] : null);
  const iDataCh2 = iRawLabels.map(ts => iCh2Map[ts] !== undefined ? iCh2Map[ts] : null);

  const windowSize = document.getElementById('median-window') ? parseInt(document.getElementById('median-window').value, 10) || 155 : 155;

  const iDataTotal = iDisplayLabels.map((_, idx) => {
    const d1 = iDataCh1[idx];
    const d2 = iDataCh2[idx];
    if (d1 === null && d2 === null) return null;
    return (d1 || 0) + (d2 || 0);
  });

  const iDataCh1Filtered = applyMedianFilter(iDataCh1, windowSize);
  const iDataCh2Filtered = applyMedianFilter(iDataCh2, windowSize);
  const iDataTotalFiltered = applyMedianFilter(iDataTotal, windowSize);

  // Voltaj - Zaman Grafiğini Çiz
  const tsVEl = document.getElementById('ts-v-chart');
  if (tsVEl) {
    if (tsVChart && tsVChart.data.datasets.length === 2) {
      tsVChart.data.labels = vDisplayLabels;
      tsVChart.data.datasets[0].data = vDataCh1;
      tsVChart.data.datasets[1].data = vDataCh2;
      tsVChart.update('none');
    } else {
      if (tsVChart) tsVChart.destroy();
      tsVChart = new Chart(tsVEl.getContext('2d'), {
        type: 'line',
        data: {
          labels: vDisplayLabels,
          datasets: [
            {
              label: 'Ch 1 Voltage (VMon)',
              data: vDataCh1,
              borderColor: '#6366f1',
              borderWidth: 1.5,
              pointRadius: 1,
              pointHoverRadius: 4,
              tension: 0, 
              spanGaps: true
            },
            {
              label: 'Ch 2 Voltage (VMon)',
              data: vDataCh2,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              pointRadius: 1,
              pointHoverRadius: 4,
              tension: 0,
              spanGaps: true
            }
          ]
        },
        options: tsChartOpts('Voltage Over Time', 'Voltage (V)', c)
      });
    }
  }

  // Akım - Zaman Grafiğini Çiz
  const tsIEl = document.getElementById('ts-i-chart');
  if (tsIEl) {
    if (tsIChart && tsIChart.data.datasets.length === 6) {
      tsIChart.data.labels = iDisplayLabels;
      tsIChart.data.datasets[0].data = iDataCh1;
      tsIChart.data.datasets[1].data = iDataCh2;
      tsIChart.data.datasets[2].data = iDataTotal;
      tsIChart.data.datasets[3].data = iDataCh1Filtered;
      tsIChart.data.datasets[4].data = iDataCh2Filtered;
      tsIChart.data.datasets[5].data = iDataTotalFiltered;
      tsIChart.update('none');
    } else {
      if (tsIChart) tsIChart.destroy();
      tsIChart = new Chart(tsIEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: iDisplayLabels,
        datasets: [
          {
            label: 'Ch 1 Current (IMonH)',
            data: iDataCh1,
            borderColor: '#6366f1',
            borderWidth: 1.5,
            pointRadius: 1,
            pointHoverRadius: 4,
            tension: 0,
            spanGaps: true,
            hidden: true
          },
          {
            label: 'Ch 2 Current (IMonH)',
            data: iDataCh2,
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            pointRadius: 1,
            pointHoverRadius: 4,
            tension: 0,
            spanGaps: true,
            hidden: true
          },
          {
            label: 'Total Current',
            data: iDataTotal,
            borderColor: '#10b981',
            borderWidth: 1.5,
            pointRadius: 1,
            pointHoverRadius: 4,
            tension: 0,
            spanGaps: true,
            hidden: true
          },
          {
            label: 'Ch 1 Filtered (Median)',
            data: iDataCh1Filtered,
            borderColor: '#818cf8',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0,
            spanGaps: true,
            hidden: false
          },
          {
            label: 'Ch 2 Filtered (Median)',
            data: iDataCh2Filtered,
            borderColor: '#fbbf24',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0,
            spanGaps: true,
            hidden: false
          },
          {
            label: 'Total Filtered (Median)',
            data: iDataTotalFiltered,
            borderColor: '#34d399',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0,
            spanGaps: true,
            hidden: false
          }
        ]
      },
      options: tsChartOpts('Current Over Time', 'Current (µA)', c)
    });
    }
  }
}

function tsChartOpts(title, yLabel, c) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { labels: { color: c.legendColor, font: { size: 11 }, usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: c.tooltipBg, titleColor: c.tooltipTitle, bodyColor: c.tooltipBody,
        borderColor: c.tooltipBorder, borderWidth: 1, padding: 12,
        bodyFont: { family: "'JetBrains Mono'", size: 11 },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Time (HH:MM:SS)', color: c.tickColor, font: { size: 11 } },
        ticks: { color: c.tickColor, font: { family: "'JetBrains Mono'", size: 10 }, maxTicksLimit: 12 },
        grid: { color: c.gridColor },
      },
      y: {
        title: { display: true, text: yLabel, color: c.tickColor, font: { size: 11 } },
        ticks: { color: c.tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
        grid: { color: c.gridColor },
      },
    },
  };
}
