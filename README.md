# DE-BIAS Wiki Mapper

This is a multilingual vocabulary explorer for the [DE-BIAS project](https://pro.europeana.eu/page/the-de-bias-vocabulary). It allows you to:

- Browse DE-BIAS terms in multiple languages
- See proposed alternatives
- Search terms across all languages
- See metadata such as last modification date

Hosted at: https://trnstlntk.github.io/de-bias-wiki-mapper/

## How to update the vocabulary
1. Download the `.ttl` file from [this official link](https://op.europa.eu/o/opportal-service/euvoc-download-handler?cellarURI=http%3A%2F%2Fpublications.europa.eu%2Fresource%2Fdistribution%2Fde-bias-vocabulary%2F20250402-0%2Fttl%2Fskos_xl%2FDE-BIAS_vocabulary.ttl&fileName=DE-BIAS_vocabulary.ttl)
2. Replace the file at `data/DE-BIAS_vocabulary.ttl` in this repo
3. Commit and push changes

## Next features (roadmap)
- Show full concept view with scope notes
- Add Wikidata mappings
- Wikipedia coverage check
