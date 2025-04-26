// script.js (using N3.js)

import { Parser } from 'https://cdn.jsdelivr.net/npm/n3@1.15.0/+esm';

const TTL_URL = new URL('data/DE-BIAS_vocabulary.ttl', window.location.href).href;

// Predicates of interest
const NS = {
  type:         'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  title:        'http://purl.org/dc/terms/title',
  desc:         'http://purl.org/dc/terms/description',
  hasTerm:      'http://data.europa.eu/c4p/ontology#hasContentiousTerm',
  hasSuggest:   'http://data.europa.eu/c4p/ontology#hasSuggestedTerm',
  concept:      'http://www.w3.org/2004/02/skos/core#Concept',
  literalForm:  'http://www.w3.org/2008/05/skos-xl#literalForm'
};

// Simple groupBy
function groupBy(arr, fn) {
  return arr.reduce((map, item) => {
    const key = fn(item);
    ;(map[key] = map[key] || []).push(item);
    return map;
  }, {});
}

async function main() {
  // 1) load and parse the TTL
  const resp = await fetch(TTL_URL);
  if (!resp.ok) throw new Error(`Failed to fetch TTL (${resp.status})`);
  const ttl   = await resp.text();
  const parser = new Parser({ format: 'text/turtle' });
  const triples = parser.parse(ttl);

  // 2) index by subject
  const bySubject = groupBy(triples, t => t.subject.id);

  // 3) find only real term URIs (hasContentiousTerm)
  const termUris = new Set(
    triples
      .filter(t => t.predicate.id === NS.hasTerm)
      .map(t => t.subject.id)
  );

  // 4) build concept objects
  const concepts = Array.from(termUris).map(uri => {
    const ts = bySubject[uri] || [];
    // labels
    const labels = ts
      .filter(t => t.predicate.id === NS.title)
      .map(t => t.object.value);
    // languages
    const langs = Array.from(new Set(
      ts.filter(t => t.predicate.id === NS.title)
        .map(t => t.object.language).filter(Boolean)
    ));
    // description
    const descTriple = ts.find(t => t.predicate.id === NS.desc);
    const description = descTriple ? descTriple.object.value : '';
    // suggested-term URIs
    const sugUris = ts
      .filter(t => t.predicate.id === NS.hasSuggest)
      .map(t => t.object.id);
    // suggested labels: literalForm → title → fallback
    const suggested = sugUris.map(su => {
      const sTs = bySubject[su] || [];
      const lf = sTs.find(t => t.predicate.id === NS.literalForm);
      if (lf && lf.object.value) return lf.object.value;
      const tt = sTs.find(t => t.predicate.id === NS.title);
      if (tt && tt.object.value) return tt.object.value;
      return su.split('/').pop();
    });

    return {
      id:          uri.split('/').pop(),
      labels, langs, description, suggested
    };
  });

  // 5) render the table
  const tbody = document.querySelector('#term-table tbody');
  tbody.innerHTML = concepts.map(c => `
    <tr>
      <td><a href="http://data.europa.eu/c4p/data/${c.id}" target="_blank">${c.id}</a></td>
      <td>${c.langs.join(', ')}</td>
      <td>${c.labels.join('<br>')}</td>
      <td>${c.description || '<em>–</em>'}</td>
      <td>${c.suggested.length ? c.suggested.join('<br>') : '<em>–</em>'}</td>
    </tr>
  `).join('');

  // 6) render metadata (last modified)
  const modT = triples.find(t => 
    t.predicate.id === 'http://purl.org/dc/terms/modified' &&
    t.object.termType === 'Literal'
  );
  if (modT) {
    document.getElementById('dataset-meta').innerText =
      `Vocabulary last modified: ${modT.object.value}`;
  }

  // 7) activate DataTables
  $(document).ready(() => {
    $('#term-table').DataTable({ pageLength: 25 });
  });
}

main().catch(err => {
  console.error(err);
  document.querySelector('main').innerHTML = `
    <p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>
  `;
});
