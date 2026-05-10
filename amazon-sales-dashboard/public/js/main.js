/* ── Navigation ───────────────────────────────────────────────── */
let forecastChart = null;

function navigate(id) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector(`nav a[data-section="${id}"]`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    navigate(a.dataset.section);
  });
});

/* ── API helpers ──────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Health check ─────────────────────────────────────────────── */
async function checkHealth() {
  const dot    = document.getElementById('apiDot');
  const status = document.getElementById('apiStatus');
  try {
    const h = await api('/api/health');
    dot.className   = 'status-dot online';
    status.textContent = 'En ligne ✓';

    const loaded = Object.entries(h.models)
      .filter(([, v]) => v)
      .map(([k]) => k.toUpperCase())
      .join(', ');
    status.title = `Modèles chargés : ${loaded}`;
  } catch {
    dot.className      = 'status-dot offline';
    status.textContent = 'Hors ligne ✗';
  }
}

/* ── Load overview summary ────────────────────────────────────── */
async function loadSummary() {
  try {
    const d = await api('/api/summary');
    const tbody = document.getElementById('summaryBody');
    const rows  = [];

    const addRows = (dsoKey, dsoNum) => {
      const dso = d[dsoKey];
      dso.models.forEach((m, i) => {
        let metricStr = '';
        if (m.rmse)       metricStr = `RMSE = ${m.rmse.toLocaleString('fr-FR', {minimumFractionDigits:2})}`;
        else if (m.silhouette) metricStr = `Silhouette = ${m.silhouette}`;
        else if (m.accuracy)   metricStr = `Accuracy = ${(m.accuracy*100).toFixed(0)} %`;
        else               metricStr = '—';

        rows.push(`<tr class="${m.best ? 'best' : ''}">
          <td>${i === 0 ? `<strong>DSO ${dsoNum}</strong>` : ''}</td>
          <td>${m.best ? '🏆 ' : ''}${m.name}</td>
          <td style="font-size:.82rem;color:var(--text-muted)">${m.author}</td>
          <td>${metricStr}</td>
          <td>${m.best ? '<span class="crown">★</span>' : ''}</td>
        </tr>`);
      });
    };

    addRows('dso1', 1);
    addRows('dso2', 2);
    addRows('dso3', 3);
    tbody.innerHTML = rows.join('');
  } catch {
    document.getElementById('summaryBody').innerHTML =
      '<tr><td colspan="5" style="color:var(--text-muted)">Impossible de charger le résumé (API hors ligne).</td></tr>';
  }
}

/* ════════════════════════════════════════════════════════════════
   DSO1 — Sales Forecast
═════════════════════════════════════════════════════════════════ */

/* Quick day buttons */
document.querySelectorAll('#dayQuick .quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#dayQuick .quick-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const v = parseInt(btn.dataset.val);
    document.getElementById('daysSlider').value = v;
    document.getElementById('daysVal').textContent = v;
  });
});

document.getElementById('daysSlider').addEventListener('input', e => {
  document.getElementById('daysVal').textContent = e.target.value;
  document.querySelectorAll('#dayQuick .quick-btn').forEach(b => b.classList.remove('selected'));
  const match = document.querySelector(`#dayQuick .quick-btn[data-val="${e.target.value}"]`);
  if (match) match.classList.add('selected');
});

async function loadDso1Table() {
  try {
    const d = await api('/api/summary');
    const tbody = document.getElementById('dso1Body');
    const models = d.dso1.models;
    const maxRmse = Math.max(...models.map(m => m.rmse));
    const rows = models.map(m => {
      const pct = ((1 - (m.rmse - models[0].rmse) / (maxRmse - models[0].rmse + 1)) * 100).toFixed(0);
      return `<tr class="${m.best ? 'best' : ''}">
        <td>${m.best ? '🏆 ' : ''}${m.name}</td>
        <td>${m.rmse.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
        <td class="bar-cell">
          <div class="bar-fill" style="width:${pct}%;background:${m.best ? 'var(--amazon-orange)' : '#ddd'}"></div>
        </td>
      </tr>`;
    });
    tbody.innerHTML = rows.join('');
  } catch { /* ignore */ }
}

async function runForecast() {
  const days = parseInt(document.getElementById('daysSlider').value);
  const btn  = document.getElementById('forecastBtn');
  const loader = document.getElementById('forecastLoader');
  const alert  = document.getElementById('dso1Alert');

  btn.disabled    = true;
  loader.classList.add('visible');
  alert.className = 'alert';

  try {
    const d = await api(`/api/dso1/forecast?days=${days}`);

    if (d.demo) {
      alert.className = 'alert alert-warning visible';
      alert.textContent = '⚠️ Modèle ARIMA non chargé — données de démonstration affichées.';
    }

    renderForecastChart(d);
  } catch (err) {
    alert.className = 'alert alert-error visible';
    alert.textContent = `Erreur : ${err.message}. Vérifiez que le serveur Python est démarré.`;
  } finally {
    btn.disabled = false;
    loader.classList.remove('visible');
  }
}

