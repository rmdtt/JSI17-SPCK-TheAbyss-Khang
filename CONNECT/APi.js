const COMMONS_API = "https://commons.wikimedia.org/w/api.php";


const CREATURE_API = {
    obis: "https://api.obis.org/v3",
    fishbase: "https://fishbase.ropensci.org",
    sealifebase: "https://fishbase.ropensci.org/sealifebase",
    worms: "https://www.marinespecies.org/rest"
};

// Gọi API và kiểm tra lỗi
async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

// Phân loại kích thước
function classifySize(lengthCm) {
    if (lengthCm == null || !Number.isFinite(lengthCm)) {
        return "unknown";
    }

    if (lengthCm < 30) return "small";
    if (lengthCm < 100) return "medium";

    return "large";
}

// Phân loại nhiệt độ
function classifyTemperature(temperatures) {
    const valid = temperatures.filter(
        value => Number.isFinite(value)
    );

    if (!valid.length) return "unknown";

    const average =
        valid.reduce((sum, value) => sum + value, 0) /
        valid.length;

    if (average < 10) return "cold";
    if (average >= 20) return "warm";

    return "temperate";
}

// 1. Lấy thông tin từ FishBase hoặc SeaLifeBase
async function getDatabaseInfo(scientificName, database = "fishbase") {
    const parts = scientificName.trim().split(/\s+/);

    if (parts.length < 2) return null;

    const [genus, species] = parts;

    const baseURL =
        database === "sealifebase"
            ? CREATURE_API.sealifebase
            : CREATURE_API.fishbase;

    const url = new URL(`${baseURL}/species`);

    url.searchParams.set("genus", genus);
    url.searchParams.set("species", species);
    url.searchParams.set("limit", "10");

    const result = await fetchJSON(url);

    return result.data?.find(item =>
        item.sciname?.toLowerCase() === scientificName.toLowerCase()
    ) || result.data?.[0] || null;
}

// 2. Lấy dữ liệu quan sát từ OBIS
async function getOBISInfo(scientificName) {
    const url = new URL(`${CREATURE_API.obis}/occurrence`);

    url.searchParams.set("scientificname", scientificName);
    url.searchParams.set("size", "100");

    const result = await fetchJSON(url);

    const records = result.results || [];

    const depths = [];
    const temperatures = [];

    for (const record of records) {
        const minDepth = Number(record.minimumDepthInMeters);
        const maxDepth = Number(record.maximumDepthInMeters);
        const temperature = Number(record.sst);

        if (Number.isFinite(minDepth)) depths.push(minDepth);
        if (Number.isFinite(maxDepth)) depths.push(maxDepth);

        if (Number.isFinite(temperature)) {
            temperatures.push(temperature);
        }
    }

    return {
        totalRecords: result.total || records.length,

        observedDepth: depths.length
            ? {
                min: Math.min(...depths),
                max: Math.max(...depths)
            }
            : null,

        temperature: classifyTemperature(temperatures),

        averageSST: temperatures.length
            ? temperatures.reduce((a, b) => a + b, 0) /
              temperatures.length
            : null
    };
}

// 3. Xác minh tên khoa học bằng WoRMS
async function getWoRMSInfo(scientificName) {
    const url =
        `${CREATURE_API.worms}/AphiaRecordsByName/` +
        encodeURIComponent(scientificName) +
        "?marine_only=true";

    const result = await fetchJSON(url);

    if (!Array.isArray(result) || !result.length) {
        return null;
    }

    return result.find(item => item.status === "accepted") ||
           result[0];
}

// 4. Hàm tổng hợp thông tin của một sinh vật
async function getCreatureInfo(
    scientificName,
    database = "fishbase"
) {
    const [databaseResult, obisResult, wormsResult] =
        await Promise.allSettled([
            getDatabaseInfo(scientificName, database),
            getOBISInfo(scientificName),
            getWoRMSInfo(scientificName)
        ]);

    const biologicalData =
        databaseResult.status === "fulfilled"
            ? databaseResult.value
            : null;

    const observationData =
        obisResult.status === "fulfilled"
            ? obisResult.value
            : null;

    const taxonData =
        wormsResult.status === "fulfilled"
            ? wormsResult.value
            : null;

    const length = Number(biologicalData?.Length);

    const fishDepthMin = biologicalData?.DepthRangeShallow;
    const fishDepthMax = biologicalData?.DepthRangeDeep;

    const hasFishDepth =
        Number.isFinite(Number(fishDepthMin)) &&
        Number.isFinite(Number(fishDepthMax));

    const depth = hasFishDepth
        ? {
            min: Number(fishDepthMin),
            max: Number(fishDepthMax),
            source: database
        }
        : observationData?.observedDepth
            ? {
                ...observationData.observedDepth,
                source: "OBIS observations"
            }
            : null;

    return {
        scientificName,

        acceptedName:
            taxonData?.valid_name || taxonData?.scientificname ||
            scientificName,

        aphiaID: taxonData?.AphiaID || null,

        size: {
            valueCm: Number.isFinite(length) ? length : null,
            category: classifySize(length)
        },

        depth,

        temperaturePreference:
            observationData?.temperature || "unknown",

        averageSST:
            observationData?.averageSST ?? null,

        observationCount:
            observationData?.totalRecords ?? 0,

        sources: {
            biologicalDatabase: biologicalData ? database : null,
            obis: observationData !== null,
            worms: taxonData !== null
        }
    };
}

// 2. Gọi Wikimedia Commons: tìm ảnh PNG/WebP nền trong suốt
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
    throw new Error(`Wikimedia API error: ${response.status}`);
  }

  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});

  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;

      const mime = info.mime || "";
      const metadata = info.extmetadata || {};

      return {
        name: page.title,
        imageUrl: info.thumburl || info.url,
        originalUrl: info.url,
        mimeType: mime,
        sourceUrl: info.descriptionurl,
        author: metadata.Artist?.value || "Unknown",
        license: metadata.LicenseShortName?.value || "Check license",
        licenseUrl: metadata.LicenseUrl?.value || ""
      };
    })
    .filter((image) =>
      image &&
      image.imageUrl &&
      ["image/png", "image/webp"].includes(image.mimeType)
    );
}