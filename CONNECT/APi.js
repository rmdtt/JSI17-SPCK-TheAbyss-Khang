
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const API = {
  worms: "https://www.marinespecies.org/rest",
  obis: "https://api.obis.org/v3",
  gbif: "https://api.gbif.org/v1",
  mobs: "https://raw.githubusercontent.com/crmcclain/MOBS_OPEN/main/data_all_112224.csv",
  temperature: "https://marine-api.open-meteo.com/v1/marine"
};

const cache = new Map();
let mobsPromise = null;


// ========================================
// 1. HÀM GỌI API
// ========================================

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}


// ========================================
// 2. WORMS - TÊN KHOA HỌC VÀ APHIA ID
// ========================================

async function getWoRMSInfo(scientificName) {
  const url =
    `${API.worms}/AphiaRecordsByName/` +
    `${encodeURIComponent(scientificName)}?marine_only=true`;

  const records = await fetchJSON(url);

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  const record = records.find(item =>
    item.status?.toLowerCase() === "accepted"
  ) || records[0];

  return {
    aphiaID: record.AphiaID,
    scientificName: record.scientificname,
    acceptedName: record.valid_name || record.scientificname
  };
}


// ========================================
// 3. OBIS - ĐỘ SÂU VÀ TỌA ĐỘ GHI NHẬN
// ========================================

async function getOBISInfo(aphiaID) {
  if (!aphiaID) return null;

  const url = new URL(`${API.obis}/occurrence`);

  url.searchParams.set("taxonid", aphiaID);
  url.searchParams.set("size", "1000");

  const result = await fetchJSON(url);
  const records = result.results || [];

  // Lấy độ sâu hợp lệ
  const depths = records
    .map(item => item.depth)
    .filter(value =>
      value !== null &&
      value !== undefined &&
      value !== ""
    )
    .map(Number)
    .filter(value =>
      Number.isFinite(value) && value >= 0
    );

  // Lấy tọa độ hợp lệ
  const locations = records
    .filter(item =>
      item.decimalLatitude != null &&
      item.decimalLongitude != null &&
      Number.isFinite(Number(item.decimalLatitude)) &&
      Number.isFinite(Number(item.decimalLongitude)) &&
      Number(item.decimalLatitude) >= -90 &&
      Number(item.decimalLatitude) <= 90 &&
      Number(item.decimalLongitude) >= -180 &&
      Number(item.decimalLongitude) <= 180
    )
    .map(item => ({
      latitude: Number(item.decimalLatitude),
      longitude: Number(item.decimalLongitude)
    }));

  return {
    totalRecords: result.total ?? records.length,

    minDepth: depths.length
      ? Math.min(...depths)
      : null,

    maxDepth: depths.length
      ? Math.max(...depths)
      : null,

    locations
  };
}

// ========================================
// 4. PHÂN LOẠI NƯỚC LẠNH / NƯỚC ẤM
// ========================================

async function getWaterTemperature(latitude, longitude) {
  const url = new URL(API.temperature);

  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("hourly", "sea_surface_temperature");
  url.searchParams.set("forecast_days", "1");

  const result = await fetchJSON(url);

  const temperatures =
    result.hourly?.sea_surface_temperature || [];

  const validTemperatures = temperatures
    .map(Number)
    .filter(value => Number.isFinite(value));

  if (!validTemperatures.length) {
    return null;
  }

  return validTemperatures.reduce(
    (sum, value) => sum + value, 0
  ) / validTemperatures.length;
}

function classifyWaterType(temperature) {
  if (temperature == null) {
    return "Unknown";
  }

  return temperature < 15
    ? "Cold Water"
    : "Warm Water";
}

// ========================================
// 5. GBIF - QUỐC GIA GHI NHẬN
// ========================================

async function getGBIFInfo(scientificName) {
  const url = new URL(
    `${API.gbif}/occurrence/search`
  );

  url.searchParams.set("scientificName", scientificName);
  url.searchParams.set("limit", "100");

  const result = await fetchJSON(url);
  const records = result.results || [];

  return {
    totalRecords: result.count ?? 0,

    countries: [
      ...new Set(
        records
          .map(item => item.country)
          .filter(Boolean)
      )
    ]
  };
}


// ========================================
// 6. MOBS - KÍCH THƯỚC CƠ THỂ
// ========================================

// Tải CSV một lần để tái sử dụng

async function loadMOBS() {
  if (!mobsPromise) {
    mobsPromise = (async () => {

      if (!window.Papa) {
        throw new Error(
          "PapaParse has not been loaded"
        );
      }

      const response = await fetch(API.mobs);

      if (!response.ok) {
        throw new Error(
          `Cannot load MOBS CSV: ${response.status}`
        );
      }

      const csv = await response.text();

      const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });

      if (parsed.errors.length) {
        console.warn(
          "MOBS CSV parsing warnings:",
          parsed.errors
        );
      }

      return parsed.data;

    })().catch(error => {
      mobsPromise = null;
      throw error;
    });
  }

  return mobsPromise;
}


// Lấy thông tin kích thước theo tên khoa học

