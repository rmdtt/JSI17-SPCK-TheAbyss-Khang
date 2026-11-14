async function displayCreatureInfo(scientificName) {
    const container = document.getElementById("creature-info");

    container.textContent = "Loading...";

    try {
        const data = await getCreatureInfo(scientificName);

        container.innerHTML = `
            <h2>${data.acceptedName}</h2>

            <p>
                <strong>Size:</strong>
                ${data.size.category}
            </p>

            <p>
                <strong>Depth:</strong>
                ${data.depth
                    ? `${data.depth.min} - ${data.depth.max} m`
                    : "Unknown"}
            </p>

            <p>
                <strong>Temperature:</strong>
                ${data.temperaturePreference}
            </p>
        `;

    } catch (error) {
        console.error(error);
        container.textContent = "Unable to load creature information.";
    }
}