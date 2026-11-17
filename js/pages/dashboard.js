'use strict';

Pages.dashboard = {
  async render(root) {
    return Auth.isAdmin ? adminDashboard(root) : staffDashboard(root);
  },
};

async function lowStock() {
  const { data, error } = await sb.from('produits').select('id,nom,stock,seuil_alerte').eq('actif', true);
  if (error) throw error;
  return data.filter((p) => p.stock <= p.seuil_alerte).sort((a, b) => a.stock - b.stock);
}

function lowStockCard(list) {
  return `<div class="card"><div class="card-head"><h3>Alertes de stock</h3><a href="#/stock" class="link">Voir le stock</a></div>${
    list.length
      ? `<ul class="list">${list
          .slice(0, 8)
          .map((p) => `<li><span>${esc(p.nom)}</span>${p.stock <= 0 ? badge('Rupture', 'bad') : badge(`${p.stock} restant(s)`, 'warn')}</li>`)
          .join('')}</ul>`
      : '<div class="empty">Aucune alerte : stock sain</div>'
  }</div>`;
}

function recentSalesCard(list, title = 'Dernières ventes') {
  return `<div class="card"><div class="card-head"><h3>${esc(title)}</h3><a href="#/ventes" class="link">Tout voir</a></div>${
    list.length
      ? `<ul class="list">${list
          .map(
            (v) =>
              `<li class="click" data-sale="${esc(v.id)}"><span><b>n° ${pad(v.numero, 6)}</b> · ${esc(v.client_nom || 'Client comptoir')}<small class="muted block">${fmtDate(v.created_at)}</small></span><span class="right">${esc(fcfa(v.total))}<small class="block">${statutBadge(v.statut)}</small></span></li>`
          )
          .join('')}</ul>`
      : '<div class="empty">Aucune vente</div>'
  }</div>`;
}

function bindSales(root) {
  root.addEventListener('click', (e) => {
    const li = e.target.closest('[data-sale]');
    if (li) Sales.detail(li.dataset.sale, () => App.route());
  });
}

