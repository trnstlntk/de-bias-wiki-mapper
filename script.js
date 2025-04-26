// script.js

// RDF Namespaces
const RDF    = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS   = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT    = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://data.europa.eu/c4p/ontology#");

// Where our TTL lives
const TTL_URL = new URL("data/DE-BIAS_vocabulary.ttl", window.location.href).href;

const store   = $rdf.graph();
const fetcher = new $rdf.Fetcher(store);

window.addEventListener("DOMContentLoaded", loadVocabulary);

async function loadVocabulary() {
  try {
    // 1) Load the main vocabulary
    await fetcher.load(TTL_URL);

    // 2) Extract all term concepts with their suggestion‐URIs
    const raw = extractTermConcepts(store);

    // 3) Fetch each suggested‐term resource so its dct:title lands in the store
    const uris = [...new Set(raw.flatMap(r => r.suggestedUris))];
    await Promise.all(uris.map(u => fetcher.load(u)));

    // 4) Build final list, resolving each suggestedUri → its dct:title (or fallback)
    const terms = raw.map(r => {
      const suggested = r.suggestedUris.map(uri => {
        const node = $rdf.sym(uri);
        // Only look for dct:title here
        const tl = store.any(node, DCT("title"), null);
        return (tl && tl.value) ? tl.value : uri.split("/").pop();
      });
      return { 
        id:          r.id,
        labels:      r.labels,
        langs:       r.langs,
        description: r.description,
        suggested
      };
    });

    // 5) Render table and metadata
    renderTable(terms);
    renderMetadata(store);

    // 6) Activate DataTables
    $("#term-table").DataTable();

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML = 
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

function extractTermConcepts(store) {
  // Only keep subjects that occur in a hasContentiousTerm triple
  const subjects = store
    .each(undefined, DEBIAS("hasContentiousTerm"), null)
    .map(st => st.subject.value);

  return Array.from(new Set(subjects)).map(uri => {
    const node = $rdf.sym(uri);

    // Titles → labels + languages
    const labels = store
      .each(node, DCT("title"), null)
      .map(lit => ({ value: lit.value, lang: lit.lang }));
    const langs = [...new Set(labels.map(l=>l.lang).filter(Boolean))];

    // Description
    const d = store.any(node, DCT("description"), null);
    const description = (d && d.value) ? d.value : "";

    // Suggested‐term URIs
    const suggestedUris = store
      .each(node, DEBIAS("hasSuggestedTerm"), null)
      .map(lit => lit.value);

    return { 
      id:           uri.split("/").pop(),
      labels, langs, description, suggestedUris
    };
  });
}

function renderTable(terms) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  terms.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="http://data.europa.eu/c4p/data/${t.id}" target="_blank">${t.id}</a></td>
      <td>${t.langs.join(", ")}</td>
      <td>${t.labels.map(l=>l.value).join("<br>")}</td>
      <td>${t.description || "<em>–</em>"}</td>
      <td>${t.suggested.length 
             ? t.suggested.join("<br>") 
             : "<em>–</em>"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMetadata(store) {
  const m = store.any(undefined, DCT("modified"), null);
  if (m && m.value) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${m.value}`;
  }
}
