const DATA_URL = 'https://op.europa.eu/o/opendata/ubu/de-bias-vocabulary.ttl';
const FALLBACK_KEY = 'debias-fallback';

async function loadData() {
  const store = $rdf.graph();
  const fetcher = new $rdf.Fetcher(store);

  const statusEl = document.getElementById('status');

  try {
    await fetcher.load(DATA_URL);
    localStorage.setItem(FALLBACK_KEY, store.toNT());
    const now = new Date().toLocaleString();
    statusEl.innerText = `✅ Live data loaded successfully (${now})`;
    displayData(store);
  } catch (error) {
    statusEl.innerHTML = `⚠️ Failed to load live data. Using cached fallback.`;

    const cached = localStorage.getItem(FALLBACK_KEY);
    if (cached) {
      const parser = new $rdf.N3Parser($rdf.graph());
      parser.parse(cached, store, DATA_URL, 'text/turtle');
      displayData(store);
    } else {
      statusEl.innerText += ' No cached version available.';
    }
  }
}

function displayData(store) {
  const ns = $rdf.Namespace('http://www.w3.org/2004/02/skos/core#');
  const concepts = store.subjects(ns('prefLabel'), null);

  const tbody = document.querySelector('#term-table tbody');
  tbody.innerHTML = '';

  concepts.forEach((concept) => {
    const label = store.any(concept, ns('prefLabel'));
    const lang = label.lang || '—';
    const altLabels = store.each(concept, ns('altLabel')).map(lit => lit.value).join('; ');
    const def = store.any(concept, ns('definition'))?.value || '';
    const uri = concept.value;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${label.value}</td>
      <td>${lang}</td>
      <td>${altLabels}</td>
      <td>${def}</td>
      <td><a href="${uri}" target="_blank">Link</a></td>
    `;
    tbody.appendChild(tr);
  });

  // search
  document.getElementById('search').addEventListener('input', function () {
    const term = this.value.toLowerCase();
    Array.from(tbody.children).forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

window.onload = loadData;
