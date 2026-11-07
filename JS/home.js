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
// CACHE ẢNH
// =====================================

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
    console.error("Image error:", scientificName, error);
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

function generateCreaturePositions(zone, count) {
  const width = zone.clientWidth;
  const height = zone.clientHeight;

  const imageSize = 120;
  const leftReserved = 150;
  const padding = imageSize / 2 + 10;

  const minX = leftReserved + padding;
  const rightReserved = 100;
  const maxX = width - rightReserved - padding;

  const minY = padding;
  const maxY = height - padding;

  if (count === 0 || maxX <= minX || maxY <= minY) {
    console.error("Không đủ diện tích:", zone.id, {
      width,
      height
    });
    return [];
  }

  const positions = [];

  // Chia đều khoảng cách theo chiều dọc
  const spacingY = (maxY - minY) / count;

  for (let i = 0; i < count; i++) {
    const y = minY + spacingY * (i + 0.5);

    // Chia vùng ngang thành các khoảng để tránh dồn về một phía
    const x = minX + Math.random() * (maxX - minX);

    positions.push({ x, y });
  }

  return positions;
}

// =====================================
// HIỂN THỊ SINH VẬT
// =====================================

async function displayCreaturesByZone() {
  for (const [zoneId, speciesList] of Object.entries(creaturesByDepth)) {
    const zone = document.getElementById(zoneId);

    if (!zone) {
      console.warn("Không tìm thấy khu vực:", zoneId);
      continue;
    }

    try {
      console.log("Đang tải:", zoneId);

      zone.style.position = "relative";

      const images = await mapLimit(
        speciesList,
        5,
        name => getCachedCreatureImage(name)
      );

      const validSpecies = speciesList
        .map((scientificName, index) => ({
          scientificName,
          image: images[index]
        }))
        .filter(item => item.image);

      // Chờ trình duyệt cập nhật kích thước vùng
      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );

      const positions = generateCreaturePositions(
        zone,
        validSpecies.length
      );

      if (positions.length !== validSpecies.length) {
        console.error("Không tạo đủ vị trí:", zoneId);
        continue;
      }

      // Tạo sinh vật mới trước khi thay thế sinh vật cũ
      const fragment = document.createDocumentFragment();

      validSpecies.forEach((species, index) => {
        const position = positions[index];

        const creature = document.createElement("a");
        creature.className = "ocean-creature";

        creature.href =
          `ifm.html?species=${encodeURIComponent(species.scientificName)}`;

        creature.style.left = `${position.x}px`;
        creature.style.top = `${position.y}px`;

        const img = document.createElement("img");
        img.src = species.image;
        img.alt = "";
        img.loading = "lazy";

        creature.appendChild(img);
        fragment.appendChild(creature);
      });

      zone.querySelectorAll(".ocean-creature").forEach(element => {
        element.remove();
      });

      zone.appendChild(fragment);

      console.log(
        `${zoneId}: ${validSpecies.length} sinh vật`
      );

    } catch (error) {
      console.error(`Lỗi ở vùng ${zoneId}:`, error);
    }
  }

  console.log("The Abyss is ready!");
}

// =====================================
// KHỞI CHẠY
// =====================================

document.addEventListener("DOMContentLoaded", async () => {

  try {
    console.log("Exploring The Abyss...");

    await displayCreaturesByZone();

  } catch (error) {
    console.error("Cannot load creatures:", error);
  }

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