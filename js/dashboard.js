/* ============================================================================
   DASHBOARD.JS
   Orkestrator render seluruh halaman (page-view). Setiap fungsi renderX()
   membaca IKOD.data (JSON dummy) + IKOD.state.filters (filter global) lalu
   menggambar ulang chart/tabel/kartu terkait. Dipanggil oleh app.js (saat
   navigasi menu) dan filter.js (saat filter berubah).
   ============================================================================ */

window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  const render = {};

  /* -----------------------------------------------------------------------
     HELPER UMUM LINTAS HALAMAN
     ----------------------------------------------------------------------- */
  function getDimYear() {
    const year = IKOD.filterModule.getSelectedYear();
    const avail = IKOD.data.ikod.meta.years_available;
    return avail.includes(year) ? year : IKOD.data.ikod.meta.latest_year;
  }

  function dimName(dimId) {
    const d = IKOD.data.ikod.meta.dimensions.find((x) => x.id === dimId);
    return d ? d.name : dimId;
  }

  function getNationalDimensionAverages(year) {
    const y = year || getDimYear();
    return IKOD.data.ikod.meta.dimensions.map((d) => {
      const values = IKOD.data.ikod.data.map((r) => r.dimensi_by_year[String(y)][d.id]);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return Object.assign({}, d, { avg: Math.round(avg * 100) / 100 });
    });
  }

  function getProvinceDimensionValues(provId, year) {
    const y = year || getDimYear();
    const row = IKOD.data.ikod.data.find((r) => r.kode_prov === provId);
    if (!row) return null;
    return IKOD.data.ikod.meta.dimensions.map((d) => Object.assign({}, d, { value: row.dimensi_by_year[String(y)][d.id] }));
  }

  function getContextProvince() {
    return IKOD.filterModule.getSelectedProvince();
  }

  function getNationalScoreForYear(year) {
    const found = IKOD.data.longitudinal.national_series.find((s) => s.year === year);
    return found ? found.skor_ikod : null;
  }

  function rankedProvinces(year) {
    return IKOD.data.province.provinces
      .map((p) => Object.assign({}, p, { yearScore: IKOD.filterModule.getScoreForYear(p.id, year) }))
      .sort((a, b) => b.yearScore - a.yearScore);
  }

  /* -----------------------------------------------------------------------
     1. DASHBOARD UTAMA
     ----------------------------------------------------------------------- */
  function renderDashboard() {
    const year = IKOD.filterModule.getSelectedYear();
    const provCtx = getContextProvince();
    const kpi = IKOD.data.kpi;

    // --- KPI Cards ---
    const kpiConfigs = [
      ['kpiProvinsi', kpi.jumlah_provinsi, 0, ''],
      ['kpiKabkota', kpi.jumlah_kabkota, 0, ''],
      ['kpiDimensi', kpi.jumlah_dimensi, 0, ''],
      ['kpiIndikator', kpi.jumlah_indikator, 0, ''],
      ['kpiDataset', kpi.jumlah_dataset, 0, ''],
      ['kpiCoverage', kpi.coverage_pct, 1, '%'],
      ['kpiDigitalisasi', kpi.progress_digitalisasi_pct, 1, '%'],
    ];
    kpiConfigs.forEach(([id, val, dec, suffix]) => {
      const el = document.getElementById(id);
      if (el) IKOD.animateCounter(el, val, { decimals: dec, suffix });
    });

    const scoreCtxVal = provCtx ? provCtx.yearScore ?? IKOD.filterModule.getScoreForYear(provCtx.id, year) : getNationalScoreForYear(year);
    const scoreLabelEl = document.getElementById('kpiSkorLabel');
    if (scoreLabelEl) scoreLabelEl.textContent = provCtx ? `Skor IKOD ${provCtx.name}` : 'Skor IKOD Nasional';
    const scoreEl = document.getElementById('kpiSkorNasional');
    if (scoreEl) IKOD.animateCounter(scoreEl, scoreCtxVal, { decimals: 2 });

    // --- Gauge ---
    IKOD.chart.gauge('chartGaugeNasional', scoreCtxVal);
    document.getElementById('gaugeValueText').textContent = scoreCtxVal.toFixed(1);
    document.getElementById('gaugeCaptionText').textContent = `${provCtx ? provCtx.name : 'Nasional'} · ${year} · ${IKOD.scoreLabel(scoreCtxVal)}`;

    // --- Ranking Top 5 ---
    const ranked = rankedProvinces(year).slice(0, 5);
    const rankListEl = document.getElementById('dashboardTopRankList');
    rankListEl.innerHTML = ranked.map((p, i) => `
      <div class="rank-list-item">
        <div class="rank-badge-num">${i + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${p.name}</div>
          <div class="rank-sub">${p.pulau_region} &middot; ${p.jumlah_kabkota} Kab/Kota</div>
        </div>
        <div class="rank-score">${p.yearScore.toFixed(1)}</div>
      </div>
    `).join('');

    // --- Radar 12 Dimensi (Nasional vs Provinsi terpilih) ---
    const dimAvg = getNationalDimensionAverages();
    const radarLabels = dimAvg.map((d) => d.short);
    const radarDatasets = [{ label: 'Rata-rata Nasional', data: dimAvg.map((d) => d.avg), color: '#153B75' }];
    if (provCtx) {
      const provDims = getProvinceDimensionValues(provCtx.id);
      radarDatasets.push({ label: provCtx.name, data: provDims.map((d) => d.value), color: '#0D6EFD' });
    }
    IKOD.chart.radar('chartDashboardRadar', radarLabels, radarDatasets);

    // --- Longitudinal mini trend ---
    const years = IKOD.data.longitudinal.meta.years;
    const trendData = provCtx
      ? IKOD.data.longitudinal.province_series[provCtx.id].map((s) => s.skor_ikod)
      : IKOD.data.longitudinal.national_series.map((s) => s.skor_ikod);
    IKOD.chart.areaTrend('chartDashboardTrend', years, provCtx ? `Trend ${provCtx.name}` : 'Trend Nasional', trendData, '#0F766E');

    // --- Distribusi skor per wilayah (pie) ---
    const regionGroups = {};
    IKOD.data.province.provinces.forEach((p) => {
      const s = IKOD.filterModule.getScoreForYear(p.id, year);
      if (!regionGroups[p.pulau_region]) regionGroups[p.pulau_region] = [];
      regionGroups[p.pulau_region].push(s);
    });
    const regionLabels = Object.keys(regionGroups);
    const regionAverages = regionLabels.map((r) => {
      const arr = regionGroups[r];
      return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    });
    IKOD.chart.pie('chartDashboardRegion', regionLabels, regionAverages, { doughnut: true });

    document.getElementById('dashboardContextBadge').textContent = provCtx ? `Konteks: ${provCtx.name}` : 'Konteks: Seluruh Indonesia';
  }

  /* -----------------------------------------------------------------------
     2. EXECUTIVE SUMMARY
     ----------------------------------------------------------------------- */
  function renderExecutive() {
    const year = IKOD.filterModule.getSelectedYear();
    const ranked = rankedProvinces(year);
    const top5 = ranked.slice(0, 5);
    const bottom5 = ranked.slice(-5).reverse();
    const nationalScore = getNationalScoreForYear(year);
    const nationalScore2001 = getNationalScoreForYear(2001);
    const growthNasional = (((nationalScore - nationalScore2001) / nationalScore2001) * 100).toFixed(1);

    document.getElementById('execSkorNasional').textContent = nationalScore.toFixed(2);
    document.getElementById('execGrowthNasional').textContent = `${growthNasional > 0 ? '+' : ''}${growthNasional}%`;
    document.getElementById('execTopProvince').textContent = top5[0].name;
    document.getElementById('execBottomProvince').textContent = bottom5[0].name;

    const dimAvg = getNationalDimensionAverages().sort((a, b) => b.avg - a.avg);
    IKOD.chart.rankingBar('chartExecDimensiBar', dimAvg.map((d) => d.short), dimAvg.map((d) => d.avg), { thickness: 18 });

    const bestDim = dimAvg[0];
    const worstDim = dimAvg[dimAvg.length - 1];

    document.getElementById('execNarrative').innerHTML = `
      <li>Skor IKOD Nasional tahun <strong>${year}</strong> tercatat <strong>${nationalScore.toFixed(2)}</strong>, tumbuh <strong>${growthNasional}%</strong> dibandingkan tahun 2001 (${nationalScore2001.toFixed(2)}).</li>
      <li>Provinsi dengan skor tertinggi adalah <strong>${top5[0].name}</strong> (${top5[0].yearScore.toFixed(1)}), sedangkan skor terendah tercatat pada <strong>${bottom5[0].name}</strong> (${bottom5[0].yearScore.toFixed(1)}).</li>
      <li>Dimensi dengan capaian rata-rata tertinggi secara nasional adalah <strong>${bestDim.name}</strong> (${bestDim.avg}), sedangkan yang paling memerlukan perhatian adalah <strong>${worstDim.name}</strong> (${worstDim.avg}).</li>
      <li>Kesenjangan antarwilayah masih signifikan, dengan selisih skor antara provinsi tertinggi dan terendah mencapai <strong>${(top5[0].yearScore - bottom5[0].yearScore).toFixed(1)} poin</strong>, mengindikasikan tantangan keadilan wilayah yang berkelanjutan.</li>
    `;

    const tableEl = document.getElementById('execTopBottomTable');
    tableEl.innerHTML = `
      <tr><th colspan="2" class="text-success">TOP 5 PROVINSI</th><th colspan="2" class="text-danger">BOTTOM 5 PROVINSI</th></tr>
      ${top5.map((p, i) => `
        <tr>
          <td>${p.name}</td><td class="fw-700">${p.yearScore.toFixed(1)}</td>
          <td>${bottom5[i].name}</td><td class="fw-700">${bottom5[i].yearScore.toFixed(1)}</td>
        </tr>`).join('')}
    `;
  }

  /* -----------------------------------------------------------------------
     3. LONGITUDINAL
     ----------------------------------------------------------------------- */
  function renderLongitudinal(isUpdate) {
    const years = IKOD.data.longitudinal.meta.years;
    const slider = document.getElementById('yearSlider');
    const provCtx = getContextProvince();

    if (!slider.dataset.bound) {
      slider.min = years[0];
      slider.max = years[years.length - 1];
      slider.value = IKOD.filterModule.getSelectedYear();
      slider.dataset.bound = '1';
      slider.addEventListener('input', () => {
        document.getElementById('yearSliderValue').textContent = slider.value;
        document.getElementById('filterTahun').value = slider.value;
        IKOD.state.filters.tahun = parseInt(slider.value, 10);
        renderLongitudinal(true);
        if (IKOD.state.map) IKOD.mapModule.renderChoropleth();
      });
    }
    slider.value = IKOD.filterModule.getSelectedYear();
    document.getElementById('yearSliderValue').textContent = slider.value;

    const selectedYear = parseInt(slider.value, 10);
    const yearIndex = years.indexOf(selectedYear);

    // Line chart nasional dengan highlight titik tahun terpilih
    const nationalScores = IKOD.data.longitudinal.national_series.map((s) => s.skor_ikod);
    const chart = IKOD.chart.lineTrend('chartLongNasional', years, [{ label: 'Trend Nasional', data: nationalScores, color: '#153B75' }]);
    if (chart) {
      chart.data.datasets[0].pointRadius = years.map((y, i) => (i === yearIndex ? 6 : 0));
      chart.data.datasets[0].pointBackgroundColor = '#0D6EFD';
      chart.update();
    }

    // Area chart + comparison provinsi vs nasional
    const compareLabel = provCtx ? provCtx.name : 'Nasional';
    const provinceScores = provCtx ? IKOD.data.longitudinal.province_series[provCtx.id].map((s) => s.skor_ikod) : nationalScores;
    const datasets = [{ label: 'Trend Nasional', data: nationalScores, color: '#94A3B8', fill: false }];
    if (provCtx) datasets.push({ label: `Trend ${provCtx.name}`, data: provinceScores, color: '#0F766E', fill: true });
    else datasets[0] = { label: 'Trend Nasional', data: nationalScores, color: '#0F766E', fill: true };
    IKOD.chart.lineTrend('chartLongCompare', years, datasets);

    // Growth comparison (top gainer & loser)
    const growth = IKOD.data.longitudinal.growth.slice().sort((a, b) => b.growth_pct - a.growth_pct);
    const topGain = growth.slice(0, 6);
    const topLoss = growth.slice(-6).reverse();
    const combined = topGain.concat(topLoss);
    IKOD.chart.verticalBar('chartLongGrowth', combined.map((g) => g.name), combined.map((g) => g.growth_pct), { label: 'Pertumbuhan Skor 2001-2025 (%)' });

    // Info panel tahun terpilih
    document.getElementById('longYearInfo').innerHTML = `
      Skor ${compareLabel} pada tahun <strong>${selectedYear}</strong>:
      <span class="fs-24 fw-700 text-primary-brand ms-1">${(provCtx ? provinceScores[yearIndex] : nationalScores[yearIndex]).toFixed(2)}</span>
    `;
  }

  /* -----------------------------------------------------------------------
     4. PETA
     ----------------------------------------------------------------------- */
  function renderPeta() {
    if (!IKOD.state.map) {
      IKOD.mapModule.init();
    } else {
      IKOD.mapModule.renderChoropleth();
      IKOD.mapModule.renderProvinceList();
    }
    const searchInput = document.getElementById('provinceListSearchInput');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = '1';
      searchInput.addEventListener('input', () => IKOD.mapModule.searchProvinceList(searchInput.value));
    }
    document.getElementById('mapYearLabel').textContent = IKOD.filterModule.getSelectedYear();
  }

  /* -----------------------------------------------------------------------
     5. 12 DIMENSI IKOD
     ----------------------------------------------------------------------- */
  function renderDimensi() {
    const year = getDimYear();
    const provCtx = getContextProvince();
    const dimFilter = IKOD.state.filters.dimensi;

    const dimAvg = getNationalDimensionAverages(year);

    // Radar
    const radarDatasets = [{ label: 'Rata-rata Nasional', data: dimAvg.map((d) => d.avg), color: '#153B75' }];
    if (provCtx) {
      const provDims = getProvinceDimensionValues(provCtx.id, year);
      radarDatasets.push({ label: provCtx.name, data: provDims.map((d) => d.value), color: '#0D6EFD' });
    }
    IKOD.chart.radar('chartDimensiRadar', dimAvg.map((d) => d.short), radarDatasets);

    // Progress list 12 dimensi (nasional), diurutkan menurun
    const sortedDims = dimAvg.slice().sort((a, b) => b.avg - a.avg);
    const progressList = document.getElementById('dimensiProgressList');
    progressList.innerHTML = sortedDims.map((d) => `
      <div class="dim-progress-item cursor-pointer" data-dim="${d.id}">
        <div class="dim-progress-head">
          <span class="dim-name"><i class="fa-solid ${d.icon} fs-13"></i>${d.name}</span>
          <span class="dim-value">${d.avg}</span>
        </div>
        <div class="dim-bar"><span style="width:${d.avg}%;background:${IKOD.scoreColor(d.avg)}"></span></div>
      </div>
    `).join('');
    progressList.querySelectorAll('.dim-progress-item').forEach((item) => {
      item.addEventListener('click', () => {
        document.getElementById('filterDimensi').value = item.dataset.dim;
        IKOD.state.filters.dimensi = item.dataset.dim;
        renderDimensi();
      });
    });

    // Bar ranking: jika dimensi spesifik dipilih -> ranking 38 provinsi utk dimensi itu
    // jika tidak -> tampilkan rata2 nasional 12 dimensi
    let barLabels, barValues, barTitle;
    if (dimFilter !== 'ALL') {
      const dim = IKOD.data.ikod.meta.dimensions.find((d) => d.id === dimFilter);
      const rows = IKOD.data.ikod.data.map((r) => ({ name: r.name, value: r.dimensi_by_year[String(year)][dimFilter] }))
        .sort((a, b) => b.value - a.value).slice(0, 15);
      barLabels = rows.map((r) => r.name);
      barValues = rows.map((r) => r.value);
      barTitle = `Ranking 15 Provinsi Teratas — ${dim.name}`;
    } else {
      barLabels = dimAvg.map((d) => d.short);
      barValues = dimAvg.map((d) => d.avg);
      barTitle = 'Rata-rata Nasional per Dimensi';
    }
    document.getElementById('dimensiBarTitle').textContent = barTitle;
    IKOD.chart.rankingBar('chartDimensiBar', barLabels, barValues, { thickness: 14 });

    // Tabel ranking (skor total IKOD atau skor dimensi terpilih)
    const rankRows = (dimFilter !== 'ALL'
      ? IKOD.data.ikod.data.map((r) => ({ name: r.name, value: r.dimensi_by_year[String(year)][dimFilter] }))
      : IKOD.data.ikod.data.map((r) => ({ name: r.name, value: r.skor_ikod }))
    ).sort((a, b) => b.value - a.value);

    const tbody = document.getElementById('dimensiRankTableBody');
    tbody.innerHTML = rankRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.name}</td>
        <td class="fw-700">${r.value.toFixed(1)}</td>
        <td><div class="mini-progress"><span style="width:${r.value}%;background:${IKOD.scoreColor(r.value)}"></span></div></td>
      </tr>
    `).join('');
  }

  /* -----------------------------------------------------------------------
     6. INDIKATOR (data table)
     ----------------------------------------------------------------------- */
  render.getFilteredIndikatorRows = function () {
    const f = IKOD.state.filters;
    const t = IKOD.state.table.indikator;
    let rows = IKOD.data.indikator.indikator.slice();

    if (f.dimensi !== 'ALL') rows = rows.filter((r) => r.dimensi_id === f.dimensi);
    if (f.indikator !== 'ALL') rows = rows.filter((r) => r.id === f.indikator);
    if (t.search) {
      const q = t.search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }

    rows = rows.map((r) => {
      const value = f.provinsi !== 'ALL' ? r.values_by_province[f.provinsi] : r.national_avg;
      return Object.assign({}, r, { value, dimensiName: dimName(r.dimensi_id) });
    });

    rows.sort((a, b) => {
      let av = a[t.sortKey];
      let bv = b[t.sortKey];
      if (t.sortKey === 'dimensi_id') { av = a.dimensiName; bv = b.dimensiName; }
      if (typeof av === 'string') {
        return t.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return t.sortDir === 'asc' ? av - bv : bv - av;
    });

    return rows;
  };

  function renderIndikator() {
    const searchInput = document.getElementById('indikatorSearchInput');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = '1';
      searchInput.value = IKOD.state.table.indikator.search;
      searchInput.addEventListener('input', () => {
        IKOD.state.table.indikator.search = searchInput.value;
        IKOD.state.table.indikator.page = 1;
        renderIndikatorTable();
      });
    }
    document.querySelectorAll('#indikatorTable thead th[data-sort]').forEach((th) => {
      if (th.dataset.bound) return;
      th.dataset.bound = '1';
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const t = IKOD.state.table.indikator;
        if (t.sortKey === key) t.sortDir = t.sortDir === 'asc' ? 'desc' : 'asc';
        else { t.sortKey = key; t.sortDir = 'asc'; }
        renderIndikatorTable();
      });
    });
    document.getElementById('btnExportCSV')?.addEventListener('click', () => IKOD.exportModule.exportIndikatorCSV(), { once: false });
    renderIndikatorTable();
  }

  function renderIndikatorTable() {
    const rows = render.getFilteredIndikatorRows();
    const t = IKOD.state.table.indikator;
    const totalPages = Math.max(1, Math.ceil(rows.length / t.pageSize));
    t.page = Math.min(t.page, totalPages);
    const start = (t.page - 1) * t.pageSize;
    const pageRows = rows.slice(start, start + t.pageSize);

    const provCtx = getContextProvince();
    document.getElementById('indikatorValueHeader').textContent = provCtx ? `Nilai (${provCtx.name})` : 'Rata-rata Nasional';

    const tbody = document.getElementById('indikatorTableBody');
    tbody.innerHTML = pageRows.length ? pageRows.map((r) => `
      <tr>
        <td><span class="ikod-badge badge-info">${r.id}</span></td>
        <td class="fw-600">${r.name}</td>
        <td><span class="ikod-badge badge-teal">${r.dimensiName}</span></td>
        <td>${r.unit}</td>
        <td class="fs-12 text-secondary-ikod">${r.source}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="mini-progress" style="width:70px"><span style="width:${Math.min(100, r.value)}%;background:${IKOD.scoreColor(r.value)}"></span></div>
            <span class="fw-700">${r.value.toFixed(1)}</span>
          </div>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-inbox"></i>Tidak ada data indikator yang sesuai filter.</div></td></tr>`;

    document.getElementById('indikatorResultInfo').textContent = `Menampilkan ${pageRows.length ? start + 1 : 0}–${start + pageRows.length} dari ${rows.length} indikator`;

    const pager = document.getElementById('indikatorPager');
    let pagerHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      pagerHtml += `<button class="btn btn-sm ${p === t.page ? 'btn-ikod-primary' : 'btn-ikod-outline'}" data-page="${p}">${p}</button>`;
    }
    pager.innerHTML = pagerHtml;
    pager.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        t.page = parseInt(btn.dataset.page, 10);
        renderIndikatorTable();
      });
    });
  }
  render.renderIndikatorTable = renderIndikatorTable;

  /* -----------------------------------------------------------------------
     7. ANALYTICS
     ----------------------------------------------------------------------- */
  function renderAnalytics() {
    const year = IKOD.filterModule.getSelectedYear();
    const provinces = IKOD.data.province.provinces;
    const scores = provinces.map((p) => IKOD.filterModule.getScoreForYear(p.id, year));

    // Pie: kategori skor
    const cats = { 'Sangat Baik (≥75)': 0, 'Baik (60-74,9)': 0, 'Cukup (45-59,9)': 0, 'Perlu Perhatian (<45)': 0 };
    scores.forEach((s) => {
      if (s >= 75) cats['Sangat Baik (≥75)']++;
      else if (s >= 60) cats['Baik (60-74,9)']++;
      else if (s >= 45) cats['Cukup (45-59,9)']++;
      else cats['Perlu Perhatian (<45)']++;
    });
    IKOD.chart.pie('chartAnalyticsPie', Object.keys(cats), Object.values(cats));

    // Radar: Top-3 vs Bottom-3 rata-rata dimensi
    const dimYear = getDimYear();
    const ranked = rankedProvinces(year);
    const top3 = ranked.slice(0, 3).map((p) => p.id);
    const bottom3 = ranked.slice(-3).map((p) => p.id);
    const dims = IKOD.data.ikod.meta.dimensions;
    const avgFor = (ids) => dims.map((d) => {
      const vals = ids.map((id) => IKOD.data.ikod.data.find((r) => r.kode_prov === id).dimensi_by_year[String(dimYear)][d.id]);
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    });
    IKOD.chart.radar('chartAnalyticsRadar', dims.map((d) => d.short), [
      { label: 'Top-3 Provinsi', data: avgFor(top3), color: '#16A34A' },
      { label: 'Bottom-3 Provinsi', data: avgFor(bottom3), color: '#DC2626' },
    ]);

    // Heatmap provinsi x dimensi (semua 38 provinsi, scrollable)
    const heatmapEl = document.getElementById('heatmapContainer');
    const sortedForHeatmap = ranked;
    heatmapEl.innerHTML = `
      <table class="heatmap-table">
        <thead><tr><th class="row-head-th">Provinsi</th>${dims.map((d) => `<th>${d.short}</th>`).join('')}</tr></thead>
        <tbody>
          ${sortedForHeatmap.map((p) => {
            const row = IKOD.data.ikod.data.find((r) => r.kode_prov === p.id);
            return `<tr><td class="heatmap-row-label">${p.name}</td>${dims.map((d) => {
              const v = row.dimensi_by_year[String(dimYear)][d.id];
              return `<td><div class="heatmap-cell" style="background:${IKOD.scoreColor(v)}" title="${d.name}: ${v}">${v.toFixed(0)}</div></td>`;
            }).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    // Histogram distribusi skor
    IKOD.chart.histogram('chartAnalyticsHistogram', scores);

    // Scatter: PAD Ratio (I04) vs IPM (I28)
    const indI04 = IKOD.data.indikator.indikator.find((i) => i.id === 'I04');
    const indI28 = IKOD.data.indikator.indikator.find((i) => i.id === 'I28');
    const points = provinces.map((p) => ({ x: indI04.values_by_province[p.id], y: indI28.values_by_province[p.id], name: p.name }));
    IKOD.chart.scatter('chartAnalyticsScatter', points, { xLabel: 'Rasio PAD terhadap APBD', yLabel: 'Indeks Pembangunan Manusia' });

    // Bar: rata-rata skor per region/pulau
    const regionGroups = {};
    provinces.forEach((p, i) => {
      if (!regionGroups[p.pulau_region]) regionGroups[p.pulau_region] = [];
      regionGroups[p.pulau_region].push(scores[i]);
    });
    const regionLabels = Object.keys(regionGroups);
    const regionAvg = regionLabels.map((r) => Math.round((regionGroups[r].reduce((a, b) => a + b, 0) / regionGroups[r].length) * 10) / 10);
    IKOD.chart.verticalBar('chartAnalyticsBarRegion', regionLabels, regionAvg, { label: 'Rata-rata Skor per Region', colors: regionLabels.map(() => '#0D6EFD') });

    // Line: trend nasional 2001-2025
    const years = IKOD.data.longitudinal.meta.years;
    IKOD.chart.lineTrend('chartAnalyticsLine', years, [{ label: 'Trend Nasional', data: IKOD.data.longitudinal.national_series.map((s) => s.skor_ikod), color: '#153B75' }]);
  }

  /* -----------------------------------------------------------------------
     8. LAPORAN
     ----------------------------------------------------------------------- */
  function renderLaporan() {
    const year = IKOD.filterModule.getSelectedYear();
    document.getElementById('laporanYearLabel').textContent = year;
    document.getElementById('laporanSkorNasional').textContent = getNationalScoreForYear(year).toFixed(2);

    const top10 = rankedProvinces(year).slice(0, 10);
    document.getElementById('laporanPreviewTable').innerHTML = top10.map((p, i) => `
      <tr><td>${i + 1}</td><td>${p.name}</td><td class="fw-700">${p.yearScore.toFixed(2)}</td></tr>
    `).join('');

    if (!document.getElementById('btnExportPDF').dataset.bound) {
      document.getElementById('btnExportPDF').dataset.bound = '1';
      document.getElementById('btnExportPDF').addEventListener('click', () => IKOD.exportModule.exportPDF());
      document.getElementById('btnExportExcel').addEventListener('click', () => IKOD.exportModule.exportExcel());
      document.getElementById('btnPrintReport').addEventListener('click', () => IKOD.exportModule.printReport());
    }
  }

  /* -----------------------------------------------------------------------
     9. TENTANG & SETTINGS (statis, binding sekali saja)
     ----------------------------------------------------------------------- */
  function renderTentang() { /* konten statis sudah ada di index.html */ }

  function renderSettings() {
    const btnClearCache = document.getElementById('btnClearCache');
    if (btnClearCache && !btnClearCache.dataset.bound) {
      btnClearCache.dataset.bound = '1';
      btnClearCache.addEventListener('click', () => {
        localStorage.removeItem('ikod_sidebar_collapsed');
        IKOD.toast('Cache preferensi lokal berhasil dibersihkan.', 'success');
      });
    }
    const btnResetAll = document.getElementById('btnSettingsResetFilter');
    if (btnResetAll && !btnResetAll.dataset.bound) {
      btnResetAll.dataset.bound = '1';
      btnResetAll.addEventListener('click', () => IKOD.filterModule.resetFilters());
    }
  }

  /* -----------------------------------------------------------------------
     DISPATCHER UTAMA
     ----------------------------------------------------------------------- */
  const pageRenderers = {
    dashboard: renderDashboard,
    executive: renderExecutive,
    longitudinal: renderLongitudinal,
    peta: renderPeta,
    dimensi: renderDimensi,
    indikator: renderIndikator,
    metadata: () => IKOD.metaModule.renderMetadataPage(),
    quality: () => IKOD.metaModule.renderQualityPage(),
    analytics: renderAnalytics,
    laporan: renderLaporan,
    tentang: renderTentang,
    settings: renderSettings,
  };

  render.renderPage = function (page, isFilterUpdate) {
    const fn = pageRenderers[page];
    if (fn) fn(isFilterUpdate);
  };

  IKOD.render = render;
})(window.IKOD);
