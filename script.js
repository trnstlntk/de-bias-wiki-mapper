// script.js

// RDF Namespaces
const RDF    = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS   = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT    = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://data.europa.eu/c4p/ontology#");

// Compute absolute URL to your TTL in /data/
const TTL_URL = new URL("data/DE-BIAS_vocabulary.ttl", window.location.href).href;

// Single shared rdflib store
const store = $rdf.graph();

// When the page loads, kick off our loader
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1) Fetch & parse the entire vocabulary TTL
    const res   = await fetch(TTL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const ttl   = await res.text();
    $rdf.parse(ttl, store, TTL_URL, "text/turtle");

    // 2) Extract your term concepts
    const terms = extractTermConcepts(store);

    // 3) Render the table & metadata, then activate DataTables
    renderTable(terms);
    renderMetadata(store);
    $("#term-table").DataTable();

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML = `
      <p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>
    `;
  }
});

/**
 * Pulls out only those URIs that are real DE-BIAS terms
 * (i.e. have the debias-o:hasContentiousTerm predicate),
 * then gathers labels, languages, description, and suggestion labels.
 */
function extractTermConcepts(store) {
  // 1) find all subjects with hasContentiousTerm → these are our term concepts
  const subjects = store
    .each(undefined, DEBIAS("hasContentiousTerm"), null)
    .map(st => st.subject.value);

  // 2) de-duplicate and build a JS object per concept
  return Array.from(new Set(subjects)).map(uri => {
    const node = $rdf.sym(uri);

    // a) Labels (dct:title)
    const labels = store
      .each(node, DCT("title"), null)
      .map(lit => ({ value: lit.value, lang: lit.lang }));
    const langs = [...new Set(labels.map(l => l.lang).filter(Boolean))];

    // b) Description (dct:description)
    const descLit = store.any(node, DCT("description"), null);
    const description = descLit && descLit.value
      ? descLit.value
      : "";

    // c) Suggested Terms: follow hasSuggestedTerm → each suggestion node is already in this same store
    const suggested = store
      .each(node, DEBIAS("hasSuggestedTerm"), null)
      .map(lit => {
        // look up its dct:title in the same store
        const sNode = $rdf.sym(lit.value);
        const titleLit = store.any(sNode, DCT("title"), null);
        return (titleLit && titleLit.value)
          ? titleLit.value
          : lit.value.split("/").pop();
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

/**
 * Renders the DataTable rows for each concept.
 */
function renderTable(concepts) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  concepts.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="http://data.europa.eu/c4p/data/${c.id}" target="_blank">
          ${c.id}
        </a>
      </td>
      <td>${c.langs.join(", ")}</td>
      <td>${c.labels.map(l => l.value).join("<br>")}</td>
      <td>${c.description || "<em>– no description –</em>"}</td>
      <td>${c.suggested.length ? c.suggested.join("<br>") : "<em>– none –</em>"}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Displays the dataset's "last modified" date from dct:modified.
 */
function renderMetadata(store) {
  const modLit = store.any(undefined, DCT("modified"), null);
  if (modLit && modLit.value) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${modLit.value}`;
  }
}
