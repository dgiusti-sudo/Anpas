'use strict';

/* ============================================================
   Rappresentante di Classe — gestione cassa, raccolte fondi,
   calendario e annunci. Dati salvati in localStorage.
   ============================================================ */

const STORAGE_KEY = 'rappresentante-classe-v1';

const CATEGORIE_ENTRATA = ['Quote', 'Raccolta fondi', 'Donazione', 'Altro'];
const CATEGORIE_USCITA = ['Regali', 'Materiale didattico', 'Gite e uscite', 'Feste', 'Altro'];

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/* ---------- Stato ---------- */

function statoVuoto() {
  return {
    classe: { nome: '', scuola: '', anno: annoScolasticoCorrente() },
    alunni: [],
    movimenti: [],
    raccolte: [],
    eventi: [],
    annunci: [],
  };
}

function carica() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return statoVuoto();
    return { ...statoVuoto(), ...JSON.parse(raw) };
  } catch {
    return statoVuoto();
  }
}

let state = carica();

function salva() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Impossibile salvare i dati su questo dispositivo');
  }
}

/* ---------- Utilità ---------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);

function oggiISO() {
  const d = new Date();
  return isoData(d);
}

function isoData(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dataLunga(s) {
  if (!s) return '';
  return parseISO(s).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function dataBreve(s) {
  if (!s) return '';
  return parseISO(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function annoScolasticoCorrente() {
  const d = new Date();
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

function saldo() {
  return state.movimenti.reduce((s, m) => s + (m.tipo === 'entrata' ? m.importo : -m.importo), 0);
}

function nomeAlunno(id) {
  return state.alunni.find((a) => a.id === id)?.nome ?? 'Alunno rimosso';
}

function alunniOrdinati() {
  return [...state.alunni].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

async function condividi(testo, titolo = '') {
  if (navigator.share) {
    try {
      await navigator.share({ title: titolo, text: testo });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(testo);
    toast('Testo copiato: incollalo nel gruppo');
  } catch {
    window.open('https://wa.me/?text=' + encodeURIComponent(testo), '_blank');
  }
}

function scarica(nomeFile, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeFile;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Modale generica ---------- */

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modal-form');
let modalOnSubmit = null;

function apriModale({ titolo, corpo, ok = 'Salva', onSubmit, onOpen }) {
  document.getElementById('modal-titolo').textContent = titolo;
  document.getElementById('modal-corpo').innerHTML = corpo;
  document.getElementById('modal-ok').textContent = ok;
  modalOnSubmit = onSubmit;
  modal.showModal();
  onOpen?.(modalForm);
  modalForm.querySelector('input, textarea, select')?.focus();
}

modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const dati = Object.fromEntries(new FormData(modalForm));
  if (modalOnSubmit && modalOnSubmit(dati, modalForm) === false) return;
  modal.close();
  salva();
  render();
});

document.getElementById('modal-annulla').addEventListener('click', () => modal.close());

function campo(label, name, { type = 'text', value = '', required = false, attrs = '' } = {}) {
  const id = 'f-' + name;
  if (type === 'textarea') {
    return `<div class="field"><label for="${id}">${label}</label>
      <textarea id="${id}" name="${name}" ${required ? 'required' : ''} ${attrs}>${esc(value)}</textarea></div>`;
  }
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${attrs}></div>`;
}

function select(label, name, opzioni, value = '') {
  const opts = opzioni.map((o) => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('');
  return `<div class="field"><label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}">${opts}</select></div>`;
}

function conferma(msg) {
  return window.confirm(msg);
}

/* ---------- Navigazione ---------- */

let tab = 'home';
const ui = {
  filtroCassa: 'tutti',
  meseCal: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  giornoSel: oggiISO(),
  raccoltaAperta: null,
};

document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => vai(b.dataset.tab));
});

function vai(t) {
  tab = t;
  ui.raccoltaAperta = null;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  render();
  window.scrollTo(0, 0);
}

function render() {
  const c = state.classe;
  document.getElementById('classe-titolo').textContent = c.nome ? `Classe ${c.nome}` : 'La mia classe';
  document.getElementById('classe-sottotitolo').textContent =
    [c.scuola, c.anno ? `A.S. ${c.anno}` : ''].filter(Boolean).join(' · ') || 'Rappresentante di classe';

  const view = document.getElementById('view');
  view.innerHTML = VISTE[tab]();
  view.querySelectorAll('[data-act]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      AZIONI[el.dataset.act]?.(el.dataset.id, el);
    });
  });
}

/* ============================================================
   VISTE
   ============================================================ */

