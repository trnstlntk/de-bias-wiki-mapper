// script.js

// RDF Namespaces
const RDF    = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS   = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT    = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://data.europa.eu/c4p/ontology#");

// Main TTL URL on GitHub Pages
const TTL_URL = new URL("data/DE-BIAS_vocabulary.ttl", window.location.href).href;

// The shared rdflib store
const store   = $rdf.graph();

window.addEventListener("DOMContentLoaded", loadVocabulary);

async function loadVocabulary() {
  try {
    // 1) Fetch & parse the main vocabulary TTL
    const mainTtl = await (await fetch(TTL_URL)).text();
    $rdf.parse(mainTtl, store, TTL_URL, "text/turtle");

    // 2) Extract all term concepts + their suggested-term URIs
    const rawConcepts = extractTermConcepts(store);

    // 3) Build a unique list of all suggested URIs
    const allSuggestUris = Array.from(new Set(
      rawConcepts.flatMap(c => c.suggestedUris)
    ));

    // 4) Fetch each suggested URI via CORS proxy, parse & extract its title
    const suggestionMap = {};
    await Promise.all(
      allSuggestUris.map(async uri => {
        suggestionMap[uri] = await fetchSuggestionTitle(uri);
      })
    );

    // 5) Assemble final concept objects with humanized suggestions
    const concepts = rawConcepts.map(c => ({
      id:          c.id,
      labels:      c.labels,
      langs:       c.langs,
      description: c.description,
      suggested:   c.suggestedUris.map(u => suggestionMap[u])
    }));

    // 6) Render UI
    renderTable(concepts);
    renderMetadata(store);
    $("#term-table").DataTable();

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML = `
      <p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>
    `;
  }
}

// Extract only real term concepts (those with a hasContentiousTerm link)
function extractTermConcepts(store) {
  const subjects = store
    .each(undefined, DEBIAS("hasContentiousTerm"), null)
    .map(st => st.subject.value);

  return Array.from(new Set(subjects)).map(uri => {
    const node = $rdf.sym(uri);

    // Titles (dct:title)
    const labels = store.each(node, DCT("title"), null)
                        .map(l => ({value:l.value, lang:l.lang}));
    const langs  = [...new Set(labels.map(l=>l.lang).filter(Boolean))];

    // Description (dct:description)
    const d = store.any(node, DCT("description"), null);
    const description = d && d.value ? d.value : "";

    // Suggested-term URIs
    const suggestedUris = store.each(node, DEBIAS("hasSuggestedTerm"), null)
                               .map(l => l.value);

    return {
      id:           uri.split("/").pop(),
      labels, langs, description, suggestedUris
    };
  });
}

// Fetch a suggested-term URI via AllOrigins, parse TTL, extract dct:title
async function fetchSuggestionTitle(uri) {
  try {
    // Use AllOrigins CORS proxy
    const proxy = "https://api.allorigins.win/raw?url=" +
                  encodeURIComponent(uri + ".ttl");
    const res = await fetch(proxy);
    if (!res.ok) throw new Error(`Fetch ${uri} → ${res.status}`);
    const ttl = await res.text();

    // Parse into a temporary store
    const tmp = $rdf.graph();
    $rdf.parse(ttl, tmp, uri, "text/turtle");

    // Extract the title
    const t = tmp.any($rdf.sym(uri), DCT("title"), null);
    return (t && t.value) ? t.value : uri.split("/").pop();

  } catch (err) {
    console.warn("Suggestion fetch failed:", uri, err);
    return uri.split("/").pop();
  }
}

// Render the DataTable rows
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
      <td>${c.labels.map(l=>l.value).join("<br>")}</td>
      <td>${c.description || "<em>–</em>"}</td>
      <td>${c.suggested.length
             ? c.suggested.join("<br>")
             : "<em>–</em>"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Show the dataset-level last modified date
function renderMetadata(store) {
  const m = store.any(undefined, DCT("modified"), null);
  if (m && m.value) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${m.value}`;
  }
}
