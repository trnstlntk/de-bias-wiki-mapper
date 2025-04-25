// script.js

// Namespaces
const RDF  = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT  = $rdf.Namespace("http://purl.org/dc/terms/");

// Absolute URL to TTL on GitHub Pages
const TTL_PATH = "data/DE-BIAS_vocabulary.ttl";
const TTL_URL  = new URL(TTL_PATH, window.location.href).href;

// rdflib store
const store = $rdf.graph();

// Kick things off
window.addEventListener("DOMContentLoaded", loadVocabulary);

async function loadVocabulary() {
  try {
    // 1) fetch the TTL
    const res = await fetch(TTL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const ttl = await res.text();

    // 2) parse into rdflib
    $rdf.parse(ttl, store, TTL_URL, "text/turtle");

    // 3) extract & render
    const concepts = extractConcepts(store);
    renderTable(concepts);
    renderMetadata(store);

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML =
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

function extractConcepts(store) {
  // find all skos:Concepts
  const conceptNodes = store
    .each(undefined, RDF("type"), SKOS("Concept"))
    .map(sym => sym.value);

  const concepts = conceptNodes.map(uri => {
    const node = $rdf.sym(uri);
    // labels
    const labels = store
      .each(node, DCT("title"), null)
      .map(lit => ({ value: lit.value, lang: lit.lang }));
    // definitions
    const defs = [
      ...store.each(node, SKOS("definition"), null),
      ...store.each(node, SKOS("scopeNote"), null)
    ].map(lit => ({ value: lit.value, lang: lit.lang }));
    // alternatives
    const alts = store
      .each(node, SKOS("altLabel"), null)
      .map(lit => ({ value: lit.value, lang: lit.lang }));

    // languages present
    const langs = new Set([
      ...labels.map(l => l.lang),
      ...defs.map(d => d.lang),
      ...alts.map(a => a.lang)
    ]);

    return {
      uri: uri.split("/").pop(),
      labels,
      defs,
      alts,
      langs: Array.from(langs).filter(l => l)  // drop empty
    };
  });

  return concepts;
}

function renderTable(concepts) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  concepts.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="http://data.europa.eu/c4p/data/${c.uri}" target="_blank">${c.uri}</a></td>
      <td>${c.langs.join(", ")}</td>
      <td>${c.labels.map(l=>`${l.value} [${l.lang}]`).join("<br>")}</td>
      <td>${c.defs.map(d=>`${d.value} [${d.lang}]`).join("<br>")}</td>
      <td>${c.alts.map(a=>`${a.value} [${a.lang}]`).join("<br>")}</td>
    `;
    tbody.appendChild(tr);
  });

  // attach search
  document.getElementById("search").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    Array.from(tbody.rows).forEach(row => {
      row.style.display =
        row.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

function renderMetadata(store) {
  // find the first literal modified date
  const mods = store
    .each(undefined, DCT("modified"), null)
    .filter(o => o.termType === "Literal")
    .map(o => o.value);
  if (mods.length) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${mods[0]}`;
  }
}