const VISTE = {
  home() {
    const s = saldo();
    const oggi = oggiISO();
    const prossimi = state.eventi.filter((e) => e.data >= oggi)
      .sort((a, b) => (a.data + (a.ora || '')).localeCompare(b.data + (b.ora || ''))).slice(0, 3);
    const aperte = state.raccolte.filter((r) => !r.chiusa);
    const annunci = annunciOrdinati().slice(0, 2);

    let html = '';
    if (!state.alunni.length && !state.classe.nome) {
      html += `<div class="card"><h2>Benvenuto! 👋</h2>
        <p class="muted" style="margin-top:6px">Inizia impostando i dati della classe e l'elenco degli alunni.</p>
        <div class="btn-row"><button class="btn primary" data-act="vai" data-id="classe">Configura la classe</button></div></div>`;
    }

    html += `<div class="grid2" style="margin-bottom:12px">
      <div class="card stat"><div class="label">Saldo cassa</div>
        <div class="value ${s < 0 ? 'neg' : ''}">${euro(s)}</div></div>
      <div class="card stat"><div class="label">Raccolte aperte</div>
        <div class="value">${aperte.length}</div></div>
    </div>`;

    html += `<div class="card"><div class="section-head"><h2>Prossimi eventi</h2>
      <button class="btn small" data-act="vai" data-id="calendario">Tutti</button></div>`;
    html += prossimi.length ? `<ul class="list">${prossimi.map(rigaEvento).join('')}</ul>`
      : '<p class="muted">Nessun evento in programma.</p>';
    html += '</div>';

    if (aperte.length) {
      html += '<div class="card"><div class="section-head"><h2>Raccolte in corso</h2></div>';
      html += aperte.map((r) => {
        const st = statoRaccolta(r);
        return `<div style="margin-bottom:10px; cursor:pointer" data-act="apriRaccolta" data-id="${r.id}">
          <div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(r.titolo)}</strong>
          <span class="muted">${st.pagati}/${st.totale} pagati</span></div>
          <div class="progress"><div style="width:${st.perc}%"></div></div></div>`;
      }).join('');
      html += '</div>';
    }

    html += `<div class="card"><div class="section-head"><h2>Ultimi annunci</h2>
      <button class="btn small" data-act="vai" data-id="annunci">Tutti</button></div>`;
    html += annunci.length ? annunci.map((a) => `<div style="margin-bottom:10px">
        <strong>${a.fissato ? '📌 ' : ''}${esc(a.titolo)}</strong>
        <p class="muted">${dataBreve(a.data)}</p></div>`).join('')
      : '<p class="muted">Nessun annuncio pubblicato.</p>';
    html += '</div>';
    return html;
  },

  cassa() {
    const s = saldo();
    const entrate = state.movimenti.filter((m) => m.tipo === 'entrata').reduce((t, m) => t + m.importo, 0);
    const uscite = state.movimenti.filter((m) => m.tipo === 'uscita').reduce((t, m) => t + m.importo, 0);
    const lista = state.movimenti
      .filter((m) => ui.filtroCassa === 'tutti' || m.tipo === ui.filtroCassa)
      .sort((a, b) => b.data.localeCompare(a.data) || (b.creato || 0) - (a.creato || 0));

    let html = `<div class="card stat"><div class="label">Saldo attuale</div>
      <div class="value ${s < 0 ? 'neg' : ''}">${euro(s)}</div>
      <p class="muted" style="margin-top:4px">Entrate <span class="pos">${euro(entrate)}</span> · Uscite <span class="neg">${euro(uscite)}</span></p>
      <div class="btn-row">
        <button class="btn primary" data-act="nuovoMovimento" data-id="entrata">+ Entrata</button>
        <button class="btn" data-act="nuovoMovimento" data-id="uscita">− Uscita</button>
        <button class="btn ghost" data-act="esportaCassaCSV">Esporta CSV</button>
        <button class="btn ghost" data-act="condividiRendiconto">Condividi rendiconto</button>
      </div></div>`;

    html += `<div class="filters">${[['tutti', 'Tutti'], ['entrata', 'Entrate'], ['uscita', 'Uscite']]
      .map(([v, t]) => `<button class="chip ${ui.filtroCassa === v ? 'active' : ''}" data-act="filtroCassa" data-id="${v}">${t}</button>`).join('')}</div>`;

    if (!lista.length) return html + '<div class="card empty">Nessun movimento registrato.</div>';

    html += `<div class="card"><ul class="list">${lista.map((m) => `
      <li>
        <div class="grow">
          <div class="title">${esc(m.descrizione)}</div>
          <div class="muted">${dataBreve(m.data)} · ${esc(m.categoria)}${m.raccoltaId ? ' · <span class="badge">raccolta</span>' : ''}</div>
        </div>
        <div class="amount ${m.tipo === 'entrata' ? 'pos' : 'neg'}">${m.tipo === 'entrata' ? '+' : '−'}${euro(m.importo)}</div>
        ${m.raccoltaId ? '' : `<button class="icon-btn" title="Modifica" data-act="modificaMovimento" data-id="${m.id}">✏️</button>`}
      </li>`).join('')}</ul></div>`;
    return html;
  },

  raccolte() {
    if (ui.raccoltaAperta) {
      const r = state.raccolte.find((x) => x.id === ui.raccoltaAperta);
      if (r) return dettaglioRaccolta(r);
    }
    let html = `<div class="section-head"><h2>Raccolte fondi</h2>
      <button class="btn primary" data-act="nuovaRaccolta">+ Nuova</button></div>`;
    if (!state.raccolte.length) {
      return html + `<div class="card empty">Nessuna raccolta.<br>Crea una raccolta per il regalo alle maestre, una gita, la festa di fine anno…</div>`;
    }
    const ordinate = [...state.raccolte].sort((a, b) => (a.chiusa - b.chiusa) || (b.creato - a.creato));
    html += ordinate.map((r) => {
      const st = statoRaccolta(r);
      const scaduta = !r.chiusa && r.scadenza && r.scadenza < oggiISO();
      return `<div class="card" style="cursor:pointer" data-act="apriRaccolta" data-id="${r.id}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
          <h3>${esc(r.titolo)}</h3>
          ${r.chiusa ? '<span class="badge">chiusa</span>' : scaduta ? '<span class="badge red">scaduta</span>'
            : st.pagati === st.totale && st.totale ? '<span class="badge green">completa</span>' : '<span class="badge amber">in corso</span>'}
        </div>
        <p class="muted">${euro(r.quota)} a testa${r.scadenza ? ' · entro ' + dataBreve(r.scadenza) : ''}</p>
        <div class="progress"><div style="width:${st.perc}%"></div></div>
        <p class="muted">${st.pagati}/${st.totale} pagati · raccolti ${euro(st.raccolto)} su ${euro(st.atteso)}</p>
      </div>`;
    }).join('');
    return html;
  },

  calendario() {
    const m = ui.meseCal;
    const primo = new Date(m.getFullYear(), m.getMonth(), 1);
    const offset = (primo.getDay() + 6) % 7; // lunedì = 0
    const inizio = new Date(primo);
    inizio.setDate(1 - offset);
    const giorniConEventi = new Set(state.eventi.map((e) => e.data));
    const oggi = oggiISO();

    let celle = GIORNI.map((g) => `<div class="cal-dow">${g}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = new Date(inizio);
      d.setDate(inizio.getDate() + i);
      const iso = isoData(d);
      const cls = ['cal-day',
        d.getMonth() !== m.getMonth() ? 'other' : '',
        iso === oggi ? 'today' : '',
        iso === ui.giornoSel ? 'selected' : ''].join(' ');
      celle += `<button class="${cls}" data-act="selGiorno" data-id="${iso}">${d.getDate()}${giorniConEventi.has(iso) ? '<span class="dot"></span>' : ''}</button>`;
    }

    const delGiorno = state.eventi.filter((e) => e.data === ui.giornoSel)
      .sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));
    const prossimi = state.eventi.filter((e) => e.data >= oggi)
      .sort((a, b) => (a.data + (a.ora || '')).localeCompare(b.data + (b.ora || ''))).slice(0, 10);

    return `<div class="card">
      <div class="cal-head">
        <button class="icon-btn" data-act="mese" data-id="-1" aria-label="Mese precedente">◀</button>
        <h2 style="text-transform:capitalize">${MESI[m.getMonth()]} ${m.getFullYear()}</h2>
        <button class="icon-btn" data-act="mese" data-id="1" aria-label="Mese successivo">▶</button>
      </div>
      <div class="cal-grid">${celle}</div>
    </div>
    <div class="card">
      <div class="section-head"><h2 style="text-transform:capitalize">${dataLunga(ui.giornoSel)}</h2>
        <button class="btn primary small" data-act="nuovoEvento">+ Evento</button></div>
      ${delGiorno.length ? `<ul class="list">${delGiorno.map(rigaEvento).join('')}</ul>` : '<p class="muted">Nessun evento in questo giorno.</p>'}
    </div>
    <div class="card"><div class="section-head"><h2>Prossimi eventi</h2></div>
      ${prossimi.length ? `<ul class="list">${prossimi.map(rigaEvento).join('')}</ul>` : '<p class="muted">Nessun evento in programma.</p>'}
    </div>`;
  },

  annunci() {
    let html = `<div class="section-head"><h2>Annunci</h2>
      <button class="btn primary" data-act="nuovoAnnuncio">+ Nuovo</button></div>`;
    const lista = annunciOrdinati();
    if (!lista.length) return html + '<div class="card empty">Nessun annuncio. Scrivi il primo comunicato per i genitori!</div>';
    html += lista.map((a) => `<div class="card annuncio ${a.fissato ? 'fissato' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div><h3>${a.fissato ? '📌 ' : ''}${esc(a.titolo)}</h3><p class="muted">${dataLunga(a.data)}</p></div>
        <button class="icon-btn" title="Modifica" data-act="modificaAnnuncio" data-id="${a.id}">✏️</button>
      </div>
      <p class="testo">${esc(a.testo)}</p>
      <div class="btn-row">
        <button class="btn small" data-act="condividiAnnuncio" data-id="${a.id}">Condividi</button>
        <button class="btn small ghost" data-act="fissaAnnuncio" data-id="${a.id}">${a.fissato ? 'Sblocca' : 'Fissa in alto'}</button>
      </div></div>`).join('');
    return html;
  },

  classe() {
    const c = state.classe;
    const alunni = alunniOrdinati();
    return `<div class="card">
      <div class="section-head"><h2>Dati della classe</h2>
        <button class="btn small" data-act="modificaClasse">Modifica</button></div>
      <p><strong>Classe:</strong> ${esc(c.nome) || '—'}<br>
      <strong>Scuola:</strong> ${esc(c.scuola) || '—'}<br>
      <strong>Anno scolastico:</strong> ${esc(c.anno) || '—'}</p>
    </div>
    <div class="card">
      <div class="section-head"><h2>Alunni (${alunni.length})</h2>
        <div style="display:flex;gap:6px">
          <button class="btn small" data-act="importaAlunni">Incolla elenco</button>
          <button class="btn primary small" data-act="nuovoAlunno">+ Alunno</button>
        </div></div>
      ${alunni.length ? `<ul class="list">${alunni.map((a) => `<li>
          <div class="grow"><div class="title">${esc(a.nome)}</div>
          <div class="muted">${[a.genitore, a.telefono, a.email].filter(Boolean).map(esc).join(' · ') || 'Nessun contatto'}</div></div>
          ${a.telefono ? `<a class="icon-btn" href="tel:${esc(a.telefono.replace(/\s/g, ''))}" title="Chiama">📞</a>` : ''}
          <button class="icon-btn" title="Modifica" data-act="modificaAlunno" data-id="${a.id}">✏️</button>
        </li>`).join('')}</ul>` : '<p class="muted">Nessun alunno inserito.</p>'}
    </div>
    <div class="card">
      <h2>Backup dei dati</h2>
      <p class="muted" style="margin-top:6px">I dati sono salvati solo su questo dispositivo. Esporta un backup regolarmente o per trasferirli su un altro telefono/computer.</p>
      <div class="btn-row">
        <button class="btn" data-act="esportaBackup">Esporta backup</button>
        <button class="btn" data-act="importaBackup">Importa backup</button>
        <button class="btn danger ghost" data-act="cancellaTutto">Cancella tutto</button>
      </div>
    </div>`;
  },
};

/* ---------- Helper viste ---------- */

function rigaEvento(e) {
  const d = parseISO(e.data);
  return `<li>
    <div class="date-box"><div class="d">${d.getDate()}</div><div class="m">${MESI[d.getMonth()].slice(0, 3)}</div></div>
    <div class="grow"><div class="title">${esc(e.titolo)}</div>
      <div class="muted">${[e.ora, e.luogo].filter(Boolean).map(esc).join(' · ') || 'Tutto il giorno'}</div>
      ${e.note ? `<div class="muted">${esc(e.note)}</div>` : ''}</div>
    <button class="icon-btn" title="Condividi" data-act="condividiEvento" data-id="${e.id}">📤</button>
    <button class="icon-btn" title="Modifica" data-act="modificaEvento" data-id="${e.id}">✏️</button>
  </li>`;
}

function annunciOrdinati() {
  return [...state.annunci].sort((a, b) => (b.fissato - a.fissato) || b.data.localeCompare(a.data) || (b.creato - a.creato));
}

function statoRaccolta(r) {
  const partecipanti = r.partecipanti.filter((id) => state.alunni.some((a) => a.id === id));
  const pagati = partecipanti.filter((id) => r.pagamenti[id]).length;
  const raccolto = Object.values(r.pagamenti).reduce((t, p) => t + p.importo, 0);
  const atteso = partecipanti.length * r.quota;
  return {
    partecipanti, pagati, totale: partecipanti.length, raccolto, atteso,
    perc: partecipanti.length ? Math.round((pagati / partecipanti.length) * 100) : 0,
  };
}

function dettaglioRaccolta(r) {
  const st = statoRaccolta(r);
  const righe = st.partecipanti
    .map((id) => state.alunni.find((a) => a.id === id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    .map((a) => {
      const p = r.pagamenti[a.id];
      return `<li><div class="grow"><div class="title">${esc(a.nome)}</div>
        <div class="muted">${p ? `Pagato ${euro(p.importo)} il ${dataBreve(p.data)}` : esc(a.genitore || '')}</div></div>
        <button class="pay-toggle ${p ? 'paid' : ''}" data-act="togglePagamento" data-id="${a.id}" ${r.chiusa ? 'disabled' : ''}>
          ${p ? '✓ Pagato' : 'Da pagare'}</button></li>`;
    }).join('');

  return `<button class="btn ghost small" data-act="chiudiDettaglio">← Raccolte</button>
    <div class="card" style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <h2>${esc(r.titolo)}</h2>
        <button class="icon-btn" title="Modifica" data-act="modificaRaccolta" data-id="${r.id}">✏️</button>
      </div>
      ${r.descrizione ? `<p style="white-space:pre-wrap;margin:8px 0">${esc(r.descrizione)}</p>` : ''}
      <p class="muted">${euro(r.quota)} a testa${r.scadenza ? ' · scadenza ' + dataLunga(r.scadenza) : ''}</p>
      <div class="progress"><div style="width:${st.perc}%"></div></div>
      <p class="muted">${st.pagati}/${st.totale} pagati · raccolti <strong>${euro(st.raccolto)}</strong> su ${euro(st.atteso)}</p>
      <div class="btn-row">
        <button class="btn" data-act="sollecitoRaccolta" data-id="${r.id}" ${st.pagati === st.totale ? 'disabled' : ''}>Invia promemoria</button>
        <button class="btn ghost" data-act="chiudiRaccolta" data-id="${r.id}">${r.chiusa ? 'Riapri' : 'Chiudi raccolta'}</button>
      </div>
    </div>
    <div class="card"><h2>Partecipanti</h2>
      ${righe ? `<ul class="list">${righe}</ul>` : '<p class="muted">Nessun partecipante: aggiungi gli alunni nella sezione Classe.</p>'}
    </div>`;
}

/* ============================================================
   AZIONI
   ============================================================ */

const AZIONI = {
  vai: (t) => vai(t),

  /* --- Cassa --- */
  filtroCassa(v) { ui.filtroCassa = v; render(); },
  nuovoMovimento(tipo) { formMovimento({ tipo, data: oggiISO() }); },
  modificaMovimento(id) { formMovimento(state.movimenti.find((m) => m.id === id)); },

  esportaCassaCSV() {
    const righe = [['Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo']];
    [...state.movimenti].sort((a, b) => a.data.localeCompare(b.data)).forEach((m) => {
      righe.push([m.data, m.tipo, m.categoria, m.descrizione,
        (m.tipo === 'entrata' ? m.importo : -m.importo).toFixed(2).replace('.', ',')]);
    });
    const csv = righe.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    scarica(`cassa-classe-${oggiISO()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  },

  condividiRendiconto() {
    const ent = state.movimenti.filter((m) => m.tipo === 'entrata').reduce((t, m) => t + m.importo, 0);
    const usc = state.movimenti.filter((m) => m.tipo === 'uscita');
    const totUsc = usc.reduce((t, m) => t + m.importo, 0);
    let testo = `💶 *Rendiconto cassa${state.classe.nome ? ' classe ' + state.classe.nome : ''}* (al ${dataBreve(oggiISO())})\n\n`;
    testo += `Entrate: ${euro(ent)}\nUscite: ${euro(totUsc)}\n*Saldo: ${euro(saldo())}*\n`;
    if (usc.length) {
      testo += '\nDettaglio spese:\n' + [...usc].sort((a, b) => a.data.localeCompare(b.data))
        .map((m) => `• ${dataBreve(m.data)} – ${m.descrizione}: ${euro(m.importo)}`).join('\n');
    }
    condividi(testo, 'Rendiconto cassa');
  },

  /* --- Raccolte --- */
  nuovaRaccolta() { formRaccolta(); },
  modificaRaccolta(id) { formRaccolta(state.raccolte.find((r) => r.id === id)); },
  apriRaccolta(id) {
    if (tab !== 'raccolte') {
      tab = 'raccolte';
      document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'raccolte'));
    }
    ui.raccoltaAperta = id; render(); window.scrollTo(0, 0);
  },
  chiudiDettaglio() { ui.raccoltaAperta = null; render(); },

  togglePagamento(alunnoId) {
    const r = state.raccolte.find((x) => x.id === ui.raccoltaAperta);
    const p = r.pagamenti[alunnoId];
    if (p) {
      if (!conferma(`Annullare il pagamento di ${nomeAlunno(alunnoId)}?`)) return;
      state.movimenti = state.movimenti.filter((m) => m.id !== p.movimentoId);
      delete r.pagamenti[alunnoId];
      salva(); render();
      return;
    }
    apriModale({
      titolo: `Pagamento di ${nomeAlunno(alunnoId)}`,
      ok: 'Registra',
      corpo: `<div class="row2">${campo('Importo (€)', 'importo', { type: 'number', value: r.quota, required: true, attrs: 'step="0.01" min="0.01"' })}
        ${campo('Data', 'data', { type: 'date', value: oggiISO(), required: true })}</div>`,
      onSubmit(d) {
        const importo = Math.round(parseFloat(d.importo) * 100) / 100;
        const mov = {
          id: uid(), creato: Date.now(), tipo: 'entrata', importo, data: d.data,
          categoria: 'Raccolta fondi', descrizione: `${r.titolo} – ${nomeAlunno(alunnoId)}`, raccoltaId: r.id,
        };
        state.movimenti.push(mov);
        r.pagamenti[alunnoId] = { importo, data: d.data, movimentoId: mov.id };
      },
    });
  },

  sollecitoRaccolta(id) {
    const r = state.raccolte.find((x) => x.id === id);
    const mancanti = statoRaccolta(r).partecipanti.filter((a) => !r.pagamenti[a]).map(nomeAlunno)
      .sort((a, b) => a.localeCompare(b, 'it'));
    let testo = `🔔 *Promemoria: ${r.titolo}*\n\nGentili genitori, ricordo la quota di ${euro(r.quota)}`;
    testo += r.scadenza ? ` da versare entro ${dataLunga(r.scadenza)}.` : '.';
    if (r.descrizione) testo += `\n\n${r.descrizione}`;
    testo += `\n\nMancano ancora:\n${mancanti.map((n) => '• ' + n).join('\n')}\n\nGrazie!`;
    condividi(testo, r.titolo);
  },

  chiudiRaccolta(id) {
    const r = state.raccolte.find((x) => x.id === id);
    r.chiusa = !r.chiusa;
    salva(); render();
  },

  /* --- Calendario --- */
  mese(delta) {
    ui.meseCal = new Date(ui.meseCal.getFullYear(), ui.meseCal.getMonth() + Number(delta), 1);
    render();
  },
  selGiorno(iso) {
    ui.giornoSel = iso;
    const d = parseISO(iso);
    if (d.getMonth() !== ui.meseCal.getMonth()) ui.meseCal = new Date(d.getFullYear(), d.getMonth(), 1);
    render();
  },
  nuovoEvento() { formEvento({ data: ui.giornoSel }); },
  modificaEvento(id) { formEvento(state.eventi.find((e) => e.id === id)); },
  condividiEvento(id) {
    const e = state.eventi.find((x) => x.id === id);
    let testo = `📅 *${e.titolo}*\n${dataLunga(e.data)}${e.ora ? ' ore ' + e.ora : ''}`;
    if (e.luogo) testo += `\n📍 ${e.luogo}`;
    if (e.note) testo += `\n\n${e.note}`;
    condividi(testo, e.titolo);
  },

  /* --- Annunci --- */
  nuovoAnnuncio() { formAnnuncio(); },
  modificaAnnuncio(id) { formAnnuncio(state.annunci.find((a) => a.id === id)); },
  fissaAnnuncio(id) {
    const a = state.annunci.find((x) => x.id === id);
    a.fissato = !a.fissato;
    salva(); render();
  },
  condividiAnnuncio(id) {
    const a = state.annunci.find((x) => x.id === id);
    condividi(`📣 *${a.titolo}*\n\n${a.testo}`, a.titolo);
  },

  /* --- Classe --- */
  modificaClasse() {
    const c = state.classe;
    apriModale({
      titolo: 'Dati della classe',
      corpo: campo('Classe (es. 3ª B)', 'nome', { value: c.nome })
        + campo('Scuola', 'scuola', { value: c.scuola })
        + campo('Anno scolastico', 'anno', { value: c.anno }),
      onSubmit(d) { state.classe = { nome: d.nome.trim(), scuola: d.scuola.trim(), anno: d.anno.trim() }; },
    });
  },
  nuovoAlunno() { formAlunno(); },
  modificaAlunno(id) { formAlunno(state.alunni.find((a) => a.id === id)); },

  importaAlunni() {
    apriModale({
      titolo: 'Incolla elenco alunni',
      ok: 'Aggiungi',
      corpo: `<p class="muted" style="margin-bottom:10px">Un alunno per riga. Facoltativo: aggiungi genitore e telefono separati da virgola o punto e virgola.<br>Es: <em>Rossi Mario; Anna Rossi; 333 1234567</em></p>
        ${campo('Elenco', 'elenco', { type: 'textarea', required: true })}`,
      onSubmit(d) {
        const nuovi = d.elenco.split('\n').map((r) => r.trim()).filter(Boolean).map((r) => {
          const [nome, genitore = '', telefono = '', email = ''] = r.split(/[;,\t]/).map((s) => s.trim());
          return { id: uid(), nome, genitore, telefono, email };
        }).filter((a) => a.nome);
        state.alunni.push(...nuovi);
        aggiungiAlleRaccolteAperte(nuovi.map((a) => a.id));
        toast(`${nuovi.length} alunni aggiunti`);
      },
    });
  },

  esportaBackup() {
    scarica(`backup-classe-${oggiISO()}.json`, JSON.stringify(state, null, 2), 'application/json');
  },
  importaBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      try {
        const dati = JSON.parse(await input.files[0].text());
        if (!dati || !Array.isArray(dati.alunni) || !Array.isArray(dati.movimenti)) throw new Error();
        if (!conferma('Il backup sostituirà tutti i dati attuali. Continuare?')) return;
        state = { ...statoVuoto(), ...dati };
        salva(); render();
        toast('Backup importato');
      } catch {
        toast('File di backup non valido');
      }
    };
    input.click();
  },
  cancellaTutto() {
    if (!conferma('Cancellare TUTTI i dati della classe? Questa operazione non si può annullare.')) return;
    state = statoVuoto();
    salva(); render();
  },
};

