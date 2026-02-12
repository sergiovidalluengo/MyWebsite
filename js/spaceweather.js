/* ============================================================
   SPACE WEATHER DASHBOARD - JavaScript Logic
   ============================================================
   Features:
   - UTC Clock
   - Auto-refresh every 5 minutes
   - Chart.js plots for GOES X-ray, Kp Index, GOES Proton Flux
   - Image cache-busting for live updates
   ============================================================ */

// ===================== CONFIGURATION =====================
const CONFIG = {
    refreshInterval: 5 * 60 * 1000, // 5 minutes in ms
    urls: {
        sunspots: 'https://soho.nascom.nasa.gov/data/synoptic/sunspots_earth/mdi_sunspots_1024.jpg',
        soho: 'https://soho.nascom.nasa.gov/data/LATEST/current_c3.gif',
        ace: 'https://services.swpc.noaa.gov/images/ace-mag-swepam-24-hour.gif',
        xray: 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json',
        kp: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
        proton: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json'
    }
};

// Chart instances (for destroy/rebuild)
let chartXray = null;
let chartKp = null;
let chartProton = null;

// Countdown timer
let countdownSeconds = 300; // 5 minutes
let countdownInterval = null;

// ===================== UTC CLOCK =====================
function updateClock() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    document.getElementById('utc-clock').textContent = `${h}:${m}:${s} UTC`;
}

// ===================== COUNTDOWN =====================
function startCountdown() {
    countdownSeconds = 300;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        countdownSeconds--;
        if (countdownSeconds < 0) countdownSeconds = 0;
        const min = Math.floor(countdownSeconds / 60);
        const sec = String(countdownSeconds % 60).padStart(2, '0');
        document.getElementById('countdown').textContent = `${min}:${sec}`;
    }, 1000);
}

// ===================== IMAGE REFRESH =====================
function refreshImages() {
    const ts = Date.now();
    const images = {
        'img-sunspots': CONFIG.urls.sunspots,
        'img-soho': CONFIG.urls.soho,
        'img-ace': CONFIG.urls.ace
    };

    Object.entries(images).forEach(([id, url]) => {
        const img = document.getElementById(id);
        if (img) {
            img.classList.remove('error');
            img.src = `${url}?t=${ts}`;
            img.onerror = () => img.classList.add('error');
        }
    });
}

// ===================== CHART THEME =====================
const chartDefaults = {
    color: '#94a3b8',
    borderColor: '#2a3348',
    font: {
        family: "'Segoe UI', 'Inter', sans-serif",
        size: 11
    }
};

Chart.defaults.color = chartDefaults.color;
Chart.defaults.font.family = chartDefaults.font.family;
Chart.defaults.font.size = chartDefaults.font.size;

