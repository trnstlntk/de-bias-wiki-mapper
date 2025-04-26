// script.js (ES module)

import { Parser } from 'https://cdn.jsdelivr.net/npm/n3@1.15.0/+esm';

const TTL_URL = new URL('data/DE-BIAS_vocabulary.ttl', window.location.href).href;

// Predicates to extract
const NS = {
  title:       'http://purl.org/dc/terms/title',
  desc:        'http://purl.org/dc/terms/description',
  hasTerm:     'http://data.europa.eu/c4p/ontology#hasContentiousTerm',
  hasSuggest:  'http://data.europa.eu/c4p/ontology#hasSuggestedTerm',
  modified:    'http://purl.org/dc/terms/modified',
  literalForm: 'http://www.w3.org/2008/05/skos-xl#literalForm'
};

// Group triples by a key function
function groupBy(arr, fn) {
  return arr.reduce((map, item) => {
    const key = fn(item);
    (map[key] = map[key] || []).push(item);
    return map;
  }, {});
}

async function main() {
  // 1) Fetch & parse the TTL file
  const resp     = await fetch(TTL_URL);
  if (!resp.ok) throw new Error(`Failed to load TTL (${resp.status})`);
  const text     = await resp.text();
  const parser   = new Parser({ format: 'text/turtle' });
  const triples  = parser.parse(text);

  // 2) Index triples by subject URI
  const bySubj = groupBy(triples, t => t.subject.id);

  // 3) Identify only real term URIs
  const termUris = new Set(
    triples
      .filter(t => t.predicate.id === NS.hasTerm)
      .map(t => t.subject.id)
  );

  // 4) Build our concept objects
  const concepts = Array.from(termUris).map(uri => {
    const ts = bySubj[uri] || [];

    // Labels and languages
    const labels = ts
      .filter(t => t.predicate.id === NS.title)
      .map(t => ({ value: t.object.value, lang: t.object.language }));
    const langs = Array.from(new Set(labels.map(l => l.lang)));

    // Description
    const descT      = ts.find(t => t.predicate.id === NS.desc);
    const description = descT ? descT.object.value : '';

    // Suggested terms
    const sugUris = ts
      .filter(t => t.predicate.id === NS.hasSuggest)
      .map(t => t.object.id);
    const suggested = sugUris.map(su => {
      const sTs = bySubj[su] || [];
      const lf  = sTs.find(t => t.predicate.id === NS.literalForm);
      if (lf) return lf.object.value;
      const tt  = sTs.find(t => t.predicate.id === NS.title);
      if (tt) return tt.object.value;
      return su.split('/').pop();
    });

    return { id: uri, labels, langs, description, suggested };
  });

  // 5) Inject dynamic language filters
  const allLangs = Array.from(new Set(concepts.flatMap(c => c.langs))).sort();
  const labelMap = {
    en: 'English', de: 'Deutsch', nl: 'Nederlands',
    es: 'Español', it: 'Italiano', fr: 'Français'
  };
  const $filter = $('#lang-filter');
  allLangs.forEach(lang => {
    const name = labelMap[lang] || lang;
    $filter.append(`
      <label>
        <input type="checkbox" value="${lang}" checked> ${name}
      </label>
    `);
  });

  // 6) Populate the table
  const $table = $('#term-table');
  const $tbody = $table.find('tbody').empty();
  concepts.forEach(c => {
    $tbody.append(`
      <tr>
        <td><a href="${c.id}" target="_blank">${c.id}</a></td>
        <td>${c.langs.join(', ')}</td>
        <td>${c.labels.map(l => l.value).join('<br>')}</td>
        <td>${c.description || '<em>–</em>'}</td>
        <td>${c.suggested.length
               ? c.suggested.join('<br>')
               : '<em>–</em>'}</td>
      </tr>
    `);
  });

  // 7) Show last modified date
  const modT = triples.find(t =>
    t.predicate.id === NS.modified &&
    t.object.termType === 'Literal'
  );
  if (modT) {
    $('#dataset-meta').text(`Vocabulary last modified: ${modT.object.value}`);
  } else {
    $('#dataset-meta').empty();
  }

  // 8) Initialize DataTables with lengthMenu, sorting, CSV button
  const dt = $table.DataTable({
    dom: 'lBfrtip', // l = lengthMenu, B = buttons, f = filter, r = processing, t = table, i = info, p = paging
    lengthMenu: [[10, 25, 100, -1], [10, 25, 100, 'All']],
    pageLength: 25,
    order: [[1, 'asc'], [2, 'asc']],
    buttons: [{
      extend: 'csvHtml5',
      text: 'Download current selection as CSV',
      filename: 'de-bias-terms',
      exportOptions: {
        columns: ':visible',
        format: {
          body: (data, row, col, node) => {
            if (col === 0) {
              return $('a', node).attr('href');
            }
            return data.replace(/<br\s*\/?>/g, ' ; ');
          }
        }
      }
    }]
  });

  // 9) Apply language-filter logic
  $('#lang-filter input[type=checkbox]').on('change', () => {
    const selected = $('#lang-filter input:checked')
      .map((_, el) => el.value).get();
    $.fn.dataTable.ext.search.push((_, rowData) => 
      selected.some(l => rowData[1].split(', ').includes(l))
    );
    dt.draw();
    $.fn.dataTable.ext.search.pop();
  });
}

main().catch(err => {
  console.error(err);
  $('main').html(`
    <p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>
  `);
});