/* ============================================================
   FORM
   ============================================================ */

function formMovimento(m) {
  const nuovo = !m.id;
  const categorie = m.tipo === 'entrata' ? CATEGORIE_ENTRATA : CATEGORIE_USCITA;
  apriModale({
    titolo: `${nuovo ? 'Nuova' : 'Modifica'} ${m.tipo}`,
    corpo: campo('Descrizione', 'descrizione', { value: m.descrizione, required: true })
      + `<div class="row2">${campo('Importo (€)', 'importo', { type: 'number', value: m.importo ?? '', required: true, attrs: 'step="0.01" min="0.01" inputmode="decimal"' })}
        ${campo('Data', 'data', { type: 'date', value: m.data, required: true })}</div>`
      + select('Categoria', 'categoria', categorie, m.categoria)
      + (nuovo ? '' : '<button type="button" class="btn danger ghost" id="elimina">Elimina movimento</button>'),
    onOpen(f) {
      f.querySelector('#elimina')?.addEventListener('click', () => {
        if (!conferma('Eliminare questo movimento?')) return;
        state.movimenti = state.movimenti.filter((x) => x.id !== m.id);
        modal.close(); salva(); render();
      });
    },
    onSubmit(d) {
      const dati = {
        tipo: m.tipo, descrizione: d.descrizione.trim(), data: d.data, categoria: d.categoria,
        importo: Math.round(parseFloat(d.importo) * 100) / 100,
      };
      if (nuovo) state.movimenti.push({ id: uid(), creato: Date.now(), ...dati });
      else Object.assign(m, dati);
    },
  });
}