// ===================== GOES X-RAY FLUX CHART =====================
async function loadXrayChart() {
    try {
        const response = await fetch(CONFIG.urls.xray);
        const data = await response.json();

        // Filter for 0.1-0.8nm (long channel - primary)
        const longWave = data.filter(d => d.energy === '0.1-0.8nm');
        const shortWave = data.filter(d => d.energy === '0.05-0.4nm');

        const longData = longWave.map(d => ({
            x: new Date(d.time_tag),
            y: d.flux
        }));

        const shortData = shortWave.map(d => ({
            x: new Date(d.time_tag),
            y: d.flux > 0 ? d.flux : 1e-9
        }));

        const ctx = document.getElementById('chart-xray').getContext('2d');

        if (chartXray) chartXray.destroy();

        chartXray = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: '0.1–0.8 nm (largo)',
                        data: longData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.2
                    },
                    {
                        label: '0.05–0.4 nm (corto)',
                        data: shortData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: '#2a3348',
                        borderWidth: 1,
                        titleFont: { size: 11 },
                        bodyFont: { size: 10 },
                        callbacks: {
                            label: function(ctx) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y.toExponential(2)} W/m²`;
                            }
                        }
                    },
                    // Threshold lines via annotation-like approach
                    annotation: undefined
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                hour: 'HH:mm',
                                minute: 'HH:mm'
                            }
                        },
                        grid: { color: 'rgba(42, 51, 72, 0.5)' },
                        ticks: { maxTicksLimit: 8, font: { size: 10 } },
                        title: {
                            display: true,
                            text: 'Hora UTC',
                            font: { size: 10 },
                            color: '#64748b'
                        }
                    },
                    y: {
                        type: 'logarithmic',
                        min: 1e-9,
                        max: 1e-2,
                        grid: { color: 'rgba(42, 51, 72, 0.5)' },
                        ticks: {
                            font: { size: 10 },
                            callback: function(value) {
                                const exp = Math.log10(value);
                                if (Number.isInteger(exp)) {
                                    // Show flare class labels
                                    const classes = {
                                        '-8': 'A',
                                        '-7': 'B',
                                        '-6': 'C',
                                        '-5': 'M',
                                        '-4': 'X'
                                    };
                                    return classes[exp.toString()] || `10^${exp}`;
                                }
                                return '';
                            }
                        },
                        title: {
                            display: true,
                            text: 'W/m²',
                            font: { size: 10 },
                            color: '#64748b'
                        }
                    }
                }
            }
        });

        document.getElementById('loading-xray').classList.add('hidden');

    } catch (error) {
        console.error('Error cargando datos X-ray:', error);
        document.getElementById('loading-xray').textContent = '⚠️ Error al cargar datos';
    }
}

// ===================== KP INDEX CHART =====================
async function loadKpChart() {
    try {
        const response = await fetch(CONFIG.urls.kp);
        const raw = await response.json();

        // Skip header row
        const rows = raw.slice(1);

        const labels = rows.map(r => new Date(r[0]));
        const kpValues = rows.map(r => parseFloat(r[1]));

        // Color bars based on Kp value
        const barColors = kpValues.map(kp => {
            if (kp < 4) return '#10b981';      // Green - quiet
            if (kp < 5) return '#f59e0b';      // Yellow - unsettled
            if (kp < 6) return '#f97316';      // Orange - G1
            if (kp < 7) return '#ef4444';      // Red - G2
            if (kp < 8) return '#dc2626';      // Deep red - G3
            return '#991b1b';                   // Dark red - G4/G5
        });

        const ctx = document.getElementById('chart-kp').getContext('2d');

        if (chartKp) chartKp.destroy();

        chartKp = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Índice Kp',
                    data: kpValues,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c),
                    borderWidth: 1,
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: '#2a3348',
                        borderWidth: 1,
                        titleFont: { size: 11 },
                        bodyFont: { size: 10 },
                        callbacks: {
                            title: function(items) {
                                const d = new Date(items[0].label);
                                return d.toUTCString().slice(0, -4) + ' UTC';
                            },
                            label: function(ctx) {
                                const kp = ctx.parsed.y;
                                let storm = '';
                                if (kp >= 5 && kp < 6) storm = ' (G1 - Menor)';
                                else if (kp >= 6 && kp < 7) storm = ' (G2 - Moderada)';
                                else if (kp >= 7 && kp < 8) storm = ' (G3 - Fuerte)';
                                else if (kp >= 8 && kp < 9) storm = ' (G4 - Severa)';
                                else if (kp >= 9) storm = ' (G5 - Extrema)';
                                return `Kp: ${kp.toFixed(1)}${storm}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd MMM',
                                hour: 'HH:mm'
                            }
                        },
                        grid: { color: 'rgba(42, 51, 72, 0.5)' },
                        ticks: { font: { size: 10 }, maxTicksLimit: 8 },
                        title: {
                            display: true,
                            text: 'Fecha UTC',
                            font: { size: 10 },
                            color: '#64748b'
                        }
                    },
                    y: {
                        min: 0,
                        max: 9,
                        grid: {
                            color: function(context) {
                                if (context.tick.value === 5) return 'rgba(249, 115, 22, 0.4)';
                                return 'rgba(42, 51, 72, 0.5)';
                            },
                            lineWidth: function(context) {
                                if (context.tick.value === 5) return 2;
                                return 1;
                            }
                        },
                        ticks: {
                            stepSize: 1,
                            font: { size: 10 },
                            callback: function(value) {
                                const labels = {
                                    5: '5 (G1)',
                                    6: '6 (G2)',
                                    7: '7 (G3)',
                                    8: '8 (G4)',
                                    9: '9 (G5)'
                                };
                                return labels[value] || value;
                            }
                        },
                        title: {
                            display: true,
                            text: 'Kp',
                            font: { size: 10 },
                            color: '#64748b'
                        }
                    }
                }
            }
        });

        document.getElementById('loading-kp').classList.add('hidden');

    } catch (error) {
        console.error('Error cargando datos Kp:', error);
        document.getElementById('loading-kp').textContent = '⚠️ Error al cargar datos';
    }
}

