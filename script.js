// script.js

const RDF  = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT  = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://publications.europa.eu/resource/ontology/de-bias#");

const TTL_PATH = "data/DE-BIAS_vocabulary.ttl";
const TTL_URL  = new URL(TTL_PATH, window.location.href).href;
const store = $rdf.graph();

async function loadVocabulary() {
  try {
    const res = await fetch(TTL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const ttl = await res.text();
    $rdf.parse(ttl, store, TTL_URL, "text/turtle");

    const data = extractConcepts(store);
    populateTables(data);
    populateMetadata(store);
    initializeDataTables();
  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML = `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

// Only skos:Concept, filter out concept schemes etc. :contentReference[oaicite:5]{index=5}
function extractConcepts(store) {
  const nodes = store.each(undefined, RDF("type"), SKOS("Concept"))
                    .map(sym => sym.value);

  return nodes.map(uri => {
    const node = $rdf.sym(uri);
    // labels from dct:title :contentReference[oaicite:6]{index=6}
    const labels = store.each(node, DCT("title"), null)
                        .map(lit => ({value:lit.value, lang:lit.lang}));
    // definitions from skos:definition & skos:scopeNote :contentReference[oaicite:7]{index=7}
    const defs = store.each(node, SKOS("definition"), null)
                      .concat(store.each(node, SKOS("scopeNote"), null))
                      .map(lit => ({value:lit.value, lang:lit.lang}));
    // suggestions from debias-o:SuggestionNote
    const suggs = store.each(node, DEBIAS("SuggestionNote"), null)
                       .map(lit => ({value:lit.value, lang:lit.lang}));

    const langs = Array.from(new Set([...labels, ...defs, ...suggs].map(x=>x.lang).filter(l=>l)));

    return {
      id: uri.split("/").pop(),
      labels, defs, suggs, langs
    };
  });
}

// Fill all tables (All + per-language)
function populateTables(concepts) {
  // All table
  const allBody = $("#term-table-all tbody");
  concepts.forEach(c => {
    allBody.append(rowHtml(c, true));
  });
  // Per language
  ["en","de","nl","es"].forEach(lang => {
    const body = $(`#term-table-${lang} tbody`);
    concepts.filter(c=>c.langs.includes(lang))
            .forEach(c=> body.append(rowHtml(c, false, lang)));
  });
}

// Generate row HTML; omit language tags in labels since langs column covers it
function rowHtml(c, includeLangCol, langOnly) {
  const lbls = (langOnly? c.labels.filter(l=>l.lang===langOnly):c.labels)
               .map(l=>l.value).join("<br>");
  const defs = (langOnly? c.defs.filter(d=>d.lang===langOnly):c.defs)
               .map(d=>d.value).join("<br>");
  const sugg = (langOnly? c.suggs.filter(s=>s.lang===langOnly):c.suggs)
               .map(s=>s.value).join("<br>");

  return `<tr>
    <td><a href="http://data.europa.eu/c4p/data/${c.id}" target="_blank">${c.id}</a></td>
    ${ includeLangCol ? `<td>${c.langs.join(", ")}</td>` : "" }
    <td>${lbls}</td>
    <td>${defs||"<em>–</em>"}</td>
    <td>${sugg||"<em>–</em>"}</td>
  </tr>`;
}

// Initialize DataTables on each table for sorting/pagination/search :contentReference[oaicite:8]{index=8}
function initializeDataTables() {
  $("#term-table-all").DataTable();
  ["en","de","nl","es"].forEach(lang => {
    $(`#term-table-${lang}`).DataTable();
  });
}

// Show dataset last modified (first literal dct:modified) :contentReference[oaicite:9]{index=9}
function populateMetadata(store) {
  const mods = store.each(undefined, DCT("modified"), null)
                    .filter(o=>o.termType==="Literal")
                    .map(o=>o.value);
  if (mods.length) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${mods[0]}`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadVocabulary();
  new Tabby("[data-tabs]");  // initialize Tabby tabs :contentReference[oaicite:10]{index=10}
});
