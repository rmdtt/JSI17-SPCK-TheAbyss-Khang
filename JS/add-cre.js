
const imageInput = document.getElementById("creature-image");
const preview = document.getElementById("creature-preview");
const fileName = document.getElementById("add-cre-filename");
const addButton = document.getElementById("add-cre-submit");
const statusText = document.getElementById("add-cre-status");

const modal = document.getElementById("remove-bg-modal");
const removeBgButton = document.getElementById("remove-bg-btn");
const continueButton = document.getElementById("continue-add-btn");

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = "r95y5qmu";
const CLOUDINARY_UPLOAD_PRESET = "the_abyss_upload";

let selectedImage = null;
let previewURL = null;
let isSaving = false;


// Wait until Firebase confirms the current login state
function getCurrentUser() {
    return new Promise((resolve) => {
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }

        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}


// Get the depth zone from the depth range
function getDepthZone(depthRange) {
    const numbers = depthRange.match(/\d+(?:\.\d+)?/g);

    if (!numbers || numbers.length === 0) {
        return null;
    }

    const depths = numbers.map(Number);
    const averageDepth = depths.reduce((sum, value) => sum + value, 0)
        / depths.length;

    if (averageDepth <= 200) return "shallow";
    if (averageDepth <= 1000) return "medium";
    if (averageDepth <= 4000) return "deep";
    if (averageDepth <= 11000) return "abyssal";

    return null;
}


// Upload image to Cloudinary
async function uploadImageToCloudinary(file) {
    const uploadURL =
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(uploadURL, {
        method: "POST",
        body: formData
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message || "Could not upload image to Cloudinary."
        );
    }

    return result;
}


// Save creature information to Firestore
async function saveCreature() {
    if (isSaving) return;

    const user = await getCurrentUser();

    if (!user) {
        statusText.textContent =
            "Please log in before adding a creature.";
        return;
    }

    if (!selectedImage) {
        statusText.textContent = "Please upload a creature image first.";
        return;
    }

    // Collect creature information
    const scientificName =
        document.getElementById("scientific-name").value.trim();

    const size =
        document.getElementById("creature-size").value.trim();

    const depthRange =
        document.getElementById("depth-range").value.trim();

    const waterType =
        document.getElementById("water-type").value;

    const habitat =
        document.getElementById("creature-habitat").value;

    if (!scientificName || !size || !depthRange || !waterType || !habitat) {
        statusText.textContent =
            "Please complete all creature information fields.";
        return;
    }

    const zone = getDepthZone(depthRange);

    if (!zone) {
        statusText.textContent =
            "Please enter a valid depth range between 0 and 11000 m.";
        return;
    }

    isSaving = true;
    continueButton.disabled = true;
    addButton.disabled = true;

    try {
        statusText.textContent = "Uploading creature image...";

        // 1. Upload image to Cloudinary
        const uploadedImage =
            await uploadImageToCloudinary(selectedImage);

        // 2. Prepare creature data
        const creatureData = {
            scientificName,
            size,
            depthRange,
            waterType,
            habitat,
            zone,

            imageURL: uploadedImage.secure_url,
            imagePublicId: uploadedImage.public_id,

            userId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        statusText.textContent = "Saving creature information...";

        // 3. Save under the current user's collection
        await db
            .collection("users")
            .doc(user.uid)
            .collection("creatures")
            .add(creatureData);

        statusText.textContent =
            "Creature added successfully!";

        // Reset the form
        imageInput.value = "";
        document.getElementById("scientific-name").value = "";
        document.getElementById("creature-size").value = "";
        document.getElementById("depth-range").value = "";
        document.getElementById("water-type").value = "";
        document.getElementById("creature-habitat").value = "";

        selectedImage = null;

        if (previewURL) {
            URL.revokeObjectURL(previewURL);
            previewURL = null;
        }

        preview.src = "";
        preview.style.display = "none";
        fileName.textContent = "";

        addButton.disabled = true;
        modal.classList.remove("active");

    } catch (error) {
        console.error("Add creature error:", error);

        statusText.textContent =
            error.message || "Something went wrong. Please try again.";

    } finally {
        isSaving = false;
        continueButton.disabled = false;
        addButton.disabled = !selectedImage;
    }
}


// Select and preview image
imageInput.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) return;

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert("Please choose a PNG, JPG or WEBP image.");
        this.value = "";
        return;
    }

    // Maximum image size: 10 MB
    if (file.size > 10 * 1024 * 1024) {
        alert("Image must be smaller than 10 MB.");
        this.value = "";
        return;
    }

    selectedImage = file;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    previewURL = URL.createObjectURL(file);

    preview.src = previewURL;
    preview.style.display = "block";

    fileName.textContent = file.name;

    addButton.disabled = false;
    statusText.textContent = "";
});


// Show remove background modal
addButton.addEventListener("click", function () {
    if (!selectedImage) {
        alert("Please upload a creature image first.");
        return;
    }

    modal.classList.add("active");
});


// Open remove.bg in a new tab
removeBgButton.addEventListener("click", function () {
    window.open(
        "https://www.remove.bg/",
        "_blank",
        "noopener,noreferrer"
    );
});


// Continue and save creature
continueButton.addEventListener("click", function () {
    saveCreature();
});


// Close modal when clicking outside
modal.addEventListener("click", function (event) {
    if (event.target === modal && !isSaving) {
        modal.classList.remove("active");
    }
});
