const imageInput = document.getElementById("creature-image");
const preview = document.getElementById("creature-preview");
const fileName = document.getElementById("add-cre-filename");
const addButton = document.getElementById("add-cre-submit");
const statusText = document.getElementById("add-cre-status");

const modal = document.getElementById("remove-bg-modal");
const removeBgButton = document.getElementById("remove-bg-btn");
const continueButton = document.getElementById("continue-add-btn");

let selectedImage = null;
let previewURL = null;

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

    // Giới hạn 10 MB
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

addButton.addEventListener("click", function () {
    if (!selectedImage) {
        alert("Please upload a creature image first.");
        return;
    }

    modal.classList.add("active");
});

removeBgButton.addEventListener("click", function () {
    window.open(
        "https://www.remove.bg/",
        "_blank",
        "noopener,noreferrer"
    );
});

continueButton.addEventListener("click", function () {
    modal.classList.remove("active");

    statusText.textContent =
        "Image ready! Creature can now be added.";

    // Tạm thời dừng tại đây.
    // Sẽ tích hợp chức năng lưu Firebase sau khi biết cấu trúc dữ liệu.
});

// Click bên ngoài modal để đóng
modal.addEventListener("click", function (event) {
    if (event.target === modal) {
        modal.classList.remove("active");
    }
});