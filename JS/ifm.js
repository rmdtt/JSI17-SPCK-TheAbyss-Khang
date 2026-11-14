const params = new URLSearchParams(window.location.search);
const scientificName = params.get("species");

const imageElement = document.getElementById("creature-image");
const imageLoading = document.getElementById("image-loading");

function setText(id, value) {
    const element = document.getElementById(id);

    if (!element) {
        console.warn(`Không tìm thấy phần tử có ID: ${id}`);
        return;
    }

    element.textContent = value ?? "Unknown";
}

async function loadCreaturePage() {

    if (!scientificName) {
        setText("creature-name", "No creature selected");
        setText("creature-description", "Please select a creature first.");
        return;
    }

    try {
        const data = await getCreatureInfo(scientificName);
        loadCreatureImage(data.scientificName);

        setText("creature-name", data.acceptedName);
        setText("scientific-name", data.scientificName);
        setText("creature-scientific", data.scientificName);

        setText(
            "creature-size",
            data.size.category === "unknown"
                ? "Unknown"
                : `${data.size.category} (${data.size.valueCm} cm)`
        );

        setText(
            "creature-depth",
            data.depth
                ? `${data.depth.min} – ${data.depth.max} m`
                : "Unknown"
        );

        setText(
            "creature-water-type",
            data.waterType || "Unknown"
        );

        setText(
            "creature-aphia",
            data.aphiaID
        );

        setText(
            "creature-habitat",
            "Marine"
        );

        setText(
            "creature-description",
            "Explore the biological characteristics and habitat of this marine species."
        );

    } catch (error) {
        console.error(error);

        setText("creature-name", scientificName);
        setText(
            "creature-description",
            "Unable to retrieve biological information."
        );

        setText(
            "creature-description",
            "Some information could not be loaded."
        );
    }
}

loadCreaturePage();


async function getCreatureImage(scientificName) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");

    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set(
        "gsrsearch",
        `filetype:bitmap "${scientificName}"`
    );
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "10");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url");
    url.searchParams.set("iiurlwidth", "800");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Cannot load Wikimedia images");
    }

    const result = await response.json();

    const pages = Object.values(result.query?.pages || {});

    // Ưu tiên ảnh có thumbnail
    const image = pages.find(page =>
        page.imageinfo?.[0]?.thumburl ||
        page.imageinfo?.[0]?.url
    );

    if (!image) return null;

    return (
        image.imageinfo[0].thumburl ||
        image.imageinfo[0].url
    );
}

async function loadCreatureImage(scientificName) {
    const image = document.getElementById("creature-image");
    const loading = document.getElementById("image-loading");

    if (!image || !loading) {
        console.error("Không tìm thấy creature-image hoặc image-loading");
        return;
    }

    image.style.display = "none";
    loading.textContent = "Loading image...";

    try {
        const imageURL = await getCreatureImage(scientificName);

        if (!imageURL) {
            loading.textContent = "No image found";
            return;
        }

        image.onload = () => {
            image.style.display = "block";
            loading.style.display = "none";
        };

        image.onerror = () => {
            loading.textContent = "Image could not be displayed";
        };

        image.src = imageURL;
        image.alt = scientificName;

    } catch (error) {
        console.error("Image error:", error);
        loading.textContent = "Unable to load image";
    }
}
