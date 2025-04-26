// script.js

// RDF Namespaces
const RDF   = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS  = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT   = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://data.europa.eu/c4p/ontology#");

// Absolute TTL URL
const TTL_PATH = "data/DE-BIAS_vocabulary.ttl";
const TTL_URL  = new URL(TTL_PATH, window.location.href).href;

const store = $rdf.graph();

window.addEventListener("DOMContentLoaded", () => {
  loadVocabulary();
});

async function loadVocabulary() {
  try {
    // 1) Fetch & parse the master TTL
    const resp = await fetch(TTL_URL);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const ttlText = await resp.text();
    $rdf.parse(ttlText, store, TTL_URL, "text/turtle");

    // 2) Extract only real term concepts
    const concepts = extractTermConcepts(store);

    // 3) Populate the table
    renderTable(concepts);

    // 4) Show dataset metadata
    renderMetadata(store);

    // 5) Turn on DataTables
    $("#term-table").DataTable();

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML = 
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

function extractTermConcepts(store) {
  // Only URIs that have hasContentiousTerm ⇒ real DE-BIAS terms
  const subjects = new Set(
    store.statementsMatching(undefined, DEBIAS("hasContentiousTerm"), null)
         .map(st => st.subject.value)
  );

  return Array.from(subjects).map(uri => {
    const node = $rdf.sym(uri);

    // Labels (dct:title) + languages
    const labels = store.each(node, DCT("title"), null)
                        .map(l => ({value:l.value, lang:l.lang}));
    const langs  = [...new Set(labels.map(l => l.lang).filter(Boolean))];

    // Description (dct:description)
    const descLit = store.any(node, DCT("description"), null);
    const description = descLit ? descLit.value : "";

    // Suggested Terms: follow hasSuggestedTerm → get dct:title from that node
    const suggUris = store.each(node, DEBIAS("hasSuggestedTerm"), null)
                          .map(lit => lit.value);
    const suggested = suggUris.map(su => {
      const snode = $rdf.sym(su);
      const titleLit = store.any(snode, DCT("title"), null);
      return titleLit ? titleLit.value : su.split("/").pop();
    });

    return {
      id: uri.split("/").pop(),
      labels,
      langs,
      description,
      suggested
    };
  });
}

function renderTable(concepts) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  concepts.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="http://data.europa.eu/c4p/data/${c.id}"
             target="_blank">${c.id}</a></td>
      <td>${c.langs.join(", ")}</td>
      <td>${c.labels.map(l=>l.value).join("<br>")}</td>
      <td>${c.description || "<em>–</em>"}</td>
      <td>${c.suggested.length 
             ? c.suggested.join("<br>") 
             : "<em>–</em>"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMetadata(store) {
  const modLit = store.any(undefined, DCT("modified"), null);
  if (modLit && modLit.termType === "Literal") {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${modLit.value}`;
  }
}
