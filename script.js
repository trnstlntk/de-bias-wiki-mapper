// script.js
import { Parser } from 'https://cdn.jsdelivr.net/npm/n3@1.15.0/+esm';

const TTL_URL = new URL('data/DE-BIAS_vocabulary.ttl', window.location.href).href;

// Predicates we care about
const NS = {
  type:        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  title:       'http://purl.org/dc/terms/title',
  desc:        'http://purl.org/dc/terms/description',
  hasTerm:     'http://data.europa.eu/c4p/ontology#hasContentiousTerm',
  hasSuggest:  'http://data.europa.eu/c4p/ontology#hasSuggestedTerm',
  concept:     'http://www.w3.org/2004/02/skos/core#Concept'
};

// Helper: group by key
function groupBy(arr, keyFn) {
  return arr.reduce((m, item) => {
    const key = keyFn(item);
    (m[key] || (m[key] = [])).push(item);
    return m;
  }, {});
}

async function main() {
  // 1) Fetch TTL text
  const resp = await fetch(TTL_URL);
  if (!resp.ok) throw new Error(`Failed to fetch TTL: ${resp.status}`);
  const ttl = await resp.text();

  // 2) Parse into triples
  const parser = new Parser({ format: 'text/turtle' });
  const triples = parser.parse(ttl);

  // 3) Index triples by subject
  const bySubject = groupBy(triples, t => t.subject.id);

  // 4) Find all real term subjects:
  //    those that appear as subject in a hasContentiousTerm triple
  const realTerms = new Set(
    triples
      .filter(t => t.predicate.id === NS.hasTerm)
      .map(t => t.subject.id)
  );

  // 5) Build concept objects
  const concepts = Array.from(realTerms).map(uri => {
    const ts = bySubject[uri] || [];
    // Labels: all dct:title
    const labels = ts
      .filter(t => t.predicate.id === NS.title)
      .map(t => ({ value: t.object.value, lang: t.object.language }));
    // Languages present:
    const langs = Array.from(new Set(labels.map(l => l.lang).filter(Boolean)));
    // Description: first dct:description
    const descTriple = ts.find(t => t.predicate.id === NS.desc);
    const description = descTriple ? descTriple.object.value : '';
    // Suggested URIs & labels: 
    const sugUris = ts
      .filter(t => t.predicate.id === NS.hasSuggest)
      .map(t => t.object.id);
    const suggested = sugUris.map(su => {
      const sugTriples = bySubject[su]||[];
      const titleT = sugTriples.find(t => t.predicate.id === NS.title);
      return titleT ? titleT.object.value : su.split('/').pop();
    });

    return {
      id: uri.split('/').pop(),
      labels, langs, description, suggested
    };
  });

  // 6) Render metadata
  //    Look for a global dct:modified triple on the scheme node
  const metaTriple = triples.find(t => t.predicate.id === 'http://purl.org/dc/terms/modified'
                                     && t.object.termType === 'Literal');
  if (metaTriple) {
    document.getElementById('dataset-meta').innerText =
      `Vocabulary last modified: ${metaTriple.object.value}`;
  } else {
    document.getElementById('dataset-meta').innerText = '';
  }

  // 7) Render table
  const tbody = document.querySelector('#term-table tbody');
  tbody.innerHTML = concepts.map(c => `
    <tr>
      <td><a href="http://data.europa.eu/c4p/data/${c.id}" target="_blank">${c.id}</a></td>
      <td>${c.langs.join(', ')}</td>
      <td>${c.labels.map(l=>l.value).join('<br>')}</td>
      <td>${c.description || '<em>–</em>'}</td>
      <td>${c.suggested.length 
             ? c.suggested.join('<br>') 
             : '<em>–</em>'}</td>
    </tr>
  `).join('');

  // 8) Activate DataTables
  $(document).ready(() => {
    $('#term-table').DataTable({
      pageLength: 25
    });
  });
}

// Kick off
main().catch(err => {
  console.error(err);
  document.querySelector('main').innerHTML = 
    `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
});
