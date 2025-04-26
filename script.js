// script.js

// Namespaces
const RDF    = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS   = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const SKOSXL = $rdf.Namespace("http://www.w3.org/2008/05/skos-xl#");
const DCT    = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://data.europa.eu/c4p/ontology#");

// Main TTL path
const TTL_PATH = "data/DE-BIAS_vocabulary.ttl";
const TTL_URL  = new URL(TTL_PATH, window.location.href).href;

// RDF store and fetcher
const store   = $rdf.graph();
const fetcher = new $rdf.Fetcher(store);

window.addEventListener("DOMContentLoaded", loadVocabulary);

async function loadVocabulary() {
  try {
    // 1) Load main TTL
    await fetcher.load(TTL_URL);

    // 2) Extract raw concept data *including* suggested-URI lists
    const rawConcepts = extractTermConcepts(store);

    // 3) Fetch *all* suggested-term URIs so they end up in our store
    const allSuggestedUris = rawConcepts
      .flatMap(c => c.suggestedUris);
    await Promise.all(
      [...new Set(allSuggestedUris)]  // dedupe
        .map(uri => fetcher.load(uri))
    );

    // 4) Convert rawConcepts → finalConcepts with labels
    const finalConcepts = rawConcepts.map(c => ({
      id:          c.id,
      labels:      c.labels,
      langs:       c.langs,
      description: c.description,
      suggested:   c.suggestedUris.map(uri => {
        const node = $rdf.sym(uri);
        // Grab SKOS-XL literalForm if present, else fallback to title
        const lf = store.any(node, SKOSXL("literalForm"), null);
        if (lf) return lf.value;
        const tl = store.any(node, DCT("title"), null);
        return tl ? tl.value : uri.split("/").pop();
      })
    }));

    // 5) Render & activate DataTables
    renderTable(finalConcepts);
    renderMetadata(store);
    $("#term-table").DataTable();

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML =
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

function extractTermConcepts(store) {
  // Only concepts that actually carry a contentious-term link
  const uris = store
    .each(undefined, DEBIAS("hasContentiousTerm"), null)
    .map(st => st.subject.value);

  return Array.from(new Set(uris)).map(uri => {
    const node = $rdf.sym(uri);

    // dct:title → labels + langs
    const labels = store.each(node, DCT("title"), null)
                        .map(l => ({value:l.value, lang:l.lang}));
    const langs  = [...new Set(labels.map(l=>l.lang).filter(Boolean))];

    // dct:description → description
    const descLit = store.any(node, DCT("description"), null);
    const description = descLit ? descLit.value : "";

    // Collect the raw suggested-term URIs
    const suggestedUris = store
      .each(node, DEBIAS("hasSuggestedTerm"), null)
      .map(lit => lit.value);

    return { id: uri.split("/").pop(), labels, langs, description, suggestedUris };
  });
}

function renderTable(concepts) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  concepts.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="http://data.europa.eu/c4p/data/${c.id}" target="_blank">${c.id}</a></td>
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
  const mod = store.any(undefined, DCT("modified"), null);
  if (mod && mod.termType === "Literal") {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${mod.value}`;
  }
}
