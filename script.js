document.getElementById('download-btn').addEventListener('click', async function() {
    // Update UI with a loading message
    document.getElementById('status-msg').textContent = "Downloading the RDF file from GitHub... Please wait.";

    try {
        // GitHub link to download the RDF file
        const githubUrl = 'https://raw.githubusercontent.com/trnstlntk/de-bias-wiki-mapper/main/data/DE-BIAS_vocabulary.ttl';
        const response = await fetch(githubUrl);
        if (!response.ok) {
            throw new Error('Failed to download RDF file from GitHub');
        }

        const rdfData = await response.text();

        // Create a Blob from the RDF file content
        const blob = new Blob([rdfData], { type: 'application/rdf+xml' });

        // Create a download link for the file
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'DE-BIAS_vocabulary.ttl';  // The name for the downloaded file

        // Trigger the download by simulating a click on the link
        link.click();

        // Update UI with success message
        document.getElementById('status-msg').textContent = "Download complete!";

    } catch (error) {
        console.error('Error downloading file:', error);
        document.getElementById('status-msg').textContent = "Something went wrong. Please try again later.";
    }
});

document.getElementById('download-upload-btn').addEventListener('click', async function() {
    // Update UI with a loading message
    document.getElementById('status-msg').textContent = "Downloading the RDF file... Please wait.";

    try {
        // The URL for the RDF file
        const fileURL = 'https://op.europa.eu/o/opportal-service/euvoc-download-handler?cellarURI=http%3A%2F%2Fpublications.europa.eu%2Fresource%2Fdistribution%2Fde-bias-vocabulary%2F20250402-0%2Frdf%2Fskos_xl%2FDE-BIAS_vocabulary.rdf&fileName=DE-BIAS_vocabulary.rdf';

        // Fetch the RDF file
        const response = await fetch(fileURL);
        if (!response.ok) {
            throw new Error('Failed to download RDF file');
        }

        const rdfData = await response.text();

        // Create a Blob from the RDF file content
        const blob = new Blob([rdfData], { type: 'application/rdf+xml' });

        // Create a download link for the file
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'DE-BIAS_vocabulary.rdf';  // The name for the downloaded file

        // Trigger the download by simulating a click on the link
        link.click();

        // Update UI with success message and instructions
        document.getElementById('status-msg').innerHTML = `Download complete! Now, <a href="https://github.com/trnstlntk/de-bias-wiki-mapper" target="_blank">upload the file to your GitHub repository here</a> using the "Add file" button.`;

    } catch (error) {
        console.error('Error downloading file:', error);
        document.getElementById('status-msg').textContent = "Something went wrong. Please try again later.";
    }
});
