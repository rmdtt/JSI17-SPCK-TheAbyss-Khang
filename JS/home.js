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

  const leftReserved = 150;
  const imageSize = 55;
  const padding = 10;

  const startX = leftReserved + imageSize / 2;
  const endX = width - imageSize / 2;
  const startY = imageSize / 2;
  const endY = height - imageSize / 2;

  const positions = [];

  if (endX <= startX || endY <= startY) {
    console.error("Không đủ diện tích:", zone.id);
    return positions;
  }

  const columns = Math.min(
    count,
    Math.max(1, Math.floor((endX - startX) / 100))
  );

  const rows = Math.ceil(count / columns);

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;

    const itemsInRow = Math.min(
      columns,
      count - row * columns
    );

    const cellWidth = (endX - startX) / itemsInRow;
    const cellHeight = (endY - startY) / rows;

    positions.push({
      x: startX + col * cellWidth + cellWidth / 2,
      y: startY + row * cellHeight + cellHeight / 2
    });
  }

  return positions;
}

// =====================================
// HIỂN THỊ SINH VẬT
// =====================================

async function displayCreaturesByZone() {
  for (const [zoneId, speciesList] of Object.entries(creaturesByDepth)) {
    try {
      const zone = document.getElementById(zoneId);

      if (!zone) {
        console.warn("Không tìm thấy khu vực:", zoneId);
        continue;
      }

      // Đảm bảo sinh vật được định vị trong vùng tương ứng
      zone.style.position = "relative";

      zone.querySelectorAll(".ocean-creature")
        .forEach(element => element.remove());

      console.log("Đang tải:", zoneId);

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

      const positions = generateCreaturePositions(
        zone,
        validSpecies.length
      );

      validSpecies.forEach((species, index) => {
        const position = positions[index];

        if (!position) return;

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
        zone.appendChild(creature);
      });

      console.log(
        `${zoneId}: ${zone.querySelectorAll(".ocean-creature").length} sinh vật`
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

// =====================================
// KIỂM TRA CHI TIẾT 4 VÙNG
// =====================================

function checkOceanZones() {
  const ids = ["shallow", "medium", "deep", "abyssal"];

  const results = ids.map(id => {
    const zone = document.getElementById(id);

    if (!zone) {
      return {
        Zone: id,
        Exists: false
      };
    }

    const css = getComputedStyle(zone);
    const rect = zone.getBoundingClientRect();

    return {
      Zone: id,
      Exists: true,
      Width: zone.clientWidth,
      Height: zone.clientHeight,
      Display: css.display,
      Position: css.position,
      Visibility: css.visibility,
      Opacity: css.opacity,
      ZIndex: css.zIndex,
      Overflow: css.overflow,
      Creatures: zone.querySelectorAll(".ocean-creature").length,
      Top: Math.round(rect.top),
      Left: Math.round(rect.left)
    };
  });

  console.log("===== THE ABYSS DEBUG =====");
  console.table(results);
}

window.addEventListener("load", () => {
  setTimeout(checkOceanZones, 1500);
});