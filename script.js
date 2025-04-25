// script.js

// Namespaces
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT = $rdf.Namespace("http://purl.org/dc/terms/");

// Where we find the TTL
const ttlUrl = "data/DE-BIAS_vocabulary.ttl";

// RDF store
const store = $rdf.graph();

// Main loader
async function loadVocabulary() {
  try {
    // 1) Fetch the TTL file via standard fetch()
    const resp = await fetch(ttlUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

    const ttlText = await resp.text();

    // 2) Parse it into our rdflib store
    $rdf.parse(ttlText, store, ttlUrl, "text/turtle");

    // 3) Extract and display
    const terms = extractTerms(store);
    displayTerms(terms);
    displayMetadata(store);

  } catch (err) {
    console.error("Error loading TTL:", err);
    document.querySelector("main").innerHTML =
      `<p>⚠️ Failed to load vocabulary.<br><em>${err.message}</em></p>`;
  }
}

// Pull all prefLabel + altLabel into a JS array
function extractTerms(store) {
  const termMap = new Map();

  // Gather preferred labels
  store.statementsMatching(undefined, SKOS("prefLabel"), undefined)
    .forEach(({ subject, object }) => {
      const key = subject.value;
      if (!termMap.has(key)) termMap.set(key, { uri: key, labels: [], alts: [] });
      termMap.get(key).labels.push(`${object.value} [${object.lang}]`);
    });

  // Gather alternative labels
  store.statementsMatching(undefined, SKOS("altLabel"), undefined)
    .forEach(({ subject, object }) => {
      const key = subject.value;
      if (termMap.has(key)) {
        termMap.get(key).alts.push(`${object.value} [${object.lang}]`);
      }
    });

  // Convert to array
  return Array.from(termMap.values());
}

// Render the table
function displayTerms(terms) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  terms.forEach((term) => {
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

  // Wire up search
  document.getElementById("search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    Array.from(tbody.rows).forEach((row) => {
      row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// Show dataset metadata (e.g. last modified)
function displayMetadata(store) {
  const mod = store.any(undefined, DCT("modified"));
  if (mod) {
    document.getElementById("dataset-meta").innerText =
      `Vocabulary last modified: ${mod.value}`;
  }
}

// Kick things off
window.addEventListener("DOMContentLoaded", loadVocabulary);
