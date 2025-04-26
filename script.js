// script.js

// RDF Namespaces
const RDF    = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS   = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const SKOSXL = $rdf.Namespace("http://www.w3.org/2008/05/skos-xl#");
const DCT    = $rdf.Namespace("http://purl.org/dc/terms/");
const DEBIAS = $rdf.Namespace("http://data.europa.eu/c4p/ontology#");

// Path & store/fetcher
const TTL_PATH = "data/DE-BIAS_vocabulary.ttl";
const TTL_URL  = new URL(TTL_PATH, window.location.href).href;
const store    = $rdf.graph();
const fetcher  = new $rdf.Fetcher(store);

window.addEventListener("DOMContentLoaded", loadVocabulary);

async function loadVocabulary() {
  try {
    // 1) Load the main DE-BIAS TTL
    await fetcher.load(TTL_URL);

    // 2) Pull out raw concept entries (with suggested-term URIs)
    const raw = extractTermConcepts(store);

    // 3) Fetch all suggested-term URIs into our RDF store
    const allUris = Array.from(new Set(raw.flatMap(r => r.suggestedUris)));
    await Promise.all(allUris.map(uri => fetcher.load(uri)));

    // 4) Build final concept objects, resolving each suggested URI to a label
    const concepts = raw.map(c => {
      const labels   = c.labels;
      const langs    = c.langs;
      const desc     = c.description;
      const suggested = c.suggestedUris.map(uri => {
        const node = $rdf.sym(uri);
        // Try SKOS-XL literalForm
        const lf = store.any(node, SKOSXL("literalForm"), null);
        if (lf && lf.value) return lf.value;
        // Fallback to dct:title
        const tl = store.any(node, DCT("title"), null);
        if (tl && tl.value) return tl.value;
        // Last resort: the fragment
        return uri.split("/").pop();
      });
      return { id: c.id, labels, langs, description: desc, suggested };
    });

    // 5) Render UI
    renderTable(concepts);
    renderMetadata(store);
    $("#term-table").DataTable();

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML =
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

function extractTermConcepts(store) {
  // Only subjects that have a hasContentiousTerm link
  const subjects = store
    .each(undefined, DEBIAS("hasContentiousTerm"), null)
    .map(st => st.subject.value);

  return Array.from(new Set(subjects)).map(uri => {
    const node = $rdf.sym(uri);
    // dct:title → labels
    const labels = store.each(node, DCT("title"), null)
                        .map(l => ({ value: l.value, lang: l.lang }));
    const langs  = [...new Set(labels.map(l => l.lang).filter(Boolean))];
    // dct:description → description
    const descLit = store.any(node, DCT("description"), null);
    const description = descLit ? descLit.value : "";
    // Collect raw suggested-term URIs
    const suggestedUris = store.each(node, DEBIAS("hasSuggestedTerm"), null)
                               .map(l => l.value);
    return { 
      id: uri.split("/").pop(),
      labels, langs, description, suggestedUris
    };
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
      <td>${c.description || "<em>– no description –</em>"}</td>
      <td>${c.suggested.length 
             ? c.suggested.join("<br>") 
             : "<em>– none –</em>"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMetadata(store) {
  const modLit = store.any(undefined, DCT("modified"), null);
  if (modLit && modLit.value) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${modLit.value}`;
  }
}
