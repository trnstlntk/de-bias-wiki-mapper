// script.js (ES module)

import { Parser } from 'https://cdn.jsdelivr.net/npm/n3@1.15.0/+esm';

// TTL location
const TTL_URL = new URL('data/DE-BIAS_vocabulary.ttl', window.location.href).href;

// Predicates we need
const NS = {
  title:       'http://purl.org/dc/terms/title',
  desc:        'http://purl.org/dc/terms/description',
  hasTerm:     'http://data.europa.eu/c4p/ontology#hasContentiousTerm',
  hasSuggest:  'http://data.europa.eu/c4p/ontology#hasSuggestedTerm',
  modified:    'http://purl.org/dc/terms/modified',
  literalForm: 'http://www.w3.org/2008/05/skos-xl#literalForm'
};

// Simple grouping helper
function groupBy(arr, fn) {
  return arr.reduce((map, item) => {
    const key = fn(item);
    (map[key] = map[key] || []).push(item);
    return map;
  }, {});
}

async function main() {
  // 1) Fetch & parse TTL
  const res     = await fetch(TTL_URL);
  const ttlText = await res.text();
  const parser  = new Parser({ format: 'text/turtle' });
  const triples = parser.parse(ttlText);

  // 2) Group triples by subject URI
  const bySubj = groupBy(triples, t => t.subject.id);

  // 3) Identify real term URIs (hasContentiousTerm)
  const termUris = new Set(
    triples
      .filter(t => t.predicate.id === NS.hasTerm)
      .map(t => t.subject.id)
  );

  // 4) Build concept objects
  const concepts = Array.from(termUris).map(uri => {
    const ts = bySubj[uri] || [];

    // Labels & langs
    const labels = ts
      .filter(t => t.predicate.id === NS.title)
      .map(t => ({ value: t.object.value, lang: t.object.language }));
    const langs  = [...new Set(labels.map(l => l.lang))];

    // Description
    const descT   = ts.find(t => t.predicate.id === NS.desc);
    const desc    = descT ? descT.object.value : '';

    // Suggested Terms: literalForm -> title -> fallback
    const sugUris = ts
      .filter(t => t.predicate.id === NS.hasSuggest)
      .map(t => t.object.id);
    const suggested = sugUris.map(su => {
      const sTs  = bySubj[su] || [];
      const lf   = sTs.find(t => t.predicate.id === NS.literalForm);
      if (lf) return lf.object.value;
      const tt   = sTs.find(t => t.predicate.id === NS.title);
      if (tt) return tt.object.value;
      return su.split('/').pop();
    });

    return {
      id:          uri.split('/').pop(),
      labels, langs, description: desc, suggested
    };
  });

  // 5) Populate HTML table
  const $table = $('#term-table');
  const tbody  = $table.find('tbody').empty();
  concepts.forEach(c => {
    tbody.append(`
      <tr>
        <td><a href="http://data.europa.eu/c4p/data/${c.id}"
               target="_blank">${c.id}</a></td>
        <td>${c.langs.join(', ')}</td>
        <td>${c.labels.map(l=>l.value).join('<br>')}</td>
        <td>${c.description || '<em>–</em>'}</td>
        <td>${c.suggested.length 
               ? c.suggested.join('<br>') 
               : '<em>–</em>'}</td>
      </tr>
    `);
  });

  // 6) Show last modified
  const modT = triples.find(t => t.predicate.id === NS.modified
                               && t.object.termType === 'Literal');
  if (modT) {
    document.getElementById('dataset-meta').innerText =
      `Vocabulary last modified: ${modT.object.value}`;
  } else {
    document.getElementById('dataset-meta').innerText = '';
  }

  // 7) Initialize DataTable with CSV button, default sort, and add custom language filter
  const dataTable = $table.DataTable({
    order: [
      [1, 'asc'], // Languages
      [2, 'asc']  // Labels
    ],
    dom: 'Bfrtip',
    buttons: [
      {
        extend: 'csvHtml5',
        text: 'Download current selection as CSV',
        filename: 'de-bias-terms',
        exportOptions: {
          columns: ':visible'
        }
      }
    ],
    pageLength: 25
  });

  // 8) Language filter logic
  $('#lang-filter input[type=checkbox]').on('change', function() {
    // Collect selected langs
    const selected = $('#lang-filter input:checked')
      .map((i,el) => el.value)
      .get();
    // Custom search function: row whose Languages cell includes any selected lang
    $.fn.dataTable.ext.search.push((settings, rowData) => {
      const langsCell = rowData[1]; // the Languages column
      return selected.some(l => langsCell.split(', ').includes(l));
    });
    dataTable.draw();
    // Remove this custom filter so it doesn't stack
    $.fn.dataTable.ext.search.pop();
  });
}

main().catch(err => {
  console.error(err);
  document.querySelector('main').innerHTML = `
    <p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>
  `;
});
