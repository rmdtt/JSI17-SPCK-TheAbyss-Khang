// Sinh vật
const depthZones = {
  shallow: {
    name: "Vùng nông",
    minDepth: 0,
    maxDepth: 50
  },

  medium: {
    name: "Vùng trung bình",
    minDepth: 50,
    maxDepth: 200
  },

  deep: {
    name: "Vùng sâu",
    minDepth: 200,
    maxDepth: 1000
  },

  abyssal: {
    name: "Vùng rất sâu",
    minDepth: 1000,
    maxDepth: 6000
  }
};

async function fetchSpeciesByDepth(zone) {
  const params = new URLSearchParams({
    startdepth: zone.minDepth,
    enddepth: zone.maxDepth,
    size: 1000
  });

  const response = await fetch(
    `${OBIS_API}/occurrence?${params}`
  );

  if (!response.ok) {
    throw new Error(`OBIS error: ${response.status}`);
  }

  const data = await response.json();

  return data.results || [];
}

function filterMarineSpecies(records) {
  return records.filter(record =>
    record.marine === true ||
    record.marine === "true"
  );
}

function getUniqueSpecies(records) {
  const speciesMap = new Map();

  records.forEach(record => {
    const scientificName = record.scientificName;

    if (!scientificName) return;

    if (!speciesMap.has(scientificName)) {
      speciesMap.set(scientificName, {
        name: scientificName,
        scientificName: scientificName,
        observations: []
      });
    }

    speciesMap.get(scientificName).observations.push({
      depth: record.depth ?? null,
      latitude: record.decimalLatitude ?? null,
      longitude: record.decimalLongitude ?? null,
      date: record.eventDate ?? null
    });
  });

  return Array.from(speciesMap.values());
}

function getRandomSpecies(speciesList, limit) {
  const shuffled = [...speciesList];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] =
      [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, limit);
}

// Hiển thị sinh vật trực tiếp trong đại dương

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
    const pages = Object.values(data.query?.pages || {});

    const image = pages.find(page => {
      const info = page.imageinfo?.[0];

      return info &&
        ["image/jpeg", "image/png", "image/webp"].includes(info.mime);
    });

    return image?.imageinfo?.[0]?.thumburl ||
      image?.imageinfo?.[0]?.url ||
      null;

  } catch (error) {
    console.error("Image error:", error);
    return null;
  }
}


// Tạo bảng thông tin sinh vật
function showCreaturePopup(species, observation) {

  document.querySelector(".creature-popup")?.remove();

  const popup = document.createElement("div");

  popup.className = "creature-popup";

  const title = document.createElement("h3");
  title.textContent = species.name;

  const scientific = document.createElement("p");
  scientific.textContent = species.scientificName;

  const depth = document.createElement("p");
  depth.textContent =
    "Depth: " +
    (observation.depth ?? "Unknown") +
    (observation.depth != null ? " m" : "");

  const location = document.createElement("p");
  location.textContent =
    "Coordinates: " +
    (observation.latitude ?? "Unknown") +
    ", " +
    (observation.longitude ?? "Unknown");

  const close = document.createElement("button");
  close.textContent = "Close";
  close.onclick = () => popup.remove();

  popup.append(title, scientific, depth, location, close);

  document.body.appendChild(popup);
}


// Đưa sinh vật vào đại dương
async function displayCreatures(speciesList) {
  const layer = document.getElementById("creature-layer");

  if (!layer) return;

  layer.replaceChildren();

  const marginX = 100;
  const marginY = 50;

  const oceanWidth = layer.clientWidth;
  const oceanHeight = layer.clientHeight;

  const usableWidth = Math.max(1, oceanWidth - marginX * 2);
  const usableHeight = Math.max(1, oceanHeight - marginY * 2);

  const creatureSize = 220;
  const gap = 50;

  const columns = Math.max(
    1,
    Math.floor(usableWidth / (creatureSize + gap))
  );

  const rows = Math.max(
    1,
    Math.floor(usableHeight / (creatureSize + gap))
  );

  const cells = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      cells.push({
        x: marginX + (col + 0.5) * usableWidth / columns,
        y: marginY + (row + 0.5) * usableHeight / rows
      });
    }
  }

  // Trộn vị trí
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const shuffledSpecies = getRandomSpecies(
    speciesList,
    Math.min(speciesList.length, cells.length)
  );

  let displayed = 0;

  for (const species of shuffledSpecies) {
    const image = await getCreatureImage(
      species.scientificName
    );

    if (!image) {
      console.log("Không tìm thấy ảnh:", species.scientificName);
      continue;
    }

    if (displayed >= cells.length) break;

    const position = cells[displayed];

    const creature = document.createElement("a");

    creature.className = "ocean-creature";

    creature.href =
      `ifm.html?species=${encodeURIComponent(species.scientificName)}`;

    creature.style.left = `${position.x}px`;
    creature.style.top = `${position.y}px`;

    const img = document.createElement("img");

    img.src = image;
    img.alt = species.scientificName;
    img.loading = "lazy";

    const name = document.createElement("span");
    name.textContent = species.name;

    creature.append(img, name);
    layer.appendChild(creature);

    displayed++;
  }

  console.log(`Đã hiển thị ${displayed} sinh vật.`);
}


document.addEventListener("DOMContentLoaded", async () => {
  const layer = document.getElementById("creature-layer");

  if (!layer) return;

  try {
    console.log("Exploring The Abyss...");

    // Lấy dữ liệu từ tất cả các vùng độ sâu
    const results = await Promise.all(
      Object.values(depthZones).map(zone =>
        fetchSpeciesByDepth(zone)
      )
    );

    const allRecords = results.flat();

    // Chỉ giữ lại bản ghi của sinh vật biển
    const marineRecords = filterMarineSpecies(allRecords);

    // Gộp các loài biển trùng nhau
    const uniqueSpecies = getUniqueSpecies(marineRecords);

    // Chọn ngẫu nhiên 30 loài
    const selectedSpecies = getRandomSpecies(
      uniqueSpecies,
      60
    );

    console.log("Found species:", uniqueSpecies.length);

    await displayCreatures(selectedSpecies);

    console.log("The Abyss is ready!");

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