async function getMOBSInfo(scientificName) {
  const rows = await loadMOBS();

  const matches = rows.filter(row =>
    row.scientificName?.trim().toLowerCase() ===
    scientificName.trim().toLowerCase()
  );

  if (!matches.length) {
    return null;
  }

  // Lấy các giá trị chiều dài hợp lệ
  const lengths = matches
    .map(row => Number(row.length_cm))
    .filter(value =>
      Number.isFinite(value) && value > 0
    )
    .sort((a, b) => a - b);

  // Tính trung vị chính xác
  let median = null;

  if (lengths.length) {
    const middle = Math.floor(lengths.length / 2);

    median = lengths.length % 2 === 0
      ? (lengths[middle - 1] + lengths[middle]) / 2
      : lengths[middle];
  }

  const widths = matches
    .map(row => Number(row.diameter_width_cm))
    .filter(value =>
      Number.isFinite(value) && value > 0
    );

  const heights = matches
    .map(row => Number(row.height_cm))
    .filter(value =>
      Number.isFinite(value) && value > 0
    );

  return {
    measurements: matches,

    lengthCm: median,

    widthCm: widths.length
      ? widths[0]
      : null,

    heightCm: heights.length
      ? heights[0]
      : null,

    references: [
      ...new Set(
        matches
          .map(row => row.Size_Ref)
          .filter(Boolean)
      )
    ]
  };
}


// ========================================
// 7. PHÂN LOẠI KÍCH THƯỚC
// ========================================

function classifySize(lengthCm) {
  if (
    lengthCm == null ||
    !Number.isFinite(lengthCm)
  ) {
    return "unknown";
  }

  if (lengthCm < 30) {
    return "small";
  }

  if (lengthCm < 100) {
    return "medium";
  }

  return "large";
}


// ========================================
// 8. TỔNG HỢP DỮ LIỆU SINH VẬT
// ========================================

async function getCreatureInfo(scientificName) {

  const cacheKey = scientificName.trim().toLowerCase();

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Lấy thông tin từ WoRMS
  const worms = await getWoRMSInfo(scientificName);

  if (!worms) {
    throw new Error(
      `Species not found in WoRMS: ${scientificName}`
    );
  }

  // Gọi các nguồn dữ liệu song song
  const [obis, gbif, mobs] = await Promise.allSettled([
    getOBISInfo(worms.aphiaID),
    getGBIFInfo(worms.scientificName),
    getMOBSInfo(worms.scientificName)
  ]);

  const obisData =
    obis.status === "fulfilled"
      ? obis.value
      : null;

  const gbifData =
    gbif.status === "fulfilled"
      ? gbif.value
      : null;

  const mobsData =
    mobs.status === "fulfilled"
      ? mobs.value
      : null;

  // Báo lỗi nếu một nguồn dữ liệu không hoạt động
  if (obis.status === "rejected") {
    console.warn("OBIS error:", obis.reason);
  }

  if (gbif.status === "rejected") {
    console.warn("GBIF error:", gbif.reason);
  }

  if (mobs.status === "rejected") {
    console.warn("MOBS error:", mobs.reason);
  }

  const length = mobsData?.lengthCm ?? null;

  const locations = obisData?.locations || [];

  let averageTemperature = null;

  if (locations.length > 0) {
    const sampleLocations = locations.slice(0, 5);

    const temperatureResults = await Promise.allSettled(
      sampleLocations.map(point =>
        getWaterTemperature(
          point.latitude,
          point.longitude
        )
      )
    );

    const validTemperatures = temperatureResults
      .filter(result =>
        result.status === "fulfilled" &&
        result.value !== null
      )
      .map(result => result.value);

    if (validTemperatures.length > 0) {
      averageTemperature =
        validTemperatures.reduce(
          (sum, value) => sum + value, 0
        ) / validTemperatures.length;
    }
  }

  // Object dữ liệu cuối cùng
  const data = {

    // Định danh
    scientificName: worms.scientificName,
    acceptedName: worms.acceptedName,
    aphiaID: worms.aphiaID,

    // Kích thước
    size: {
      category: classifySize(length),
      valueCm: length
    },

    // Độ sâu ghi nhận
    depth: obisData &&
      (
        obisData.minDepth !== null ||
        obisData.maxDepth !== null
      )
      ? {
        min: obisData.minDepth,
        max: obisData.maxDepth
      }
      : null,

    // Nhiệt độ nước biển ghi nhận
    waterTemperature: averageTemperature,

    waterType: classifyWaterType(
      averageTemperature
    ),

    // Quốc gia ghi nhận
    distribution: gbifData?.countries || [],

    // Số lượng bản ghi
    observationCount: {
      obis: obisData?.totalRecords ?? 0,
      gbif: gbifData?.totalRecords ?? 0
    },

    // Dữ liệu kích thước chi tiết
    measurements: mobsData?.measurements || [],

    // Tài liệu tham khảo kích thước
    sizeReferences: mobsData?.references || [],

    // Số tọa độ OBIS đã lấy
    locationCount: obisData?.locations?.length ?? 0
  };

  cache.set(cacheKey, data);

  return data;
}


// ========================================
// 9. WIKIMEDIA COMMONS - TÌM ẢNH
// ========================================

async function getFishImages(fishName) {

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap "${fishName}"`,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "800",
    format: "json",
    origin: "*"
  });

  const response = await fetch(
    `${COMMONS_API}?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `Wikimedia API error: ${response.status}`
    );
  }

  const result = await response.json();

  console.log("Wikimedia response:", result);

  const pages = Object.values(
    result.query?.pages || {}
  );

  console.log("Found image pages:", pages.length);

  return pages
    .map(page => {
      const info = page.imageinfo?.[0];

      if (!info) return null;

      const metadata = info.extmetadata || {};

      return {
        name: page.title,
        imageUrl: info.thumburl || info.url,
        originalUrl: info.url,
        mimeType: info.mime || "",
        sourceUrl: info.descriptionurl,
        author: metadata.Artist?.value || "Unknown",
        license: metadata.LicenseShortName?.value || "Check license",
        licenseUrl: metadata.LicenseUrl?.value || ""
      };
    })
    .filter(image =>
      image &&
      image.imageUrl &&
      image.mimeType.toLowerCase().startsWith("image/")
    );
}