function formRaccolta(r) {
  const nuovo = !r;
  r = r || { titolo: '', descrizione: '', quota: '', scadenza: '' };
  apriModale({
    titolo: nuovo ? 'Nuova raccolta fondi' : 'Modifica raccolta',
    corpo: campo('Titolo', 'titolo', { value: r.titolo, required: true, attrs: 'placeholder="Es. Regalo di Natale maestre"' })
      + campo('Descrizione', 'descrizione', { type: 'textarea', value: r.descrizione })
      + `<div class="row2">${campo('Quota a testa (€)', 'quota', { type: 'number', value: r.quota, required: true, attrs: 'step="0.01" min="0.01" inputmode="decimal"' })}
        ${campo('Scadenza', 'scadenza', { type: 'date', value: r.scadenza })}</div>`
      + (nuovo ? `<p class="muted">Tutti gli alunni (${state.alunni.length}) saranno inclusi come partecipanti.</p>`
        : '<button type="button" class="btn danger ghost" id="elimina">Elimina raccolta</button>'),
    onOpen(f) {
      f.querySelector('#elimina')?.addEventListener('click', () => {
        if (!conferma('Eliminare la raccolta? Verranno rimossi anche i pagamenti registrati in cassa.')) return;
        state.movimenti = state.movimenti.filter((m) => m.raccoltaId !== r.id);
        state.raccolte = state.raccolte.filter((x) => x.id !== r.id);
        ui.raccoltaAperta = null;
        modal.close(); salva(); render();
      });
    },
    onSubmit(d) {
      const dati = {
        titolo: d.titolo.trim(), descrizione: d.descrizione.trim(), scadenza: d.scadenza,
        quota: Math.round(parseFloat(d.quota) * 100) / 100,
      };
      if (nuovo) {
        const id = uid();
        state.raccolte.push({ id, creato: Date.now(), chiusa: false, pagamenti: {},
          partecipanti: state.alunni.map((a) => a.id), ...dati });
        ui.raccoltaAperta = id;
      } else {
        Object.assign(r, dati);
        // Aggiorna la descrizione dei movimenti collegati
        state.movimenti.filter((m) => m.raccoltaId === r.id).forEach((m) => {
          const alunnoId = Object.keys(r.pagamenti).find((k) => r.pagamenti[k].movimentoId === m.id);
          m.descrizione = `${r.titolo} – ${nomeAlunno(alunnoId)}`;
        });
      }
    },
  });
}

