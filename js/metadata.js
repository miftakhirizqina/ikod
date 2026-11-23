/* ============================================================================
   METADATA.JS
   Render halaman "Metadata" (definisi, formula, sumber data tiap indikator)
   dan halaman "Data Quality" (completeness, consistency, availability,
   accuracy, timeliness).
   ============================================================================ */

window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  const metaModule = {};

  /* -----------------------------------------------------------------------
     HALAMAN METADATA
     ----------------------------------------------------------------------- */
  metaModule.renderMetadataPage = function () {
    const container = document.getElementById('metadataAccordionList');
    if (!container) return;
    const searchInput = document.getElementById('metadataSearchInput');
    const searchTerm = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase();

    const dimFilter = IKOD.state.filters.dimensi;
    let list = IKOD.data.metadata.metadata;
    if (dimFilter !== 'ALL') list = list.filter((m) => m.dimensi_id === dimFilter);
    if (searchTerm) {
      list = list.filter((m) => m.nama_indikator.toLowerCase().includes(searchTerm) || m.dimensi.toLowerCase().includes(searchTerm));
    }

    if (!list.length) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i>Tidak ada metadata yang cocok dengan pencarian.</div>`;
      return;
    }

    container.innerHTML = list.map((m, idx) => `
      <div class="metadata-item" id="metaItem-${m.id}">
        <div class="metadata-item-head" data-target="${m.id}">
          <div class="meta-title"><span class="ikod-badge badge-info me-2">${m.id}</span>${m.nama_indikator}</div>
          <span class="fs-11 text-muted-ikod me-3">${m.dimensi}</span>
          <i class="fa-solid fa-chevron-down meta-chev"></i>
        </div>
        <div class="metadata-item-body">
          <div class="metadata-item-body-inner">
            <div class="meta-field-full">
              <div class="meta-field-label">Definisi</div>
              <div>${m.definisi}</div>
            </div>
            <div>
              <div class="meta-field-label">Formula / Cara Hitung</div>
              <div>${m.formula}</div>
            </div>
            <div>
              <div class="meta-field-label">Satuan</div>
              <div>${m.satuan}</div>
            </div>
            <div>
              <div class="meta-field-label">Sumber Data</div>
              <div>${m.sumber_data}</div>
            </div>
            <div>
              <div class="meta-field-label">Frekuensi Update</div>
              <div>${m.frekuensi}</div>
            </div>
            <div class="meta-field-full">
              <div class="meta-field-label">Instansi Penanggung Jawab</div>
              <div>${m.instansi_penanggungjawab}</div>
            </div>
            <div class="meta-field-full">
              <div class="meta-field-label">Catatan</div>
              <div>${m.catatan}</div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.metadata-item-head').forEach((head) => {
      head.addEventListener('click', () => {
        head.closest('.metadata-item').classList.toggle('open');
      });
    });

    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = '1';
      searchInput.addEventListener('input', () => metaModule.renderMetadataPage());
    }
  };

  /* -----------------------------------------------------------------------
     HALAMAN DATA QUALITY
     ----------------------------------------------------------------------- */
  metaModule.renderQualityPage = function () {
    const tbody = document.getElementById('qualityTableBody');
    if (!tbody) return;
    const list = IKOD.data.metadata.data_quality;

    tbody.innerHTML = list.map((q) => `
      <tr>
        <td class="fw-600">${q.id}</td>
        <td>${q.name}</td>
        <td>${qualityBarCell(q.completeness)}</td>
        <td>${qualityBarCell(q.consistency)}</td>
        <td>${qualityBarCell(q.availability)}</td>
        <td>${qualityBarCell(q.accuracy)}</td>
        <td>${qualityBarCell(q.timeliness)}</td>
      </tr>
    `).join('');

    // Rata-rata nasional per dimensi kualitas data -> ringkasan progress di atas tabel
    const avg = (key) => (list.reduce((sum, q) => sum + q[key], 0) / list.length).toFixed(1);
    const metrics = [
      { key: 'completeness', label: 'Completeness', icon: 'fa-database' },
      { key: 'consistency', label: 'Consistency', icon: 'fa-shuffle' },
      { key: 'availability', label: 'Availability', icon: 'fa-server' },
      { key: 'accuracy', label: 'Accuracy', icon: 'fa-bullseye' },
      { key: 'timeliness', label: 'Timeliness', icon: 'fa-clock' },
    ];
    const summaryEl = document.getElementById('qualitySummaryRow');
    if (summaryEl) {
      summaryEl.innerHTML = metrics.map((m) => {
        const val = avg(m.key);
        return `
          <div class="col-md-4 col-lg">
            <div class="ikod-card no-hover">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fa-solid ${m.icon} text-accent"></i>
                <span class="fs-13 fw-600">${m.label}</span>
              </div>
              <div class="quality-metric-row mb-0">
                <div class="q-bar mini-progress"><span style="width:${val}%;background:${IKOD.scoreColor(val)}"></span></div>
                <div class="q-val">${val}%</div>
              </div>
            </div>
          </div>`;
      }).join('');
    }
  };

  function qualityBarCell(val) {
    return `
      <div class="quality-metric-row mb-0">
        <div class="q-bar mini-progress"><span style="width:${val}%;background:${IKOD.scoreColor(val)}"></span></div>
        <div class="q-val">${val}%</div>
      </div>`;
  }

  IKOD.metaModule = metaModule;
})(window.IKOD);
