/* ═══════════════════════════════════════════════════════
   utils.js — Yardımcı Fonksiyonlar (Utility Functions)
   ═══════════════════════════════════════════════════════
   Tüm modüllerde ortak kullanılan istatistiksel hesaplama,
   dosya boyutu formatlama, blob indirme ve grafik ölçekleme
   yardımcı fonksiyonlarını içerir.
   ═══════════════════════════════════════════════════════ */

/**
 * mean — Aritmetik Ortalama Hesaplama
 *
 * Verilen sayı dizisinin aritmetik ortalamasını hesaplar.
 * Boş dizi verildiğinde 0 döndürür.
 *
 * Formül:  ⟨x⟩ = (1/N) * Σ xᵢ
 *
 * @param {number[]} arr - Ortalaması hesaplanacak sayı dizisi
 * @returns {number} Aritmetik ortalama değer
 */
export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * stddev — Standart Sapma Hesaplama (Bessel Düzeltmeli)
 *
 * Verilen sayı dizisinin örnek standart sapmasını (sample std)
 * hesaplar. N-1 (Bessel düzeltmesi) kullanarak hesaplama yapar.
 * Bu, sonlu bir örneklemden popülasyon varyansının yansız
 * tahmincisini verir.
 *
 * Formül:  σ = √[ Σ(xᵢ - ⟨x⟩)² / (N-1) ]
 *
 * Tek elemanlı veya boş dizilerde 0 döndürür (tanımsız).
 *
 * @param {number[]} arr - Standart sapması hesaplanacak sayı dizisi
 * @returns {number} Örnek standart sapma
 */
export function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * formatBytes — Dosya Boyutu Formatlama
 *
 * Byte cinsinden verilen dosya boyutunu insan tarafından
 * okunabilir birime (B, KB, MB) dönüştürür.
 *
 * @param {number} b - Byte cinsinden dosya boyutu
 * @returns {string} Formatlanmış boyut (örn: "1.5 MB")
 */
export function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

/**
 * downloadBlob — Blob İçeriğini Dosya Olarak İndirme
 *
 * Verilen metin veya ikili içeriği belirtilen dosya adı ve
 * MIME tipiyle tarayıcıda indirme olarak tetikler.
 * Geçici bir Blob URL oluşturur, bir <a> elementi ile
 * indirmeyi başlatır ve ardından URL'yi serbest bırakır.
 *
 * @param {string|ArrayBuffer} content - İndirilecek içerik
 * @param {string} name     - İndirilecek dosyanın adı (uzantı dahil)
 * @param {string} mime     - MIME tipi (örn: "text/csv", "image/png")
 */
export function downloadBlob(content, name, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * niceScale — Grafik Ekseni İçin Düzgün Tick Değerleri Üretme
 *
 * Verilen [min, max] aralığı için görsel olarak temiz ve
 * okunabilir tick değerleri hesaplar. Bilimsel grafiklerde
 * "güzel" sayılar (1, 2, 5 ve bunların 10 katları) tercih
 * edilir. Bu fonksiyon hedef tick sayısına göre uygun adım
 * büyüklüğünü seçer.
 *
 * Algoritma:
 * 1. Ham adım = aralık / hedef_tick_sayısı
 * 2. Büyüklük sırası (magnitude) hesaplanır: 10^floor(log10(ham_adım))
 * 3. Normalized değere göre {1, 2, 5, 10} × magnitude seçilir
 * 4. Seçilen adımla min'den max'a kadar tick'ler üretilir
 *
 * @param {number} min         - Eksen minimum değeri
 * @param {number} max         - Eksen maksimum değeri
 * @param {number} targetTicks - Hedeflenen tick sayısı
 * @returns {number[]} Tick değerlerinin sıralı dizisi
 */
export function niceScale(min, max, targetTicks) {
  const range = max - min;
  if (range <= 0) return [min];
  const roughStep = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const magMsd = roughStep / mag;
  let niceStep;
  if (magMsd <= 1.5) niceStep = 1 * mag;
  else if (magMsd <= 3) niceStep = 2 * mag;
  else if (magMsd <= 7) niceStep = 5 * mag;
  else niceStep = 10 * mag;

  const start = Math.ceil(min / niceStep) * niceStep;
  const ticks = [];
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return ticks;
}