function formEvento(e) {
  const nuovo = !e.id;
  apriModale({
    titolo: nuovo ? 'Nuovo evento' : 'Modifica evento',
    corpo: campo('Titolo', 'titolo', { value: e.titolo, required: true, attrs: 'placeholder="Es. Colloqui con i docenti"' })
      + `<div class="row2">${campo('Data', 'data', { type: 'date', value: e.data, required: true })}
        ${campo('Ora', 'ora', { type: 'time', value: e.ora })}</div>`
      + campo('Luogo', 'luogo', { value: e.luogo })
      + campo('Note', 'note', { type: 'textarea', value: e.note })
      + (nuovo ? '' : `<div class="btn-row" style="margin-bottom:8px">
          <button type="button" class="btn" id="ics">Aggiungi al mio calendario</button>
          <button type="button" class="btn danger ghost" id="elimina">Elimina</button></div>`),
    onOpen(f) {
      f.querySelector('#elimina')?.addEventListener('click', () => {
        if (!conferma('Eliminare questo evento?')) return;
        state.eventi = state.eventi.filter((x) => x.id !== e.id);
        modal.close(); salva(); render();
      });
      f.querySelector('#ics')?.addEventListener('click', () => scaricaICS(e));
    },
    onSubmit(d) {
      const dati = { titolo: d.titolo.trim(), data: d.data, ora: d.ora, luogo: d.luogo.trim(), note: d.note.trim() };
      if (nuovo) state.eventi.push({ id: uid(), ...dati });
      else Object.assign(e, dati);
      ui.giornoSel = d.data;
      const g = parseISO(d.data);
      ui.meseCal = new Date(g.getFullYear(), g.getMonth(), 1);
    },
  });
}

