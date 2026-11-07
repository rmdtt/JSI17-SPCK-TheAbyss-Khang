const OBIS_API = "https://api.obis.org/v3";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// 1. Gọi API OBIS: tìm dữ liệu quan sát của một loài
async function getFishInfo(scientificName) {
  const params = new URLSearchParams({
    scientificname: scientificName,
    size: "10"
  });

  const response = await fetch(
    `${OBIS_API}/occurrence?${params}`
  );

  if (!response.ok) {
    throw new Error(`OBIS API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.results || []).map((fish) => ({
    scientificName: fish.scientificName,
    scientificNameID: fish.scientificNameID ?? null,
    depth: fish.depth ?? null,
    minimumDepth: fish.minimumDepthInMeters ?? null,
    maximumDepth: fish.maximumDepthInMeters ?? null,
    latitude: fish.decimalLatitude ?? null,
    longitude: fish.decimalLongitude ?? null
  }));
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