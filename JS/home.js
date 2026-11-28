const ZONE_DEPTH_RANGES = {
  shallow: { min: 0, max: 200 },
  medium: { min: 200, max: 1000 },
  deep: { min: 1000, max: 4000 },
  abyssal: { min: 4000, max: 11000 }
};

function parseCreatureDepthRange(depthRange) {
  if (!depthRange) return null;

  const numbers = String(depthRange).match(/\d+(?:\.\d+)?/g);

  if (!numbers || numbers.length === 0) {
    return null;
  }

  const depths = numbers.map(Number);

  return {
    min: Math.min(...depths),
    max: Math.max(...depths)
  };
}
// =====================================
// QUẢN LÝ SINH VẬT
// =====================================

const creatureManager = {
  activeCreatures: {
    shallow: [],
    medium: [],
    deep: [],
    abyssal: []
  }
};

const imageCache = new Map();

// Lưu riêng dữ liệu API để khi đăng xuất
// có thể quay về danh sách sinh vật API.
let apiCreatures = {
  shallow: [],
  medium: [],
  deep: [],
  abyssal: []
};


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

function generateCreaturePositions(zone, count, options = {}) {
  const {
    imageSize = 120,
    gapX = 35,
    gapY = 35,
    leftReserved = 150,
    rightReserved = 100,
    padding = 20,
    maxAttempts = 300,
    depthRanges = [],
    zoneDepthRange = { min: 0, max: 11000 },
    zoneTopPx = 0
  } = options;

  const width = zone.clientWidth;
  const height = zone.clientHeight;

  const minX = leftReserved + imageSize / 2 + padding;
  const maxX = width - rightReserved - imageSize / 2 - padding;

  const minY = imageSize / 2 + padding;
  const maxY = height - imageSize / 2 - padding;

  if (count <= 0 || maxX <= minX || maxY <= minY) {
    return [];
  }

  const positions = [];
  const minDistance = imageSize + Math.min(gapX, gapY);

  // 5 px tương ứng 1 m trên toàn đại dương.
  function depthToY(depth) {
    return depth * 5;
  }

  function isValidPosition(x, y) {
    for (const creature of positions) {
      const dx = x - creature.x;
      const dy = y - creature.y;

      if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
        return false;
      }
    }

    return true;
  }

  for (let i = 0; i < count; i++) {
    let placed = false;

    const creatureRange = depthRanges[i];

    let allowedMinY = minY;
    let allowedMaxY = maxY;

    if (creatureRange) {
      const minDepth = Math.max(
        creatureRange.min,
        zoneDepthRange.min
      );

      const maxDepth = Math.min(
        creatureRange.max,
        zoneDepthRange.max
      );

      if (minDepth > maxDepth) {
        console.warn(
          "Sinh vật không thuộc khu vực:",
          creatureRange
        );
        continue;
      }

      // Tọa độ toàn đại dương
      const globalMinY = depthToY(minDepth);
      const globalMaxY = depthToY(maxDepth);

      // Đổi sang tọa độ bên trong zone
      allowedMinY = Math.max(
        minY,
        globalMinY - zoneTopPx
      );

      allowedMaxY = Math.min(
        maxY,
        globalMaxY - zoneTopPx
      );
    }

    if (allowedMaxY < allowedMinY) {
      console.warn(
        "Khoảng tọa độ không hợp lệ:",
        creatureRange,
        { allowedMinY, allowedMaxY, zoneTopPx, height }
      );
      continue;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = minX + Math.random() * (maxX - minX);

      const y =
        allowedMinY +
        Math.random() * (allowedMaxY - allowedMinY);

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

    if (!placed) {
      console.warn(
        "Không tìm được vị trí cho sinh vật:",
        i,
        creatureRange
      );
    }
  }

  return positions;
}


// =====================================
// CHUẨN HÓA DỮ LIỆU SINH VẬT
// =====================================

