const store = $rdf.graph();
const fetcher = new $rdf.Fetcher(store);

const ttlUrl = "data/DE-BIAS_vocabulary.ttl"; // Local GitHub-hosted copy
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT = $rdf.Namespace("http://purl.org/dc/terms/");

async function loadVocabulary() {
  try {
    await fetcher.load(ttlUrl);

    const concepts = store.statementsMatching(undefined, SKOS("prefLabel"), undefined);
    const termMap = new Map();

    concepts.forEach(({ subject, object }) => {
      if (!termMap.has(subject.value)) {
        termMap.set(subject.value, {
          uri: subject.value,
          labels: [],
          alternatives: [],
        });
      }
      const langLabel = `${object.value} [${object.lang}]`;
      termMap.get(subject.value).labels.push(langLabel);
    });

    store.statementsMatching(undefined, SKOS("altLabel"), undefined).forEach(({ subject, object }) => {
      if (termMap.has(subject.value)) {
        const langAlt = `${object.value} [${object.lang}]`;
        termMap.get(subject.value).alternatives.push(langAlt);
      }
    });

    displayTerms([...termMap.values()]);
    showMetadata();
  } catch (err) {
    document.querySelector("main").innerHTML = "<p>⚠️ Failed to load vocabulary.</p>";
    console.error(err);
  }
}

function displayTerms(terms) {
  const tbody = document.querySelector("#term-table tbody");
  tbody.innerHTML = "";

  terms.forEach((term) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="${term.uri}" target="_blank">${term.uri.split("/").pop()}</a></td>
      <td>${term.labels.join("<br>")}</td>
      <td>${term.alternatives.join("<br>")}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    [...tbody.rows].forEach((row) => {
      row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

function showMetadata() {
  const lastModified = store.any(undefined, DCT("modified"));
  if (lastModified) {
    document.getElementById("dataset-meta").innerText =
      "Vocabulary last modified: " + lastModified.value;
  }
}

loadVocabulary();