function renderForecastChart(data) {
  const labels = Array.from({ length: data.days }, (_, i) => `J+${i + 1}`);

  if (forecastChart) forecastChart.destroy();

  const ctx = document.getElementById('forecastChart').getContext('2d');
  forecastChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: `Prévision ARIMA (${data.days} jours)`,
          data: data.forecast,
          borderColor: '#FF9900',
          backgroundColor: 'rgba(255,153,0,.08)',
          borderWidth: 2.5,
          pointRadius: data.days <= 30 ? 3 : 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: false,
          order: 1
        },
        {
          type: 'line',
          label: 'IC supérieur 95%',
          data: data.upper,
          borderColor: 'rgba(180,180,180,.5)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: '+1',
          backgroundColor: 'rgba(200,200,200,.15)',
          order: 2
        },
        {
          type: 'line',
          label: 'IC inférieur 95%',
          data: data.lower,
          borderColor: 'rgba(180,180,180,.5)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          order: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            font: { size: 11 },
            filter: item => item.datasetIndex !== 2
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 2) return null;
              return ` ${ctx.dataset.label}: $${Math.round(ctx.raw).toLocaleString('fr-FR')}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 12,
            font: { size: 11 }
          },
          grid: { display: false }
        },
        y: {
          ticks: {
            callback: v => `$${(v / 1000).toFixed(0)}k`,
            font: { size: 11 }
          },
          grid: { color: 'rgba(0,0,0,.05)' }
        }
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   DSO2 — Product Segmentation
═════════════════════════════════════════════════════════════════ */

async function loadSegmentProfiles() {
  try {
    const d = await api('/api/dso2/profiles');
    const grid = document.getElementById('segmentsGrid');
    grid.innerHTML = Object.entries(d.segments).map(([id, seg]) => `
      <div class="seg-card" style="border-left-color:${seg.color}">
        <div class="seg-icon">${seg.icon}</div>
        <h4>${seg.name}</h4>
        <p>${seg.description}</p>
      </div>
    `).join('');
  } catch { /* ignore */ }
}

async function runSegment() {
  const revenue  = parseFloat(document.getElementById('revenue').value)  || 1875;
  const quantity = parseFloat(document.getElementById('quantity').value) || 12;
  const rating   = parseFloat(document.getElementById('rating').value)   || 3.5;

  const loader = document.getElementById('segLoader');
  const result = document.getElementById('segResult');
  const placeholder = document.getElementById('segPlaceholder');

  loader.classList.add('visible');
  result.classList.add('hidden');
  placeholder.style.display = 'none';

  try {
    const d = await api('/api/dso2/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_revenue: revenue, quantity_sold: quantity, rating })
    });

    const p = d.profile;
    document.getElementById('segEmoji').textContent = p.icon;
    document.getElementById('segName').textContent  = p.name;
    document.getElementById('segDesc').textContent  = p.description;
    document.getElementById('segAdvice').textContent = p.advice;

    // Tags
    document.getElementById('segTags').innerHTML =
      (p.tags || []).map(t => `<span class="tag">${t}</span>`).join('');

    // Confidence bar
    const confPct = Math.round(Math.min(d.confidence * 100, 100));
    document.getElementById('confVal').textContent = `${confPct} %`;
    document.getElementById('confBar').style.width  = `${confPct}%`;

    // Border color
    result.style.borderTopColor = p.color || 'var(--amazon-orange)';
    result.classList.remove('hidden');
  } catch (err) {
    placeholder.style.display = 'block';
    placeholder.innerHTML = `<div style="color:var(--danger)">Erreur : ${err.message}</div>`;
  } finally {
    loader.classList.remove('visible');
  }
}

/* ════════════════════════════════════════════════════════════════
   DSO3 — Product Recommendations
═════════════════════════════════════════════════════════════════ */

async function runRecommend() {
  const category = document.getElementById('recCategory').value;
  const price    = parseFloat(document.getElementById('recPrice').value)   || 100;
  const rating   = parseFloat(document.getElementById('recRating').value)  || 4.0;
  const topN     = parseInt(document.getElementById('recTopN').value)      || 5;

  const loader = document.getElementById('recLoader');
  const grid   = document.getElementById('recGrid');
  const ph     = document.getElementById('recPlaceholder');
  const qual   = document.getElementById('recQuality');

  loader.classList.add('visible');
  grid.style.display = 'none';
  ph.style.display   = 'none';
  qual.style.display = 'none';

  try {
    const d = await api('/api/dso3/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, price, rating, top_n: topN })
    });

    // Quality badge
    if (d.quality_label) {
      const isHigh = d.quality_class === 1;
      qual.className = `quality-badge ${isHigh ? 'quality-high' : 'quality-std'}`;
      qual.innerHTML = `${isHigh ? '⭐' : '📦'} Qualité prédite (RF) : <strong>${d.quality_label}</strong>
        <span style="font-size:.8rem;opacity:.7">(score : ${(d.quality_score * 100).toFixed(0)} %)</span>`;
      qual.style.display = 'inline-flex';
    }

    // Cards
    grid.innerHTML = d.recommendations.map(r => `
      <div class="rec-card">
        <div class="pid">Produit #${r.product_id}</div>
        <div class="cat">${r.category}</div>
        <div class="price">$${r.price.toLocaleString('fr-FR', {minimumFractionDigits:2})}</div>
        <div class="rec-rating">⭐ ${r.rating.toFixed(1)} / 5</div>
        <span class="sim-score">Similarité : ${(r.similarity_score * 100).toFixed(1)} %</span>
      </div>
    `).join('');

    grid.style.display = 'grid';
  } catch (err) {
    ph.style.display = 'block';
    ph.innerHTML = `<div style="color:var(--danger)">Erreur : ${err.message}</div>`;
  } finally {
    loader.classList.remove('visible');
  }
}

/* ── Init ─────────────────────────────────────────────────────── */
(async () => {
  await checkHealth();
  await loadSummary();
  await loadDso1Table();
  await loadSegmentProfiles();
  // Auto-load a 30-day forecast on first visit
  await runForecast();
})();