function normalizeCreature(item) {
  // Sinh vật API thường là tên khoa học dạng string.
  if (typeof item === "string") {
    return {
      scientificName: item,
      imageURL: null,
      isUserCreature: false
    };
  }

  // Sinh vật người dùng lấy imageURL từ Cloudinary.
  if (item && typeof item === "object") {
    return {
      ...item,
      scientificName: item.scientificName || item.name || "",
      imageURL: item.imageURL || null,
      isUserCreature: !!item.imageURL
    };
  }

  return null;
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

  const speciesList = creatureManager.activeCreatures?.[depth] || [];

  zone.style.position = "relative";

  // Chuẩn hóa dữ liệu
  const normalizedSpecies = speciesList
    .map(normalizeCreature)
    .filter(item => item && item.scientificName);

  // Sinh vật người dùng dùng ảnh Cloudinary.
  // Sinh vật API tiếp tục tìm ảnh Wikimedia.
  const images = await mapLimit(
    normalizedSpecies,
    5,
    item => {
      if (item.imageURL) {
        return Promise.resolve(item.imageURL);
      }

      return getCachedCreatureImage(item.scientificName);
    }
  );

  const validSpecies = normalizedSpecies
    .map((item, index) => ({
      ...item,
      image: images[index]
    }))
    .filter(item => item.image);

  const depthRanges = validSpecies.map(species => {
    if (!species.isUserCreature) {
      return null;
    }

    return parseCreatureDepthRange(species.depthRange);
  });

  const ocean = document.querySelector(".ocean");

  if (!ocean) {
    console.error("Không tìm thấy .ocean");
    return;
  }

  // Vị trí bắt đầu của zone so với toàn đại dương.
  const zoneTopPx =
    zone.getBoundingClientRect().top -
    ocean.getBoundingClientRect().top;

  const positions = generateCreaturePositions(
    zone,
    validSpecies.length,
    {
      depthRanges,
      zoneDepthRange: ZONE_DEPTH_RANGES[depth],
      zoneTopPx
    }
  );

  if (positions.length !== validSpecies.length) {
    console.warn("Không đủ vị trí:", depth);
    return;
  }

  const fragment = document.createDocumentFragment();

  validSpecies.forEach((species, index) => {
    const position = positions[index];

    const creature = document.createElement("a");
    creature.className = "ocean-creature";

    creature.dataset.species = species.scientificName;

    if (species.isUserCreature) {
      creature.dataset.customCreature = "true";
      creature.dataset.creatureId = species.id || "";
    }

    if (species.isUserCreature && species.id) {
      creature.href =
        `ifm.html?customId=${encodeURIComponent(species.id)}`;
    } else {
      creature.href =
        `ifm.html?species=${encodeURIComponent(
          species.scientificName
        )}`;
    }

    creature.style.left = `${position.x}px`;
    creature.style.top = `${position.y}px`;
    creature.style.transform = "translate(-50%, -50%)";

    const img = document.createElement("img");

    img.src = species.image;
    img.alt = species.scientificName;
    img.loading = "lazy";

    img.style.width = "120px";
    img.style.height = "120px";
    img.style.objectFit = "contain";

    creature.appendChild(img);
    fragment.appendChild(creature);
  });

  // Xóa sinh vật cũ
  zone.querySelectorAll(".ocean-creature").forEach(
    element => element.remove()
  );

  // Hiển thị sinh vật mới
  zone.appendChild(fragment);

  console.log(`${depth}: ${validSpecies.length} sinh vật`);
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
// LẤY SINH VẬT CỦA TÀI KHOẢN
// =====================================

async function getUserCreatures(user) {
  const userCreatures = {
    shallow: [],
    medium: [],
    deep: [],
    abyssal: []
  };

  if (!user || typeof db === "undefined") {
    return userCreatures;
  }

  try {
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("creatures")
      .get();

    snapshot.forEach(document => {
      const data = document.data();

      if (!data.imageURL || !data.scientificName) {
        return;
      }

      const zone = data.zone;

      if (!userCreatures[zone]) {
        console.warn("Zone không hợp lệ:", zone);
        return;
      }

      userCreatures[zone].push({
        id: document.id,
        ...data,
        isUserCreature: true
      });
    });

    console.log("Sinh vật của tài khoản:", userCreatures);

  } catch (error) {
    console.error("Không thể tải sinh vật người dùng:", error);
  }

  return userCreatures;
}


// =====================================
// KẾT HỢP API VÀ FIRESTORE
// =====================================

async function loadCreaturesForUser(user) {
  const userCreatures = await getUserCreatures(user);

  const depths = [
    "shallow",
    "medium",
    "deep",
    "abyssal"
  ];

  creatureManager.activeCreatures = {
    shallow: [],
    medium: [],
    deep: [],
    abyssal: []
  };

  depths.forEach(depth => {
    creatureManager.activeCreatures[depth] = [
      ...(apiCreatures[depth] || []),
      ...(userCreatures[depth] || [])
    ];
  });

  await renderAllCreatures();
}


// =====================================
// KHỞI CHẠY
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Exploring The Abyss...");

  try {
    if (typeof getRandomCreaturesFromOBIS !== "function") {
      throw new Error(
        "Không tìm thấy getRandomCreaturesFromOBIS() trong APi.js"
      );
    }

    // Lấy sinh vật API
    const creatures = await getRandomCreaturesFromOBIS();

    console.log("Dữ liệu sinh vật từ API:", creatures);

    apiCreatures = creatures;

    // Khởi tạo danh sách API trước
    creatureManager.activeCreatures = {
      shallow: [...(apiCreatures.shallow || [])],
      medium: [...(apiCreatures.medium || [])],
      deep: [...(apiCreatures.deep || [])],
      abyssal: [...(apiCreatures.abyssal || [])]
    };

    // Hiển thị API ngay cả khi chưa đăng nhập
    await renderAllCreatures();

    // Nếu Firebase Auth chưa được tải, chỉ hiển thị API
    if (
      typeof auth === "undefined" ||
      typeof db === "undefined"
    ) {
      console.warn("Firebase chưa sẵn sàng. Chỉ hiển thị sinh vật API.");
      return;
    }

    // Theo dõi trạng thái đăng nhập
    auth.onAuthStateChanged(async (user) => {
      console.log(
        user
          ? "Đã đăng nhập. Đang tải sinh vật cá nhân..."
          : "Đang ở chế độ khách."
      );

      await loadCreaturesForUser(user);
    });

    console.log("The Abyss is ready!");

  } catch (error) {
    console.error("Lỗi tải sinh vật:", error);
  }
});


// =====================================
// THANH ĐO ĐỘ SÂU
// =====================================

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
    const oceanTop =
      ocean.getBoundingClientRect().top + window.scrollY;

    const reachedOcean = window.scrollY >= oceanTop - 2;

    depthRuler.classList.toggle("visible", reachedOcean);

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

    submarinePointer.style.top = `${progress * 100}%`;

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


// =====================================
// KIỂM TRA CÁC KHU VỰC
// =====================================

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
// KIỂM TRA MOBS
// =====================================

console.log("REAL_SCALE:", REAL_SCALE);
console.log("getMOBSInfo:", typeof getMOBSInfo);

getMOBSInfo("Balaenoptera musculus")
  .then(data => {
    console.log("MOBS TEST:", data);

    console.log(
      "SIZE TEST:",
      calculateCreatureSize(data?.lengthCm)
    );
  })
  .catch(error => console.error("MOBS TEST ERROR:", error));