async function adminDashboard(root) {
  const st = { preset: '7j', du: shiftDay(-6), au: today() };
  let charts = [];
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Tableau de bord</h2><p class="muted">Performance de la boutique</p></div>
      <div class="period">
        <div class="chips" id="presets">
          <button class="chip" data-p="today" type="button">Aujourd'hui</button>
          <button class="chip active" data-p="7j" type="button">7 jours</button>
          <button class="chip" data-p="mois" type="button">Ce mois</button>
          <button class="chip" data-p="30j" type="button">30 jours</button>
        </div>
        <div class="date-range"><input type="date" id="d-du" value="${st.du}"><span>→</span><input type="date" id="d-au" value="${st.au}"></div>
      </div>
    </div>
    <div id="dash"></div>`;
  bindSales(root);

  const load = async () => {
    const box = $('#dash', root);
    box.innerHTML = '<div class="center pad"><div class="spin lg"></div></div>';
    try {
      const [stats, low, recent] = await Promise.all([
        sb.rpc('stats_dashboard', { p_debut: st.du, p_fin: st.au }),
        lowStock(),
        sb.from('ventes').select('*').order('created_at', { ascending: false }).limit(6),
      ]);
      if (stats.error) throw stats.error;
      if (recent.error) throw recent.error;
      const r = stats.data;
      const marge = r.ca - r.cout;
      const benef = marge - r.depenses;
      const pct = r.ca > 0 ? `${Math.round((marge / r.ca) * 100)} % du CA` : '—';
      box.innerHTML = `
        <div class="kpis">
          ${kpi("Chiffre d'affaires", fcfa(r.ca), `${r.nb_ventes} vente(s)`, 'brand')}
          ${kpi('Bénéfice net', fcfa(benef), 'Ventes − coût − dépenses', benef >= 0 ? 'gold' : 'danger')}
          ${kpi('Marge brute', fcfa(marge), pct)}
          ${kpi('Dépenses', fcfa(r.depenses), 'Sur la période')}
          ${kpi('Encaissé', fcfa(r.encaisse), 'Paiements reçus')}
          ${kpi('Créances clients', fcfa(r.creances), 'Reste à encaisser')}
          ${kpi('Valeur du stock', fcfa(r.valeur_stock), "Au prix d'achat")}
          ${kpi('Alertes stock', String(r.alertes), 'Produits à réapprovisionner')}
        </div>
        <div class="grid-main">
          <div class="card"><div class="card-head"><h3>Ventes et dépenses</h3></div><div class="chart-box"><canvas id="ch-serie"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Modes de paiement</h3></div><div class="chart-box sm" id="modes-box"><canvas id="ch-modes"></canvas></div></div>
        </div>
        <div class="grid-3">
          <div class="card"><div class="card-head"><h3>Produits les plus vendus</h3></div>${
            r.top_produits.length
              ? `<ul class="list">${r.top_produits
                  .map((p) => `<li><span>${esc(p.nom)}<small class="muted block">${num(p.quantite)} vendu(s)</small></span><b>${esc(fcfa(p.ca))}</b></li>`)
                  .join('')}</ul>`
              : '<div class="empty">Aucune vente sur la période</div>'
          }</div>
          ${lowStockCard(low)}
          ${recentSalesCard(recent.data)}
        </div>`;
      charts.forEach((c) => c.destroy());
      charts = [];
      drawCharts(r);
    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="card error-card"><p class="muted">${esc(errMsg(e))}</p></div>`;
    }
  };

  const drawCharts = (r) => {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Inter',system-ui,sans-serif";
    Chart.defaults.color = '#6a7287';
    const labels = r.serie.map((s) => fmtDay(s.jour).slice(0, 5));
    charts.push(
      new Chart($('#ch-serie'), {
        data: {
          labels,
          datasets: [
            { type: 'bar', label: "Chiffre d'affaires", data: r.serie.map((s) => s.ca), backgroundColor: '#1e3a5f', borderRadius: 6, maxBarThickness: 36 },
            { type: 'line', label: 'Dépenses', data: r.serie.map((s) => s.depenses), borderColor: '#b98a3e', backgroundColor: '#b98a3e', tension: 0.3, pointRadius: 3 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label} : ${fcfa(c.parsed.y)}` } }, legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => num(v) }, grid: { color: '#eee9de' } }, x: { grid: { display: false } } },
        },
      })
    );
    const keys = Object.keys(r.par_mode || {});
    if (!keys.length) {
      $('#modes-box').innerHTML = '<div class="empty">Aucun paiement sur la période</div>';
      return;
    }
    const colors = { especes: '#2b8a5a', wave: '#1da1d6', orange_money: '#f08a24' };
    charts.push(
      new Chart($('#ch-modes'), {
        type: 'doughnut',
        data: { labels: keys.map((k) => MODES[k] || k), datasets: [{ data: keys.map((k) => r.par_mode[k]), backgroundColor: keys.map((k) => colors[k] || '#999'), borderWidth: 2, borderColor: '#fff' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.label} : ${fcfa(c.parsed)}` } } },
        },
      })
    );
  };

  const setPreset = (p) => {
    st.preset = p;
    if (p === 'today') [st.du, st.au] = [today(), today()];
    if (p === '7j') [st.du, st.au] = [shiftDay(-6), today()];
    if (p === 'mois') [st.du, st.au] = [monthStart(), today()];
    if (p === '30j') [st.du, st.au] = [shiftDay(-29), today()];
    $('#d-du', root).value = st.du;
    $('#d-au', root).value = st.au;
    $$('#presets .chip', root).forEach((c) => c.classList.toggle('active', c.dataset.p === p));
    load();
  };

  $('#presets', root).addEventListener('click', (e) => {
    const c = e.target.closest('[data-p]');
    if (c) setPreset(c.dataset.p);
  });
  const custom = () => {
    const du = $('#d-du', root).value;
    const au = $('#d-au', root).value;
    if (!du || !au || du > au) return toast('Période invalide', 'warn');
    if ((new Date(au) - new Date(du)) / 86400000 > 365) return toast('Période maximale : 1 an', 'warn');
    st.du = du;
    st.au = au;
    $$('#presets .chip', root).forEach((c) => c.classList.remove('active'));
    load();
  };
  $('#d-du', root).addEventListener('change', custom);
  $('#d-au', root).addEventListener('change', custom);
  await load();
}

async function staffDashboard(root) {
  const uid = Auth.session.user.id;
  const from = dayStartISO(today());
  const to = dayEndISO(today());
  const [v, p, low] = await Promise.all([
    sb.from('ventes').select('*').eq('user_id', uid).eq('annulee', false).gte('created_at', from).lt('created_at', to).order('created_at', { ascending: false }),
    sb.from('paiements').select('montant').eq('user_id', uid).gte('created_at', from).lt('created_at', to),
    lowStock(),
  ]);
  if (v.error) throw v.error;
  if (p.error) throw p.error;
  const total = v.data.reduce((s, x) => s + Number(x.total), 0);
  const encaisse = p.data.reduce((s, x) => s + Number(x.montant), 0);
  root.innerHTML = `
    <div class="page-head"><div><h2>Bonjour, ${esc(Auth.profile.nom.split(' ')[0])}</h2><p class="muted">Votre activité du jour</p></div>
      <a class="btn primary lg" href="#/vente">${icon('plus')} Nouvelle vente</a></div>
    <div class="kpis">
      ${kpi('Mes ventes du jour', String(v.data.length), 'Aujourd\'hui', 'brand')}
      ${kpi('Montant vendu', fcfa(total))}
      ${kpi('Encaissé', fcfa(encaisse), 'Paiements reçus par vous')}
      ${kpi('Alertes stock', String(low.length), 'Produits à signaler')}
    </div>
    <div class="grid-2-eq">${recentSalesCard(v.data.slice(0, 8), 'Mes ventes du jour')}${lowStockCard(low)}</div>`;
  bindSales(root);
}
