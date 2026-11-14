// =====================================
// DANH SÁCH SINH VẬT THEO ĐỘ SÂU
// =====================================

const creaturesByDepth = {
  shallow: [
    "Amphiprion ocellaris",
    "Mola mola",
    "Triaenodon obesus",
    "Aetobatus narinari",
    "Chelonia mydas",
    "Hippocampus kuda",
    "Scarus ghobban",
    "Chaetodon auriga",
    "Bolbometopon muricatum",
    "Sphyraena barracuda"
  ],

  medium: [
    "Argyropelecus hemigymnus",
    "Benthosema glaciale",
    "Xiphias gladius",
    "Scomber japonicus",
    "Prionace glauca",
    "Thunnus obesus",
    "Hexanchus griseus",
    "Dosidicus gigas",
    "Stomiidae",
    "Anguilla anguilla"
  ],

  deep: [
    "Chauliodus sloani",
    "Idiacanthus antrostomus",
    "Melanocetus johnsonii",
    "Anoplogaster cornuta",
    "Myctophidae",
    "Vampyroteuthis infernalis",
    "Mitsukurina owstoni",
    "Somniosus microcephalus",
    "Trachipterus arcticus",
    "Atolla wyvillei"
  ],

  abyssal: [
    "Bathypterois grallator",
    "Pseudoliparis amblystomopsis",
    "Coryphaenoides armatus",
    "Scotoplanes globosa",
    "Hymenaster pellucidus",
    "Actiniaria",
    "Munnopsidae",
    "Copepoda",
    "Riftia pachyptila",
    "Siboglinidae"
  ]
};

// =====================================
// LẤY NGẪU NHIÊN SV
// =====================================


const creatureManager = {

  getRandomCreatures(depth, count = 10) {

    const list = creaturesByDepth[depth];

    if (!list) {
      console.warn("Độ sâu không tồn tại:", depth);
      return [];
    }

    // Trộn ngẫu nhiên danh sách
    const shuffled = [...list];

    for (let i = shuffled.length - 1; i > 0; i--) {

      const j = Math.floor(Math.random() * (i + 1));

      [shuffled[i], shuffled[j]] =
        [shuffled[j], shuffled[i]];

    }

    return shuffled.slice(
      0,
      Math.min(count, shuffled.length)
    );

  },

  getRandomShallow(count = 10) {
    return this.getRandomCreatures("shallow", count);
  },

  getRandomMedium(count = 10) {
    return this.getRandomCreatures("medium", count);
  },

  getRandomDeep(count = 10) {
    return this.getRandomCreatures("deep", count);
  },

  getRandomAbyssal(count = 10) {
    return this.getRandomCreatures("abyssal", count);
  }

};

const imageCache = new Map();

// =====================================
// TÌM ẢNH WIKIMEDIA
// =====================================

