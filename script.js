// script.js

// Namespaces
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT  = $rdf.Namespace("http://purl.org/dc/terms/");

// Build an absolute URL to the TTL on GitHub Pages
const TTL_PATH = "data/DE-BIAS_vocabulary.ttl";
const TTL_URL  = new URL(TTL_PATH, window.location.href).href;

// RDF store
const store = $rdf.graph();

// Kick off on DOM ready
window.addEventListener("DOMContentLoaded", loadVocabulary);

async function loadVocabulary() {
  try {
    // 1) fetch the TTL
    const res = await fetch(TTL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const ttlText = await res.text();

    // 2) parse into rdflib
    $rdf.parse(ttlText, store, TTL_URL, "text/turtle");

    // 3) extract and render
    const terms = extractTerms(store);
    displayTerms(terms);
    displayMetadata(store);

  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML =
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

// Build a JS array of {uri, labels[], def[], alts[]}
function extractTerms(store) {
  const map = new Map();

  // 1) labels via dct:title
  store.statementsMatching(undefined, DCT("title"), undefined)
    .forEach(({ subject, object }) => {
      const uri = subject.value;
      if (!map.has(uri)) map.set(uri, { uri, labels:[], defs:[], alts:[] });
      map.get(uri).labels.push(`${object.value} [${object.lang}]`);
    });

  // 2) definitions via skos:definition + skos:scopeNote
  [ SKOS("definition"), SKOS("scopeNote") ].forEach(pred => {
    store.statementsMatching(undefined, pred, undefined)
      .forEach(({ subject, object }) => {
        const uri = subject.value;
        if (map.has(uri)) {
          map.get(uri).defs.push(`${object.value} [${object.lang||'und'}]`);
        }
      });
  });

  // 3) alternatives via skos:altLabel
  store.statementsMatching(undefined, SKOS("altLabel"), undefined)
    .forEach(({ subject, object }) => {
      const uri = subject.value;
      if (map.has(uri)) {
        map.get(uri).alts.push(`${object.value} [${object.lang}]`);
      }
    });

  return Array.from(map.values());
}

// Render table rows + wire up search
function displayTerms(terms) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";
  terms.forEach(t => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <a href="${t.uri}" target="_blank">
          ${t.uri.split("/").pop()}
        </a>
      </td>
      <td>${t.labels.join("<br>")}</td>
      <td>${t.defs.join("<br>")}</td>
      <td>${t.alts.join("<br>")}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("search").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    Array.from(tbody.rows).forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// Display the first literal dct:modified as the dataset date
function displayMetadata(store) {
  const mods = store.statementsMatching(undefined, DCT("modified"), undefined)
                    .filter(st => st.object.termType === "Literal");
  if (mods.length) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${mods[0].object.value}`;
  }
}
