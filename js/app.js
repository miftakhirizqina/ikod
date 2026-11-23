/* ============================================================================
   APP.JS
   Inti aplikasi Dashboard IKOD:
   - Namespace global IKOD
   - Loading seluruh dataset JSON (tanpa backend)
   - Navigasi sidebar & switching antar "page-view"
   - Sidebar collapse, Dark Mode, Header (search, notifikasi, profile)
   - Toast notification & Global Loader
   - Animated counter (reusable)
   ============================================================================ */

/* Namespace global aplikasi. Semua modul lain (filter.js, chart.js, map.js,
   dashboard.js, export.js, metadata.js) menempel di objek window.IKOD ini
   supaya tidak ada polusi variabel global dan mudah dikembangkan. */
window.IKOD = window.IKOD || {};

(function (IKOD) {
  'use strict';

  /* ---------------------------------------------------------------------
     1. STATE APLIKASI (single source of truth, dibaca oleh semua modul)
     --------------------------------------------------------------------- */
  IKOD.data = {
    province: null,
    ikod: null,
    longitudinal: null,
    indikator: null,
    metadata: null,
    kpi: null,
  };

  IKOD.state = {
    currentPage: 'dashboard',
    sidebarCollapsed: false,
    theme: 'light',
    charts: {},   // instance Chart.js aktif, key = id canvas
    map: null,    // instance Leaflet
    mapLayer: null,
    filters: {
      provinsi: 'ALL',
      kabupaten: 'ALL',
      tahun: 2025,
      dimensi: 'ALL',
      indikator: 'ALL',
      search: '',
    },
    table: {
      indikator: { sortKey: 'name', sortDir: 'asc', page: 1, pageSize: 8, search: '' },
    },
  };

  const DATA_FILES = {
    province: 'data/province.json',
    ikod: 'data/ikod.json',
    longitudinal: 'data/longitudinal.json',
    indikator: 'data/indikator.json',
    metadata: 'data/metadata.json',
    kpi: 'data/kpi_summary.json',
  };

  /* ---------------------------------------------------------------------
     2. UTILITAS UMUM
     --------------------------------------------------------------------- */

  /** Format angka dengan pemisah ribuan gaya Indonesia */
  IKOD.formatNumber = function (num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  /** Ambil warna berdasarkan skor (0-100) untuk badge / choropleth */
  IKOD.scoreColor = function (score) {
    if (score >= 75) return '#16A34A';
    if (score >= 60) return '#0D6EFD';
    if (score >= 45) return '#F59E0B';
    return '#DC2626';
  };

  IKOD.scoreLabel = function (score) {
    if (score >= 75) return 'Sangat Baik';
    if (score >= 60) return 'Baik';
    if (score >= 45) return 'Cukup';
    return 'Perlu Perhatian';
  };

  /** Animasi counter angka naik dari 0 -> target (dipakai KPI Cards) */
  IKOD.animateCounter = function (el, target, opts = {}) {
    const decimals = opts.decimals || 0;
    const duration = opts.duration || 1200;
    const suffix = opts.suffix || '';
    const start = 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = start + (target - start) * eased;
      el.textContent = IKOD.formatNumber(value, decimals) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = IKOD.formatNumber(target, decimals) + suffix;
    }
    requestAnimationFrame(tick);
  };

  /** Toast notification ringan (tanpa dependency tambahan) */
  IKOD.toast = function (message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      info: 'fa-circle-info',
      success: 'fa-circle-check',
      danger: 'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
    };
    const titles = {
      info: title || 'Informasi',
      success: title || 'Berhasil',
      danger: title || 'Terjadi Kesalahan',
      warning: title || 'Perhatian',
    };

    const toastEl = document.createElement('div');
    toastEl.className = `ikod-toast toast-${type}`;
    toastEl.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info}" style="color:${IKOD.scoreColor(type === 'danger' ? 0 : 90)}"></i>
      <div>
        <div class="fw-600">${titles[type]}</div>
        <div class="text-secondary-ikod">${message}</div>
      </div>
      <span class="toast-close"><i class="fa-solid fa-xmark"></i></span>
    `;
    container.appendChild(toastEl);

    const remove = () => {
      toastEl.classList.add('toast-out');
      setTimeout(() => toastEl.remove(), 250);
    };
    toastEl.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, 4200);
  };

  /* ---------------------------------------------------------------------
     3. LOAD DATA (JSON dummy - tidak menggunakan backend)
     --------------------------------------------------------------------- */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    return res.json();
  }

  async function loadAllData() {
    const entries = Object.entries(DATA_FILES);
    const results = await Promise.all(entries.map(([, path]) => loadJSON(path)));
    entries.forEach(([key], i) => { IKOD.data[key] = results[i]; });
  }

  /* ---------------------------------------------------------------------
     4. SIDEBAR: collapse / expand + navigasi menu
     --------------------------------------------------------------------- */
  function initSidebar() {
    const sidebar = document.getElementById('ikodSidebar');
    const appShell = document.getElementById('appShell');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const mobileToggleBtn = document.getElementById('mobileSidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');

    const savedCollapsed = localStorage.getItem('ikod_sidebar_collapsed') === '1';
    IKOD.state.sidebarCollapsed = savedCollapsed;
    if (savedCollapsed) {
      sidebar.classList.add('collapsed');
      appShell.classList.add('sidebar-collapsed');
    }

    toggleBtn.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      appShell.classList.toggle('sidebar-collapsed', collapsed);
      IKOD.state.sidebarCollapsed = collapsed;
      localStorage.setItem('ikod_sidebar_collapsed', collapsed ? '1' : '0');
      // Chart.js perlu di-resize manual setelah transisi lebar sidebar selesai
      setTimeout(() => IKOD.chart && IKOD.chart.resizeAll(), 320);
    });

    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      backdrop.classList.toggle('show');
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('show');
    });

    // Klik menu navigasi
    document.querySelectorAll('.nav-link-ikod[data-page]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('show');
      });
    });
  }

  /** Pindah antar halaman (page-view) + update active state + render konten */
  function navigateTo(page) {
    const target = document.getElementById(`page-${page}`);
    if (!target) return;

    document.querySelectorAll('.page-view').forEach((el) => el.classList.remove('active'));
    target.classList.add('active');

    document.querySelectorAll('.nav-item-ikod').forEach((item) => item.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link-ikod[data-page="${page}"]`);
    if (activeLink) activeLink.closest('.nav-item-ikod').classList.add('active');

    const titleMap = {
      dashboard: 'Dashboard Utama',
      executive: 'Executive Summary',
      longitudinal: 'Analisis Longitudinal 2001–2025',
      peta: 'Peta Sebaran Indonesia',
      dimensi: '12 Dimensi IKOD',
      indikator: 'Data Indikator',
      metadata: 'Metadata Indikator',
      quality: 'Data Quality Assessment',
      analytics: 'Analytics Lanjutan',
      laporan: 'Laporan & Ekspor Data',
      tentang: 'Tentang Prototype IKOD',
      settings: 'Pengaturan Aplikasi',
    };
    const headerTitleEl = document.getElementById('currentPageTitle');
    if (headerTitleEl) headerTitleEl.textContent = titleMap[page] || 'Dashboard IKOD';

    IKOD.state.currentPage = page;
    window.location.hash = page;

    // Delegasikan render konten halaman ke dashboard.js
    if (IKOD.render && typeof IKOD.render.renderPage === 'function') {
      IKOD.render.renderPage(page);
    }
  }
  IKOD.navigateTo = navigateTo;

  /* ---------------------------------------------------------------------
     5. DARK MODE
     --------------------------------------------------------------------- */
  function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const settingsToggle = document.getElementById('settingsDarkModeSwitch');
    const saved = localStorage.getItem('ikod_theme') || 'light';
    applyTheme(saved);
    if (toggle) toggle.checked = saved === 'dark';
    if (settingsToggle) settingsToggle.checked = saved === 'dark';

    function handleToggle(e) {
      const isDark = e.target.checked;
      applyTheme(isDark ? 'dark' : 'light');
      localStorage.setItem('ikod_theme', isDark ? 'dark' : 'light');
      if (toggle && e.target !== toggle) toggle.checked = isDark;
      if (settingsToggle && e.target !== settingsToggle) settingsToggle.checked = isDark;
      setTimeout(() => IKOD.chart && IKOD.chart.refreshTheme(), 80);
    }
    if (toggle) toggle.addEventListener('change', handleToggle);
    if (settingsToggle) settingsToggle.addEventListener('change', handleToggle);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    IKOD.state.theme = theme;
  }

  /* ---------------------------------------------------------------------
     6. HEADER: jam/tanggal, search global
     --------------------------------------------------------------------- */
  function initHeaderClock() {
    const el = document.getElementById('headerDateText');
    if (!el) return;
    const now = new Date();
    const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    el.textContent = now.toLocaleDateString('id-ID', opts);
  }

  function initGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        IKOD.state.filters.search = q;
        if (!q) return;
        IKOD.toast(`Menampilkan hasil pencarian untuk "${q}"`, 'info', 'Pencarian');
        navigateTo('indikator');
        if (IKOD.filterModule) IKOD.filterModule.setTableSearch(q);
      }
    });
  }

  /* ---------------------------------------------------------------------
     7. INISIALISASI UTAMA
     --------------------------------------------------------------------- */
  async function init() {
    const loader = document.getElementById('globalLoader');
    try {
      await loadAllData();
    } catch (err) {
      console.error(err);
      IKOD.toast('Gagal memuat data JSON. Pastikan dijalankan melalui Live Server.', 'danger');
    }

    initSidebar();
    initDarkMode();
    initHeaderClock();
    initGlobalSearch();

    // Modul filter membangun opsi dropdown dari data yang sudah dimuat
    if (IKOD.filterModule) IKOD.filterModule.init();

    // Buka halaman sesuai hash URL (default: dashboard)
    const initialPage = (window.location.hash || '#dashboard').replace('#', '');
    navigateTo(document.getElementById(`page-${initialPage}`) ? initialPage : 'dashboard');

    // Sembunyikan loader dengan sedikit delay agar transisi terasa halus
    setTimeout(() => {
      loader.classList.add('hidden');
      IKOD.toast('Dashboard IKOD berhasil dimuat. Seluruh data bersumber dari dataset dummy JSON.', 'success', 'Selamat Datang');
    }, 550);

    // AOS (animate on scroll) init
    if (window.AOS) AOS.init({ duration: 600, once: true, offset: 30 });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.IKOD);
