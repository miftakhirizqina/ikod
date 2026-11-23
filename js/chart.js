/* ============================================================================
   CHART.JS (modul wrapper, bukan library Chart.js itu sendiri)
   Kumpulan fungsi reusable untuk membangun/memperbarui chart Chart.js
   berdasarkan data JSON yang sudah difilter. Tidak ada angka hardcode -
   seluruh nilai chart diteruskan sebagai parameter dari dashboard.js.
   ============================================================================ */

window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  const chartModule = {};

  /** Ambil nilai CSS variable saat ini (menyesuaikan dark/light mode) */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  chartModule.palette = () => [
    cssVar('--chart-color-1'), cssVar('--chart-color-2'), cssVar('--chart-color-3'),
    cssVar('--chart-color-4'), cssVar('--chart-color-5'), cssVar('--chart-color-6'),
    cssVar('--chart-color-7'), cssVar('--chart-color-8'),
  ];

  Chart.defaults.font.family = "'Poppins', sans-serif";
  Chart.defaults.font.size = 11.5;

  /* -----------------------------------------------------------------------
     CORE: buat / update chart pada canvas tertentu (menghindari duplikasi
     instance & memory-leak Chart.js jika dipanggil berulang)
     ----------------------------------------------------------------------- */
  chartModule.render = function (canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (IKOD.state.charts[canvasId]) {
      IKOD.state.charts[canvasId].destroy();
    }
    const textColor = cssVar('--color-text-secondary');
    const gridColor = cssVar('--color-border');
    config.options = config.options || {};
    config.options.plugins = config.options.plugins || {};
    if (config.options.scales) {
      Object.values(config.options.scales).forEach((scale) => {
        scale.ticks = Object.assign({ color: textColor }, scale.ticks || {});
        if (scale.grid !== false) scale.grid = Object.assign({ color: gridColor }, scale.grid || {});
        if (scale.angleLines) scale.angleLines.color = gridColor;
        if (scale.pointLabels) scale.pointLabels.color = textColor;
      });
    }
    const chart = new Chart(canvas.getContext('2d'), config);
    IKOD.state.charts[canvasId] = chart;
    return chart;
  };

  chartModule.resizeAll = function () {
    Object.values(IKOD.state.charts).forEach((c) => c && c.resize());
  };

  /** Dipanggil setelah dark-mode di-toggle: re-render halaman aktif */
  chartModule.refreshTheme = function () {
    if (IKOD.render && IKOD.render.renderPage) {
      IKOD.render.renderPage(IKOD.state.currentPage, true);
    }
    if (IKOD.mapModule) IKOD.mapModule.refreshTheme();
  };

  /* -----------------------------------------------------------------------
     BUILDERS SPESIFIK
     ----------------------------------------------------------------------- */

  /** Gauge (doughnut setengah lingkaran) skor IKOD nasional/provinsi 0-100 */
  chartModule.gauge = function (canvasId, score) {
    const color = IKOD.scoreColor(score);
    return chartModule.render(canvasId, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [score, 100 - score],
          backgroundColor: [color, cssVar('--color-border')],
          borderWidth: 0,
          circumference: 220,
          rotation: -110,
        }],
      },
      options: {
        cutout: '75%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        events: [],
      },
    });
  };

  /** Bar chart horizontal ranking Top-N provinsi */
  chartModule.rankingBar = function (canvasId, labels, values, opts = {}) {
    return chartModule.render(canvasId, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: opts.label || 'Skor IKOD',
          data: values,
          backgroundColor: values.map((v) => IKOD.scoreColor(v)),
          borderRadius: 6,
          barThickness: opts.thickness || 16,
        }],
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, grid: { display: true } },
          y: { grid: { display: false } },
        },
      },
    });
  };

  /** Line chart trend nasional / provinsi longitudinal */
  chartModule.lineTrend = function (canvasId, labels, datasetsRaw) {
    const colors = chartModule.palette();
    const datasets = datasetsRaw.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || colors[i % colors.length],
      backgroundColor: (ds.color || colors[i % colors.length]) + '22',
      tension: 0.35,
      fill: !!ds.fill,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2.4,
    }));
    return chartModule.render(canvasId, {
      type: 'line',
      data: { labels, datasets },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: datasets.length > 1, position: 'bottom' } },
        scales: {
          y: { min: 0, max: 100 },
          x: { grid: { display: false } },
        },
      },
    });
  };

  /** Radar chart 12 dimensi (bisa multi provinsi/perbandingan nasional) */
  chartModule.radar = function (canvasId, labels, datasetsRaw) {
    const colors = chartModule.palette();
    const datasets = datasetsRaw.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || colors[i % colors.length],
      backgroundColor: (ds.color || colors[i % colors.length]) + '2E',
      pointBackgroundColor: ds.color || colors[i % colors.length],
      borderWidth: 2,
    }));
    return chartModule.render(canvasId, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: { r: { min: 0, max: 100, ticks: { display: false }, angleLines: {}, pointLabels: { font: { size: 10.5 } } } },
      },
    });
  };

  /** Pie / Doughnut chart distribusi (misal per pulau/region) */
  chartModule.pie = function (canvasId, labels, values, opts = {}) {
    return chartModule.render(canvasId, {
      type: opts.doughnut ? 'doughnut' : 'pie',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: chartModule.palette(), borderWidth: 2, borderColor: cssVar('--color-card-bg') }],
      },
      options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } },
    });
  };

  /** Histogram distribusi skor (menggunakan bar chart dengan bin) */
  chartModule.histogram = function (canvasId, allScores, opts = {}) {
    const binSize = opts.binSize || 10;
    const bins = {};
    for (let b = 0; b < 100; b += binSize) bins[`${b}-${b + binSize}`] = 0;
    allScores.forEach((s) => {
      const binStart = Math.min(90, Math.floor(s / binSize) * binSize);
      const key = `${binStart}-${binStart + binSize}`;
      bins[key] = (bins[key] || 0) + 1;
    });
    return chartModule.render(canvasId, {
      type: 'bar',
      data: {
        labels: Object.keys(bins),
        datasets: [{ label: 'Jumlah Provinsi', data: Object.values(bins), backgroundColor: cssVar('--chart-color-2'), borderRadius: 6 }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
      },
    });
  };

  /** Scatter chart korelasi 2 indikator */
  chartModule.scatter = function (canvasId, points, opts = {}) {
    return chartModule.render(canvasId, {
      type: 'scatter',
      data: {
        datasets: [{
          label: opts.label || 'Provinsi',
          data: points,
          backgroundColor: cssVar('--chart-color-6'),
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw.name}: (${ctx.raw.x}, ${ctx.raw.y})`,
            },
          },
        },
        scales: {
          x: { title: { display: true, text: opts.xLabel || 'X' } },
          y: { title: { display: true, text: opts.yLabel || 'Y' } },
        },
      },
    });
  };

  /** Area chart (line dengan fill) sederhana - reuse lineTrend dengan fill=true */
  chartModule.areaTrend = function (canvasId, labels, label, data, color) {
    return chartModule.lineTrend(canvasId, labels, [{ label, data, color, fill: true }]);
  };

  /** Bar chart vertikal generik (dipakai growth comparison, dsb) */
  chartModule.verticalBar = function (canvasId, labels, values, opts = {}) {
    return chartModule.render(canvasId, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: opts.label || 'Nilai',
          data: values,
          backgroundColor: opts.colors || values.map((v) => (v >= 0 ? cssVar('--color-success') : cssVar('--color-danger'))),
          borderRadius: 6,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true }, x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 60, minRotation: 45 } } },
      },
    });
  };

  IKOD.chart = chartModule;
})(window.IKOD);