// ===================== GOES PROTON FLUX CHART =====================
async function loadProtonChart() {
    try {
        const response = await fetch(CONFIG.urls.proton);
        const data = await response.json();

        // Group by energy level
        const energyLevels = {
            '>=10 MeV': { color: '#ef4444', data: [] },
            '>=50 MeV': { color: '#f59e0b', data: [] },
            '>=100 MeV': { color: '#3b82f6', data: [] }
        };

        data.forEach(d => {
            if (energyLevels[d.energy]) {
                energyLevels[d.energy].data.push({
                    x: new Date(d.time_tag),
                    y: d.flux > 0 ? d.flux : 0.01
                });
            }
        });

        const datasets = Object.entries(energyLevels).map(([label, cfg]) => ({
            label: label,
            data: cfg.data,
            borderColor: cfg.color,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2
        }));

        const ctx = document.getElementById('chart-proton').getContext('2d');

        if (chartProton) chartProton.destroy();

        chartProton = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: '#2a3348',
                        borderWidth: 1,
                        titleFont: { size: 11 },
                        bodyFont: { size: 10 },
                        callbacks: {
                            label: function(ctx) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} pfu`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                hour: 'HH:mm',
                                minute: 'HH:mm'
                            }
                        },
                        grid: { color: 'rgba(42, 51, 72, 0.5)' },
                        ticks: { maxTicksLimit: 8, font: { size: 10 } },
                        title: {
                            display: true,
                            text: 'Hora UTC',
                            font: { size: 10 },
                            color: '#64748b'
                        }
                    },
                    y: {
                        type: 'logarithmic',
                        min: 0.01,
                        max: 1e4,
                        grid: {
                            color: function(context) {
                                // Highlight the 10 pfu SWPC warning threshold
                                if (context.tick.value === 10) return 'rgba(239, 68, 68, 0.5)';
                                return 'rgba(42, 51, 72, 0.5)';
                            },
                            lineWidth: function(context) {
                                if (context.tick.value === 10) return 2;
                                return 1;
                            }
                        },
                        ticks: {
                            font: { size: 10 },
                            callback: function(value) {
                                if (value === 10) return '10 (Umbral)';
                                const allowed = [0.01, 0.1, 1, 10, 100, 1000, 10000];
                                if (allowed.includes(value)) return value.toString();
                                return '';
                            }
                        },
                        title: {
                            display: true,
                            text: 'pfu (protones/cm²·s·sr)',
                            font: { size: 10 },
                            color: '#64748b'
                        }
                    }
                }
            }
        });

        document.getElementById('loading-proton').classList.add('hidden');

    } catch (error) {
        console.error('Error cargando datos de protones:', error);
        document.getElementById('loading-proton').textContent = '⚠️ Error al cargar datos';
    }
}

// ===================== LAST UPDATE =====================
function updateLastRefresh() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    document.getElementById('last-update').textContent = `Última act.: ${h}:${m} UTC`;
}

// ===================== FULL REFRESH =====================
async function refreshAll() {
    updateLastRefresh();
    refreshImages();
    startCountdown();

    // Load charts in parallel
    await Promise.allSettled([
        loadXrayChart(),
        loadKpChart(),
        loadProtonChart()
    ]);
}

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', () => {
    // Start UTC clock
    updateClock();
    setInterval(updateClock, 1000);

    // Initial load
    refreshAll();

    // Auto-refresh every 5 minutes
    setInterval(refreshAll, CONFIG.refreshInterval);
});
