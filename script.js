// script.js

// Namespaces
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT = $rdf.Namespace("http://purl.org/dc/terms/");

// Compute the full URL to the TTL file on GitHub Pages
const ttlPath = "data/DE-BIAS_vocabulary.ttl";
const ttlUrl = new URL(ttlPath, window.location.href).href;

// Initialize an RDF store
const store = $rdf.graph();

// Load, parse, extract, and display
async function loadVocabulary() {
  try {
    // 1) Fetch the TTL file
    const res = await fetch(ttlUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    // 2) Read text
    const ttlText = await res.text();

    // 3) Parse into rdflib using absolute base URI
    $rdf.parse(ttlText, store, ttlUrl, "text/turtle");

    // 4) Extract and render
    const terms = extractTerms(store);
    displayTerms(terms);
    displayMetadata(store);

  } catch (err) {
    console.error("Error loading TTL:", err);
    document.querySelector("main").innerHTML = `
      <p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>
    `;
  }
}

// Build a map of concepts → labels + altLabels
function extractTerms(store) {
  const map = new Map();

  // preferred labels
  store.statementsMatching(undefined, SKOS("prefLabel"), undefined)
    .forEach(({ subject, object }) => {
      const key = subject.value;
      if (!map.has(key)) map.set(key, { uri: key, labels: [], alts: [] });
      map.get(key).labels.push(`${object.value} [${object.lang}]`);
    });

  // alternative labels
  store.statementsMatching(undefined, SKOS("altLabel"), undefined)
    .forEach(({ subject, object }) => {
      const key = subject.value;
      if (map.has(key)) map.get(key).alts.push(`${object.value} [${object.lang}]`);
    });

  return Array.from(map.values());
}

// Render the HTML table
function displayTerms(terms) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";
  terms.forEach(term => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="${term.uri}" target="_blank">
          ${term.uri.split("/").pop()}
        </a>
      </td>
      <td>${term.labels.join("<br>")}</td>
      <td>${term.alts.join("<br>")}</td>
    `;
    tbody.appendChild(tr);
  });

  // Search filter
  document.getElementById("search").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    Array.from(tbody.rows).forEach(row => {
      row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// Show dataset-level metadata (last modified date)
function displayMetadata(store) {
  const mod = store.any(undefined, DCT("modified"));
  if (mod) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${mod.value}`;
  }
}

// Run on page load
window.addEventListener("DOMContentLoaded", loadVocabulary);