async function getCreatureImage(scientificName) {

  try {

    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `"${scientificName}"`,
      gsrnamespace: "6",
      gsrlimit: "10",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "400",
      format: "json",
      origin: "*"
    });

    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`
    );

    if (!response.ok) return null;

    const data = await response.json();

    const pages = Object.values(
      data.query?.pages || {}
    );

    const image = pages.find(page => {

      const info = page.imageinfo?.[0];

      return info &&
        ["image/jpeg", "image/png", "image/webp"]
          .includes(info.mime);

    });

    return image?.imageinfo?.[0]?.thumburl ||
      image?.imageinfo?.[0]?.url ||
      null;

  } catch (error) {

    console.error(
      "Image error:",
      scientificName,
      error
    );

    return null;

  }

}

// =====================================
// CACHE ẢNH
// =====================================

async function getCachedCreatureImage(scientificName) {

  if (!imageCache.has(scientificName)) {

    imageCache.set(
      scientificName,
      getCreatureImage(scientificName)
    );

  }

  return imageCache.get(scientificName);

}

// =====================================
// GIỚI HẠN REQUEST ĐỒNG THỜI
// =====================================

async function mapLimit(items, limit, callback) {

  const results = new Array(items.length);

  let nextIndex = 0;

  async function worker() {

    while (true) {

      const index = nextIndex++;

      if (index >= items.length) return;

      try {

        results[index] = await callback(items[index]);

      } catch (error) {

        console.error(error);

        results[index] = null;

      }

    }

  }

  await Promise.all(

    Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    )

  );

  return results;

}

// =====================================
// TẠO VỊ TRÍ SINH VẬT
// =====================================

function generateCreaturePositions(zone, count, options = {}) {

    const {
        imageSize = 120,
        gapX = 35,
        gapY = 35,
        leftReserved = 150,
        rightReserved = 100,
        padding = 20,

        // Mức độ ngẫu nhiên của vị trí
        randomness = 0.7,

        // Số lần thử tìm vị trí phù hợp
        maxAttempts = 100
    } = options;

    const width = zone.clientWidth;
    const height = zone.clientHeight;

    const minX = leftReserved + imageSize / 2 + padding;
    const maxX = width - rightReserved - imageSize / 2 - padding;

    const minY = imageSize / 2 + padding;
    const maxY = height - imageSize / 2 - padding;

    if (
        count <= 0 ||
        maxX <= minX ||
        maxY <= minY
    ) {
        return [];
    }

    const positions = [];

    // Khoảng cách tối thiểu giữa hai sinh vật
    const minDistance = imageSize + Math.min(gapX, gapY);

    // Kiểm tra vị trí có quá gần sinh vật khác không
    function isValidPosition(x, y) {

        for (const creature of positions) {

            const dx = x - creature.x;
            const dy = y - creature.y;

            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                return false;
            }
        }

        return true;
    }

    // Tạo vị trí ngẫu nhiên
    for (let i = 0; i < count; i++) {

        let placed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {

            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);

            if (isValidPosition(x, y)) {

                positions.push({
                    x,
                    y,
                    rotation: (Math.random() - 0.5) * 12,
                    scale: 0.85 + Math.random() * 0.3
                });

                placed = true;
                break;
            }
        }

        // Nếu không tìm được vị trí phù hợp,
        // bỏ qua sinh vật này để tránh chồng lấn.
        if (!placed) {
            console.warn(
                "Không tìm được vị trí cho sinh vật:",
                i,
                zone.id
            );
        }
    }

    return positions;
}


// =====================================
// HIỂN THỊ SINH VẬT THEO KHU VỰC
// =====================================

async function renderCreatures(depth) {

  const zone = document.getElementById(depth);

  if (!zone) {
    console.warn("Không tìm thấy khu vực:", depth);
    return;
  }

  const speciesList = creatureManager.activeCreatures?.[depth];

  if (!speciesList) return;

  zone.style.position = "relative";

  // Tải ảnh
  const images = await mapLimit(
    speciesList,
    5,
    name => getCachedCreatureImage(name)
  );

  // Lọc sinh vật có ảnh
  const validSpecies = speciesList
    .map((scientificName, index) => ({
      scientificName,
      image: images[index]
    }))
    .filter(item => item.image);

  // Tính vị trí
  const positions = generateCreaturePositions(
    zone,
    validSpecies.length
  );

  if (positions.length !== validSpecies.length) {
    console.warn("Không đủ vị trí:", depth);
    return;
  }

  // Lưu các phần tử hiện tại để tái sử dụng
  const existingCreatures = new Map();

  zone.querySelectorAll(".ocean-creature").forEach(
    creature => {

      const name = creature.dataset.species;

      if (name) {
        existingCreatures.set(name, creature);
      }

    }
  );

  const fragment = document.createDocumentFragment();

  validSpecies.forEach((species, index) => {

    const position = positions[index];

    let creature = existingCreatures.get(
      species.scientificName
    );

    // Tạo mới nếu chưa có
    if (!creature) {

      creature = document.createElement("a");

      creature.className = "ocean-creature";

      creature.dataset.species =
        species.scientificName;

      const img = document.createElement("img");

      img.alt = species.scientificName;

      img.loading = "lazy";

      creature.appendChild(img);

    }

    // Cập nhật liên kết
    creature.href =
      `ifm.html?species=${encodeURIComponent(
        species.scientificName
      )}`;

    // Cập nhật vị trí
    creature.style.left = `${position.x}px`;
    creature.style.top = `${position.y}px`;

    creature.style.transform =
      "translate(-50%, -50%)";

    // Cập nhật ảnh
    creature.querySelector("img").src = species.image;

    fragment.appendChild(creature);

  });

  // Thay thế các phần tử cũ
  zone.querySelectorAll(".ocean-creature").forEach(
    element => element.remove()
  );

  zone.appendChild(fragment);

  console.log(
    `${depth}: ${validSpecies.length} sinh vật`
  );

}

// =====================================
// HIỂN THỊ TẤT CẢ KHU VỰC
// =====================================

async function renderAllCreatures() {

  const depths = [
    "shallow",
    "medium",
    "deep",
    "abyssal"
  ];

  await Promise.all(
    depths.map(depth => renderCreatures(depth))
  );

}



// =====================================
// QUẢN LÝ DANH SÁCH ĐANG HIỂN THỊ
// =====================================

creatureManager.activeCreatures = {
  shallow: [],
  medium: [],
  deep: [],
  abyssal: []
};

// =====================================
// KHỞI CHẠY
// =====================================

document.addEventListener("DOMContentLoaded", async () => {

  console.log("Exploring The Abyss...");

  // Chọn sinh vật ngẫu nhiên
  creatureManager.activeCreatures.shallow =
    creatureManager.getRandomShallow(10);

  creatureManager.activeCreatures.medium =
    creatureManager.getRandomMedium(10);

  creatureManager.activeCreatures.deep =
    creatureManager.getRandomDeep(10);

  creatureManager.activeCreatures.abyssal =
    creatureManager.getRandomAbyssal(10);

  // Hiển thị
  await renderAllCreatures();

  console.log("The Abyss is ready!");

});


// Thanh đo độ sâu
document.addEventListener("DOMContentLoaded", () => {
  const ocean = document.querySelector(".ocean");
  const depthRuler = document.getElementById("depth-ruler");
  const submarinePointer = document.getElementById("submarine-pointer");
  const depthValue = document.getElementById("depth-value");

  const MAX_DEPTH = 11000;

  if (!ocean || !depthRuler || !submarinePointer || !depthValue) {
    console.error("Thiếu phần tử HTML của thanh đo độ sâu.");
    return;
  }

  function updateDepth() {
    // Vị trí bắt đầu của đại dương trên trang
    const oceanTop =
      ocean.getBoundingClientRect().top + window.scrollY;

    // Hiện thước khi bắt đầu cuộn đến mặt nước
    const reachedOcean = window.scrollY >= oceanTop - 2;

    depthRuler.classList.toggle("visible", reachedOcean);

    // Tính độ sâu theo vị trí cuộn
    const oceanHeight = ocean.offsetHeight;
    const maxScroll = Math.max(
      1,
      oceanHeight - window.innerHeight
    );

    const relativeScroll = window.scrollY - oceanTop;

    const progress = Math.max(
      0,
      Math.min(1, relativeScroll / maxScroll)
    );

    // Cập nhật tàu ngầm
    submarinePointer.style.top = `${progress * 100}%`;

    // Cập nhật số mét
    const depth = Math.round(progress * MAX_DEPTH);
    depthValue.textContent =
      `${depth.toLocaleString("en-US")} m`;
  }

  window.addEventListener("scroll", updateDepth, {
    passive: true
  });

  window.addEventListener("resize", updateDepth);

  updateDepth();
});

["shallow", "medium", "deep", "abyssal"].forEach(id => {
  const zone = document.getElementById(id);

  console.log(id, {
    exists: !!zone,
    width: zone?.clientWidth,
    height: zone?.clientHeight,
    display: zone && getComputedStyle(zone).display,
    position: zone && getComputedStyle(zone).position
  });
});