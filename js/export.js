/* ============================================================================
   EXPORT.JS
   Modul ekspor data & laporan:
   - Export CSV (tabel Indikator)
   - Export Excel (.xls, trik table-to-excel, tanpa backend)
   - Export PDF (menggunakan jsPDF via CDN)
   - Print (window.print dengan tampilan cetak khusus)
   ============================================================================ */

window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  const exportModule = {};

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* -----------------------------------------------------------------------
     CSV EXPORT - Tabel Indikator (menghormati filter & pencarian aktif)
     ----------------------------------------------------------------------- */
  exportModule.exportIndikatorCSV = function () {
    const rows = IKOD.render.getFilteredIndikatorRows();
    if (!rows.length) {
      IKOD.toast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }
    const header = ['ID', 'Nama Indikator', 'Dimensi', 'Satuan', 'Sumber Data', 'Rata-rata Nasional'];
    const lines = [header.join(',')];
    rows.forEach((r) => {
      const dimName = IKOD.data.ikod.meta.dimensions.find((d) => d.id === r.dimensi_id)?.name || r.dimensi_id;
      lines.push([
        r.id, `"${r.name}"`, `"${dimName}"`, r.unit, `"${r.source}"`, r.national_avg,
      ].join(','));
    });
    downloadBlob('\uFEFF' + lines.join('\n'), 'IKOD_Data_Indikator.csv', 'text/csv;charset=utf-8;');
    IKOD.toast('File CSV berhasil diunduh.', 'success', 'Export CSV');
  };

  /* -----------------------------------------------------------------------
     EXCEL EXPORT (.xls) - Ringkasan skor IKOD seluruh provinsi
     Menggunakan trik table HTML dibungkus MIME Excel (tanpa library/backend)
     ----------------------------------------------------------------------- */
  exportModule.exportExcel = function () {
    const provinces = IKOD.data.province.provinces.slice().sort((a, b) => a.rank - b.rank);
    let table = `<table border="1"><tr>
      <th>Peringkat</th><th>Provinsi</th><th>Ibu Kota</th><th>Pulau/Region</th>
      <th>Jumlah Kab/Kota</th><th>Skor IKOD ${IKOD.filterModule.getSelectedYear()}</th><th>Tren</th></tr>`;
    provinces.forEach((p) => {
      const score = IKOD.filterModule.getScoreForYear(p.id, IKOD.filterModule.getSelectedYear());
      table += `<tr>
        <td>${p.rank}</td><td>${p.name}</td><td>${p.ibukota}</td><td>${p.pulau_region}</td>
        <td>${p.jumlah_kabkota}</td><td>${score.toFixed(2)}</td><td>${p.trend}</td></tr>`;
    });
    table += '</table>';

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head><body>${table}</body></html>`;
    downloadBlob(template, 'IKOD_Laporan_Provinsi.xls', 'application/vnd.ms-excel');
    IKOD.toast('File Excel berhasil diunduh.', 'success', 'Export Excel');
  };

  /* -----------------------------------------------------------------------
     PDF EXPORT - Laporan ringkas menggunakan jsPDF (CDN)
     ----------------------------------------------------------------------- */
  exportModule.exportPDF = function () {
    if (!window.jspdf) {
      IKOD.toast('Library PDF belum termuat. Periksa koneksi internet untuk CDN.', 'danger');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 64;

    // Header
    doc.setFillColor(21, 59, 117);
    doc.rect(0, 0, pageWidth, 90, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Dashboard IKOD - Laporan Ringkas', margin, 42);
    doc.setFontSize(10);
    doc.text('Indeks Kinerja Otonomi Daerah — Prototype v1 (Riset BRIN)', margin, 62);

    y = 118;
    doc.setTextColor(27, 36, 48);
    doc.setFontSize(12);
    doc.text(`Skor IKOD Nasional (${IKOD.filterModule.getSelectedYear()}): ${IKOD.data.kpi.skor_ikod_nasional}`, margin, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(`Cakupan data: ${IKOD.data.kpi.jumlah_provinsi} Provinsi, ${IKOD.data.kpi.jumlah_kabkota} Kabupaten/Kota, ${IKOD.data.kpi.jumlah_dimensi} Dimensi, ${IKOD.data.kpi.jumlah_indikator} Indikator.`, margin, y);
    y += 26;

    doc.setFontSize(12);
    doc.text('Peringkat 10 Provinsi Skor IKOD Tertinggi', margin, y);
    y += 10;
    doc.setDrawColor(220, 224, 232);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;

    const top10 = IKOD.data.province.provinces.slice().sort((a, b) => a.rank - b.rank).slice(0, 10);
    doc.setFontSize(9.5);
    top10.forEach((p, idx) => {
      doc.text(`${idx + 1}. ${p.name}`, margin, y);
      doc.text(`${p.skor_ikod.toFixed(2)}`, pageWidth - margin - 30, y);
      y += 16;
    });

    y += 12;
    doc.setFontSize(12);
    doc.text('Catatan Metodologi', margin, y);
    y += 10;
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
    doc.setFontSize(9);
    const note = 'Laporan ini dihasilkan otomatis dari prototype Dashboard IKOD berbasis dataset dummy untuk kebutuhan riset "Evaluasi Kritis 25 Tahun Desentralisasi dan Otonomi Daerah di Indonesia (2001-2025)". Data aktual akan menggantikan dataset dummy pada tahap produksi.';
    const split = doc.splitTextToSize(note, pageWidth - margin * 2);
    doc.text(split, margin, y);

    doc.save('IKOD_Laporan_Ringkas.pdf');
    IKOD.toast('File PDF berhasil dibuat dan diunduh.', 'success', 'Export PDF');
  };

  /* -----------------------------------------------------------------------
     PRINT - membangun #printableReport lalu memicu window.print()
     ----------------------------------------------------------------------- */
  exportModule.printReport = function () {
    const el = document.getElementById('printableReport');
    if (!el) return;
    const year = IKOD.filterModule.getSelectedYear();
    const top10 = IKOD.data.province.provinces.slice().sort((a, b) => a.rank - b.rank).slice(0, 10);

    el.innerHTML = `
      <div style="padding:24px;font-family:'Poppins',sans-serif;">
        <h2 style="color:#153B75;">Dashboard IKOD — Laporan Cetak</h2>
        <p style="color:#555;font-size:13px;">Indeks Kinerja Otonomi Daerah &middot; Tahun acuan: ${year} &middot; Dicetak: ${new Date().toLocaleString('id-ID')}</p>
        <hr>
        <h4>Ringkasan Nasional</h4>
        <p>Skor IKOD Nasional: <strong>${IKOD.data.kpi.skor_ikod_nasional}</strong> | Provinsi: ${IKOD.data.kpi.jumlah_provinsi} | Kab/Kota: ${IKOD.data.kpi.jumlah_kabkota} | Dimensi: ${IKOD.data.kpi.jumlah_dimensi} | Indikator: ${IKOD.data.kpi.jumlah_indikator}</p>
        <h4>Peringkat 10 Provinsi Teratas</h4>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#F5F7FA;"><th style="padding:6px;border:1px solid #ddd;">Peringkat</th><th style="padding:6px;border:1px solid #ddd;">Provinsi</th><th style="padding:6px;border:1px solid #ddd;">Skor</th></tr></thead>
          <tbody>
            ${top10.map((p, i) => `<tr><td style="padding:6px;border:1px solid #ddd;">${i + 1}</td><td style="padding:6px;border:1px solid #ddd;">${p.name}</td><td style="padding:6px;border:1px solid #ddd;">${p.skor_ikod.toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    window.print();
  };

  IKOD.exportModule = exportModule;
})(window.IKOD);