function scaricaICS(e) {
  const pulisci = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const giorno = e.data.replace(/-/g, '');
  let dt;
  if (e.ora) {
    const inizio = giorno + 'T' + e.ora.replace(':', '') + '00';
    const [h, m] = e.ora.split(':').map(Number);
    const fine = giorno + 'T' + String(Math.min(h + 1, 23)).padStart(2, '0') + String(m).padStart(2, '0') + '00';
    dt = `DTSTART:${inizio}\r\nDTEND:${fine}`;
  } else {
    const dopo = parseISO(e.data);
    dopo.setDate(dopo.getDate() + 1);
    dt = `DTSTART;VALUE=DATE:${giorno}\r\nDTEND;VALUE=DATE:${isoData(dopo).replace(/-/g, '')}`;
  }
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rappresentante di Classe//IT', 'BEGIN:VEVENT',
    `UID:${e.id}@rappresentante-classe`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    dt, `SUMMARY:${pulisci(e.titolo)}`, e.luogo ? `LOCATION:${pulisci(e.luogo)}` : '',
    e.note ? `DESCRIPTION:${pulisci(e.note)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  scarica(`${e.titolo.replace(/[^\w\- ]/g, '').trim() || 'evento'}.ics`, ics, 'text/calendar');
}

function formAnnuncio(a) {
  const nuovo = !a;
  a = a || { titolo: '', testo: '', fissato: false };
  apriModale({
    titolo: nuovo ? 'Nuovo annuncio' : 'Modifica annuncio',
    corpo: campo('Titolo', 'titolo', { value: a.titolo, required: true })
      + campo('Testo', 'testo', { type: 'textarea', value: a.testo, required: true, attrs: 'rows="7"' })
      + `<div class="field inline"><input type="checkbox" id="f-fissato" name="fissato" ${a.fissato ? 'checked' : ''}>
         <label for="f-fissato">Fissa in alto</label></div>`
      + (nuovo ? '' : '<button type="button" class="btn danger ghost" id="elimina">Elimina annuncio</button>'),
    onOpen(f) {
      f.querySelector('#elimina')?.addEventListener('click', () => {
        if (!conferma('Eliminare questo annuncio?')) return;
        state.annunci = state.annunci.filter((x) => x.id !== a.id);
        modal.close(); salva(); render();
      });
    },
    onSubmit(d) {
      const dati = { titolo: d.titolo.trim(), testo: d.testo.trim(), fissato: !!d.fissato };
      if (nuovo) state.annunci.push({ id: uid(), creato: Date.now(), data: oggiISO(), ...dati });
      else Object.assign(a, dati);
    },
  });
}

function formAlunno(a) {
  const nuovo = !a;
  a = a || { nome: '', genitore: '', telefono: '', email: '' };
  apriModale({
    titolo: nuovo ? 'Nuovo alunno' : 'Modifica alunno',
    corpo: campo('Nome e cognome alunno', 'nome', { value: a.nome, required: true })
      + campo('Genitore di riferimento', 'genitore', { value: a.genitore })
      + `<div class="row2">${campo('Telefono', 'telefono', { type: 'tel', value: a.telefono })}
        ${campo('Email', 'email', { type: 'email', value: a.email })}</div>`
      + (nuovo ? '' : '<button type="button" class="btn danger ghost" id="elimina">Rimuovi alunno</button>'),
    onOpen(f) {
      f.querySelector('#elimina')?.addEventListener('click', () => {
        if (!conferma(`Rimuovere ${a.nome}? I pagamenti già registrati in cassa resteranno.`)) return;
        state.alunni = state.alunni.filter((x) => x.id !== a.id);
        state.raccolte.forEach((r) => { r.partecipanti = r.partecipanti.filter((id) => id !== a.id); });
        modal.close(); salva(); render();
      });
    },
    onSubmit(d) {
      const dati = { nome: d.nome.trim(), genitore: d.genitore.trim(), telefono: d.telefono.trim(), email: d.email.trim() };
      if (nuovo) {
        const id = uid();
        state.alunni.push({ id, ...dati });
        aggiungiAlleRaccolteAperte([id]);
      } else {
        Object.assign(a, dati);
      }
    },
  });
}

function aggiungiAlleRaccolteAperte(ids) {
  state.raccolte.filter((r) => !r.chiusa).forEach((r) => {
    ids.forEach((id) => { if (!r.partecipanti.includes(id)) r.partecipanti.push(id); });
  });
}

/* ---------- Avvio ---------- */

render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
