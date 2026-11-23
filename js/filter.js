/* ============================================================================
   FILTER.JS
   Modul Filter Global: Provinsi, Kabupaten/Kota, Tahun, Dimensi, Indikator,
   Search. Semua chart & tabel membaca state filter ini melalui helper
   getFilteredProvinces() / getSelectedYear() dsb, lalu memanggil ulang
   render dari dashboard.js setiap kali filter berubah.
   ============================================================================ */

window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  const filterModule = {};

  /* -----------------------------------------------------------------------
     1. INIT: bangun opsi dropdown dari data yang sudah dimuat app.js
     ----------------------------------------------------------------------- */
  filterModule.init = function () {
    const provinceData = IKOD.data.province;
    const ikodData = IKOD.data.ikod;
    const indikatorData = IKOD.data.indikator;
    const longData = IKOD.data.longitudinal;

    const provSelect = document.getElementById('filterProvinsi');
    const kabSelect = document.getElementById('filterKabupaten');
    const tahunSelect = document.getElementById('filterTahun');
    const dimensiSelect = document.getElementById('filterDimensi');
    const indikatorSelect = document.getElementById('filterIndikator');
    const resetBtn = document.getElementById('btnResetFilter');

    // --- Provinsi ---
    provSelect.innerHTML = '<option value="ALL">Seluruh Provinsi</option>' +
      provinceData.provinces
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => `<option value="${p.id}">${p.name}</option>`)
        .join('');

    // --- Kabupaten/Kota (bergantung provinsi terpilih) ---
    function populateKabupaten(provId) {
      if (provId === 'ALL') {
        kabSelect.innerHTML = '<option value="ALL">Seluruh Kab/Kota</option>';
        kabSelect.disabled = true;
        return;
      }
      const prov = provinceData.provinces.find((p) => p.id === provId);
      kabSelect.disabled = false;
      kabSelect.innerHTML = '<option value="ALL">Seluruh Kab/Kota</option>' +
        prov.kabkota.map((k) => `<option value="${k.id}">${k.name}</option>`).join('');
    }
    populateKabupaten('ALL');

    // --- Tahun (2001-2025) ---
    tahunSelect.innerHTML = longData.meta.years
      .slice()
      .reverse()
      .map((y) => `<option value="${y}">${y}</option>`)
      .join('');
    tahunSelect.value = '2025';

    // --- Dimensi (12) ---
    dimensiSelect.innerHTML = '<option value="ALL">Seluruh Dimensi</option>' +
      ikodData.meta.dimensions.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');

    // --- Indikator (38) ---
    indikatorSelect.innerHTML = '<option value="ALL">Seluruh Indikator</option>' +
      indikatorData.indikator.map((i) => `<option value="${i.id}">${i.name}</option>`).join('');

    // --- Event listeners ---
    provSelect.addEventListener('change', () => {
      IKOD.state.filters.provinsi = provSelect.value;
      IKOD.state.filters.kabupaten = 'ALL';
      populateKabupaten(provSelect.value);
      filterModule.applyFilters();
    });
    kabSelect.addEventListener('change', () => {
      IKOD.state.filters.kabupaten = kabSelect.value;
      filterModule.applyFilters();
    });
    tahunSelect.addEventListener('change', () => {
      IKOD.state.filters.tahun = parseInt(tahunSelect.value, 10);
      filterModule.applyFilters();
    });
    dimensiSelect.addEventListener('change', () => {
      IKOD.state.filters.dimensi = dimensiSelect.value;
      filterModule.applyFilters();
    });
    indikatorSelect.addEventListener('change', () => {
      IKOD.state.filters.indikator = indikatorSelect.value;
      filterModule.applyFilters();
    });
    resetBtn.addEventListener('click', () => filterModule.resetFilters());
  };

  /* -----------------------------------------------------------------------
     2. APPLY / RESET
     ----------------------------------------------------------------------- */
  filterModule.applyFilters = function () {
    IKOD.toast('Filter diterapkan ke seluruh dashboard.', 'info', 'Filter Diperbarui');
    if (IKOD.render && IKOD.render.renderPage) {
      IKOD.render.renderPage(IKOD.state.currentPage, true);
    }
  };

  filterModule.resetFilters = function () {
    IKOD.state.filters = {
      provinsi: 'ALL',
      kabupaten: 'ALL',
      tahun: 2025,
      dimensi: 'ALL',
      indikator: 'ALL',
      search: '',
    };
    document.getElementById('filterProvinsi').value = 'ALL';
    document.getElementById('filterKabupaten').innerHTML = '<option value="ALL">Seluruh Kab/Kota</option>';
    document.getElementById('filterKabupaten').disabled = true;
    document.getElementById('filterTahun').value = '2025';
    document.getElementById('filterDimensi').value = 'ALL';
    document.getElementById('filterIndikator').value = 'ALL';
    const globalSearch = document.getElementById('globalSearchInput');
    if (globalSearch) globalSearch.value = '';

    IKOD.toast('Seluruh filter telah direset ke kondisi awal.', 'success', 'Reset Berhasil');
    if (IKOD.render && IKOD.render.renderPage) {
      IKOD.render.renderPage(IKOD.state.currentPage, true);
    }
  };

  filterModule.setTableSearch = function (q) {
    IKOD.state.table.indikator.search = q;
    IKOD.state.table.indikator.page = 1;
    if (IKOD.render && IKOD.render.renderIndikatorTable) IKOD.render.renderIndikatorTable();
  };

  /* -----------------------------------------------------------------------
     3. HELPER: ambil data yang sudah difilter (dipakai chart.js/dashboard.js)
     ----------------------------------------------------------------------- */

  /** Kembalikan array provinsi (dari province.json) sesuai filter provinsi aktif */
  filterModule.getFilteredProvinces = function () {
    const all = IKOD.data.province.provinces;
    const f = IKOD.state.filters;
    if (f.provinsi === 'ALL') return all;
    return all.filter((p) => p.id === f.provinsi);
  };

  filterModule.getSelectedYear = function () {
    return IKOD.state.filters.tahun || 2025;
  };

  filterModule.getSelectedProvince = function () {
    const f = IKOD.state.filters;
    if (f.provinsi === 'ALL') return null;
    return IKOD.data.province.provinces.find((p) => p.id === f.provinsi) || null;
  };

  filterModule.getSelectedDimension = function () {
    const f = IKOD.state.filters;
    if (f.dimensi === 'ALL') return null;
    return IKOD.data.ikod.meta.dimensions.find((d) => d.id === f.dimensi) || null;
  };

  filterModule.getSelectedIndicator = function () {
    const f = IKOD.state.filters;
    if (f.indikator === 'ALL') return null;
    return IKOD.data.indikator.indikator.find((i) => i.id === f.indikator) || null;
  };

  /** Skor IKOD provinsi pada tahun tertentu (dari longitudinal.json, presisi tinggi) */
  filterModule.getScoreForYear = function (provId, year) {
    const series = IKOD.data.longitudinal.province_series[provId];
    if (!series) return null;
    const found = series.find((s) => s.year === year);
    return found ? found.skor_ikod : null;
  };

  IKOD.filterModule = filterModule;
})(window.IKOD);
