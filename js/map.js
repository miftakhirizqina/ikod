/* ============================================================================
   MAP.JS
   Modul Peta Interaktif (Leaflet + GeoJSON 38 Provinsi Indonesia).
   Menampilkan choropleth skor IKOD, tooltip hover, popup klik (skor, trend,
   metadata singkat), legend klasifikasi warna, dan integrasi dengan filter
   tahun global.
   ============================================================================ */

window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  const mapModule = {};
  let geojsonLayer = null;
  let geojsonData = null;

  const BREAKS = [
    { min: 75, max: 101, color: '#16A34A', label: '≥ 75 (Sangat Baik)' },
    { min: 60, max: 75, color: '#0D6EFD', label: '60 – 74,9 (Baik)' },
    { min: 45, max: 60, color: '#F59E0B', label: '45 – 59,9 (Cukup)' },
    { min: 0, max: 45, color: '#DC2626', label: '< 45 (Perlu Perhatian)' },
  ];

  function colorForScore(score) {
    const found = BREAKS.find((b) => score >= b.min && score < b.max);
    return found ? found.color : '#94A3B8';
  }

  /** Cari data provinsi (province.json) berdasarkan nama dari properti geojson */
  function findProvinceByGeoName(geoName) {
    const provinces = IKOD.data.province.provinces;
    // Normalisasi sederhana untuk mencocokkan variasi penulisan nama provinsi
    const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    return provinces.find((p) => norm(p.name) === norm(geoName));
  }

  async function loadGeoJSON() {
    if (geojsonData) return geojsonData;
    const res = await fetch('geojson/indonesia.geojson', { cache: 'no-store' });
    geojsonData = await res.json();
    return geojsonData;
  }

  /* -----------------------------------------------------------------------
     INIT MAP (dipanggil sekali saat halaman Peta pertama kali dibuka)
     ----------------------------------------------------------------------- */
  mapModule.init = async function () {
    if (IKOD.state.map) return; // sudah pernah di-init

    const map = L.map('mapContainer', {
      zoomControl: true,
      minZoom: 4,
      maxZoom: 9,
      scrollWheelZoom: true,
    }).setView([-2.3, 117.8], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    IKOD.state.map = map;

    await loadGeoJSON();
    mapModule.renderChoropleth();
    mapModule.renderLegend();
    mapModule.renderProvinceList();

    setTimeout(() => map.invalidateSize(), 250);
  };

  /* -----------------------------------------------------------------------
     RENDER CHOROPLETH (dipanggil ulang tiap filter tahun berubah)
     ----------------------------------------------------------------------- */
  mapModule.renderChoropleth = function () {
    if (!IKOD.state.map || !geojsonData) return;
    const year = IKOD.filterModule.getSelectedYear();

    if (geojsonLayer) {
      IKOD.state.map.removeLayer(geojsonLayer);
    }

    geojsonLayer = L.geoJSON(geojsonData, {
      style: (feature) => {
        const prov = findProvinceByGeoName(feature.properties.PROVINSI);
        const score = prov ? IKOD.filterModule.getScoreForYear(prov.id, year) : null;
        return {
          fillColor: score !== null ? colorForScore(score) : '#CBD5E1',
          weight: 1,
          color: '#ffffff',
          fillOpacity: 0.82,
        };
      },
      onEachFeature: (feature, layer) => {
        const prov = findProvinceByGeoName(feature.properties.PROVINSI);
        const geoName = feature.properties.PROVINSI;

        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2.5, color: '#153B75', fillOpacity: 0.95 });
            e.target.bringToFront();
          },
          mouseout: (e) => geojsonLayer.resetStyle(e.target),
          click: () => mapModule.openProvincePopup(prov, layer, geoName),
        });

        if (prov) {
          const score = IKOD.filterModule.getScoreForYear(prov.id, year);
          layer.bindTooltip(`<strong>${prov.name}</strong><br>Skor IKOD ${year}: ${score !== null ? score.toFixed(1) : '-'}`, { sticky: true });
        } else {
          layer.bindTooltip(geoName, { sticky: true });
        }
      },
    }).addTo(IKOD.state.map);
  };

  /* -----------------------------------------------------------------------
     POPUP DETAIL PROVINSI (skor, trend, metadata ringkas, indikator utama)
     ----------------------------------------------------------------------- */
  mapModule.openProvincePopup = function (prov, layer, geoName) {
    const year = IKOD.filterModule.getSelectedYear();
    if (!prov) {
      layer.bindPopup(`<div class="map-popup-title">${geoName}</div><p class="fs-12 mb-0">Data belum tersedia untuk wilayah ini.</p>`).openPopup();
      return;
    }
    const score = IKOD.filterModule.getScoreForYear(prov.id, year);
    const trendArrow = prov.trend >= 0 ? 'fa-arrow-trend-up text-success' : 'fa-arrow-trend-down text-danger';
    const ikodRow = IKOD.data.ikod.data.find((d) => d.kode_prov === prov.id);
    const topDims = ikodRow
      ? Object.entries(ikodRow.dimensi_latest)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([dimId, val]) => {
            const dim = IKOD.data.ikod.meta.dimensions.find((d) => d.id === dimId);
            return `<div class="map-popup-row"><span>${dim.short}</span><strong>${val.toFixed(1)}</strong></div>`;
          })
          .join('')
      : '';

    const html = `
      <div style="min-width:220px">
        <div class="map-popup-title">${prov.name}</div>
        <div class="fs-12 text-secondary-ikod mb-1">Ibu kota: ${prov.ibukota} &middot; ${prov.jumlah_kabkota} Kab/Kota</div>
        <div class="d-flex align-items-baseline gap-2">
          <span class="map-popup-score">${score !== null ? score.toFixed(1) : '-'}</span>
          <span class="fs-12"><i class="fa-solid ${trendArrow}"></i> ${Math.abs(prov.trend)} poin</span>
        </div>
        <div class="fs-11 text-muted-ikod mt-1">Peringkat Nasional #${prov.rank} · Tahun ${year}</div>
        <hr class="my-2">
        <div class="fs-11 fw-600 mb-1">Dimensi Unggulan</div>
        ${topDims}
        <button class="btn btn-ikod-accent btn-sm w-100 mt-2" onclick="IKOD.mapModule.goToProvinceDetail('${prov.id}')">
          Lihat Detail Dimensi <i class="fa-solid fa-arrow-right ms-1"></i>
        </button>
      </div>
    `;
    layer.bindPopup(html, { maxWidth: 280 }).openPopup();
  };

  mapModule.goToProvinceDetail = function (provId) {
    document.getElementById('filterProvinsi').value = provId;
    IKOD.state.filters.provinsi = provId;
    IKOD.state.filters.kabupaten = 'ALL';
    IKOD.navigateTo('dimensi');
    if (IKOD.render && IKOD.render.renderPage) IKOD.render.renderPage('dimensi', true);
  };

  /* -----------------------------------------------------------------------
     LEGEND
     ----------------------------------------------------------------------- */
  mapModule.renderLegend = function () {
    const el = document.getElementById('mapLegendBox');
    if (!el) return;
    el.innerHTML = `
      <div class="uppercase-label mb-2">Klasifikasi Skor IKOD</div>
      ${BREAKS.map((b) => `
        <div class="legend-row">
          <span class="legend-swatch" style="background:${b.color}"></span>
          <span>${b.label}</span>
        </div>`).join('')}
    `;
  };

  /* -----------------------------------------------------------------------
     DAFTAR PROVINSI (sidebar kanan peta) - klik untuk fokus & buka popup
     ----------------------------------------------------------------------- */
  mapModule.renderProvinceList = function (searchTerm = '') {
    const el = document.getElementById('provinceSearchList');
    if (!el) return;
    const year = IKOD.filterModule.getSelectedYear();
    const list = IKOD.data.province.provinces
      .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.rank - b.rank);

    el.innerHTML = list.map((p) => {
      const score = IKOD.filterModule.getScoreForYear(p.id, year);
      return `
        <div class="province-list-item" data-prov="${p.id}">
          <span>#${p.rank} ${p.name}</span>
          <span class="ikod-badge" style="background:${IKOD.scoreColor(score)}22;color:${IKOD.scoreColor(score)}">${score.toFixed(1)}</span>
        </div>`;
    }).join('') || '<div class="empty-state fs-12">Provinsi tidak ditemukan</div>';

    el.querySelectorAll('.province-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        const provId = item.dataset.prov;
        const prov = IKOD.data.province.provinces.find((p) => p.id === provId);
        IKOD.state.map.flyTo([prov.lat, prov.lon], 6.2, { duration: 0.8 });
        geojsonLayer.eachLayer((layer) => {
          if (findProvinceByGeoName(layer.feature.properties.PROVINSI)?.id === provId) {
            setTimeout(() => mapModule.openProvincePopup(prov, layer, prov.name), 850);
          }
        });
        el.querySelectorAll('.province-list-item').forEach((i) => i.classList.remove('active-item'));
        item.classList.add('active-item');
      });
    });
  };

  mapModule.searchProvinceList = function (term) {
    mapModule.renderProvinceList(term);
  };

  mapModule.refreshTheme = function () {
    // Tile layer CARTO light tetap dipakai; hanya popup/legend re-render bila perlu
  };

  IKOD.mapModule = mapModule;
})(window.IKOD);
