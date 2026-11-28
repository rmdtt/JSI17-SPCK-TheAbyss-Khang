
const params = new URLSearchParams(window.location.search);

const scientificName = params.get("species");
const customId = params.get("customId");

const imageElement = document.getElementById("creature-image");
const imageLoading = document.getElementById("image-loading");


// =====================================
// HÀM HIỂN THỊ TEXT
// =====================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (!element) {
        console.warn(`Không tìm thấy phần tử: ${id}`);
        return;
    }

    element.textContent = value ?? "Unknown";
}


// =====================================
// HIỂN THỊ ẢNH
// =====================================

function displayCreatureImage(url, altText) {
    if (!imageElement || !imageLoading) return;

    if (!url) {
        imageElement.style.display = "none";
        imageLoading.style.display = "block";
        imageLoading.textContent = "No image found";
        return;
    }

    imageElement.style.display = "none";
    imageLoading.style.display = "block";
    imageLoading.textContent = "Loading image...";

    imageElement.onload = () => {
        imageElement.style.display = "block";
        imageLoading.style.display = "none";
    };

    imageElement.onerror = () => {
        imageElement.style.display = "none";
        imageLoading.style.display = "block";
        imageLoading.textContent = "Image could not be displayed";
    };

    imageElement.src = url;
    imageElement.alt = altText || "Marine creature";
}


// =====================================
// WIKIMEDIA IMAGE
// =====================================

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

    const foundImage = pages.find(page =>
        page.imageinfo?.[0]?.thumburl ||
        page.imageinfo?.[0]?.url
    );

    if (!foundImage) return null;

    return (
        foundImage.imageinfo[0].thumburl ||
        foundImage.imageinfo[0].url
    );
}


// =====================================
// SINH VẬT TỪ API
// =====================================

async function loadAPIcreature() {
    if (!scientificName) {
        setText("creature-name", "No creature selected");
        setText(
            "creature-description",
            "Please select a creature first."
        );
        return;
    }

    try {
        const data = await getCreatureInfo(scientificName);

        const imageURL = await getCreatureImage(data.scientificName);
        displayCreatureImage(imageURL, data.scientificName);

        setText("creature-name", data.acceptedName);
        setText("scientific-name", data.scientificName);
        setText("creature-scientific", data.scientificName);

        setText(
            "creature-size",
            data.size?.category === "unknown"
                ? "Unknown"
                : data.size
                    ? `${data.size.category} (${data.size.valueCm} cm)`
                    : "Unknown"
        );

        setText(
            "creature-depth",
            data.depth
                ? `${data.depth.min} – ${data.depth.max} m`
                : "Unknown"
        );

        setText("creature-water-type", data.waterType || "Unknown");
        setText("creature-aphia", data.aphiaID || "Unknown");
        setText("creature-habitat", "Marine");

        setText(
            "creature-description",
            "Explore the biological characteristics and habitat of this marine species."
        );

    } catch (error) {
        console.error("API creature error:", error);

        setText("creature-name", scientificName);
        setText(
            "creature-description",
            "Unable to retrieve biological information."
        );

        setText("creature-size", "Unknown");
        setText("creature-depth", "Unknown");
        setText("creature-water-type", "Unknown");
        setText("creature-habitat", "Unknown");
        setText("creature-aphia", "Unknown");
    }
}


// =====================================
// SINH VẬT DO NGƯỜI DÙNG THÊM
// =====================================

async function loadCustomCreature(user) {
    try {
        if (!user) {
            setText("creature-name", "Login required");

            setText(
                "creature-description",
                "Please log in with the account that added this creature."
            );

            displayCreatureImage(null);
            return;
        }

        if (!customId) {
            throw new Error("Missing creature ID.");
        }

        // Chỉ đọc collection của tài khoản hiện tại
        const creatureDoc = await db
            .collection("users")
            .doc(user.uid)
            .collection("creatures")
            .doc(customId)
            .get();

        if (!creatureDoc.exists) {
            throw new Error(
                "Creature not found or you do not have permission to view it."
            );
        }

        const data = creatureDoc.data();

        // Hiển thị ảnh Cloudinary
        displayCreatureImage(
            data.imageURL,
            data.scientificName
        );

        // Hiển thị tên sinh vật
        setText("creature-name", data.scientificName);
        setText("scientific-name", data.scientificName);
        setText("creature-scientific", data.scientificName);

        // Hiển thị 5 thông tin đã lưu
        setText("creature-size", data.size);
        setText("creature-depth", data.depthRange);
        setText("creature-water-type", data.waterType);
        setText("creature-habitat", data.habitat);

        // Sinh vật do người dùng thêm không có Aphia ID mặc định
        setText("creature-aphia", "User-added");

        setText(
            "creature-description",
            "This creature was added to The Abyss by a member of the community."
        );

        // Đổi nhãn phân loại
        const category = document.querySelector(".category");

        if (category) {
            category.textContent = "COMMUNITY CREATURE";
        }

    } catch (error) {
        console.error("Custom creature error:", error);

        setText("creature-name", "Unable to load creature");

        setText(
            "creature-description",
            error.message || "Something went wrong."
        );

        displayCreatureImage(null);

        setText("creature-size", "Unknown");
        setText("creature-depth", "Unknown");
        setText("creature-water-type", "Unknown");
        setText("creature-habitat", "Unknown");
        setText("creature-aphia", "Unknown");
    }
}


// =====================================
// KHỞI CHẠY
// =====================================

async function loadCreaturePage() {
    // Ưu tiên ID sinh vật cá nhân
    if (customId) {
        if (typeof auth === "undefined" ||
            typeof db === "undefined") {
            setText("creature-name", "Firebase unavailable");
            setText(
                "creature-description",
                "Unable to connect to the database."
            );
            return;
        }

        auth.onAuthStateChanged(async (user) => {
            await loadCustomCreature(user);
        });

        return;
    }

    // Sinh vật API
    await loadAPIcreature();
}

loadCreaturePage();
