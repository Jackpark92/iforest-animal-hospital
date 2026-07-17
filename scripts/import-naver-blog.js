const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const CASE_DIR = path.join(ROOT, "content", "cases");
const CASE_INDEX = path.join(CASE_DIR, "index.json");
const ASSET_ROOT = path.join(ROOT, "assets", "cases");
const PUBLIC_BASE_URL = "https://iforest-animal-hospital.vercel.app";

const ALLOWED_POST_HOSTS = new Set(["blog.naver.com", "m.blog.naver.com"]);
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  "pstatic.net",
  "blogfiles.pstatic.net",
  "postfiles.pstatic.net",
  "blogthumb.pstatic.net",
  "mblogthumb-phinf.pstatic.net",
  "phinf.pstatic.net",
  "ssl.pstatic.net"
];

const CATEGORY_RULES = [
  ["정형외과", ["슬개골", "십자인대", "tplo", "골절", "고관절", "대퇴골두", "fhno"]],
  ["일반외과·종양수술", ["자궁축농증", "종양", "비장", "유선", "이물", "위 절개", "방광결석", "중성화", "냉동치료"]],
  ["내과·노령질환", ["쿠싱", "갑상선기능저하", "당뇨", "외이염", "인슐린", "알레르기", "알러지"]],
  ["고양이 특화진료", ["고양이", "신부전", "방광염", "피부사상균", "중독", "갑상선기능항진"]],
  ["심장·건강검진", ["심장", "심장초음파", "건강검진", "검진"]],
  ["치과", ["구내염", "치아흡수", "치주염", "발치", "스케일링", "치과"]],
  ["안과", ["각막", "백내장", "포도막", "안과", "눈"]]
];

const decodeEntities = (value = "") => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&hellip;/g, "...")
  .replace(/&middot;/g, "·")
  .replace(/&nbsp;/g, " ");

const stripTags = (html = "") => decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s+/g, "\n")
  .trim();

const cleanText = (value = "") => decodeEntities(String(value))
  .replace(/\s+/g, " ")
  .replace(/\u200b/g, "")
  .trim();

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = async (file, data) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(`${file}.tmp`, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(`${file}.tmp`, file);
};

const validateHttpsUrl = (rawUrl, allowedHosts) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("올바른 URL이 아닙니다.");
  }
  if (url.protocol !== "https:") {
    throw new Error("https URL만 가져올 수 있습니다.");
  }
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(`허용되지 않은 도메인입니다: ${url.hostname}`);
  }
  return url;
};

const getNaverPostInfo = (rawUrl) => {
  const url = validateHttpsUrl(rawUrl, ALLOWED_POST_HOSTS);
  const parts = url.pathname.split("/").filter(Boolean);
  let blogId = url.searchParams.get("blogId");
  let logNo = url.searchParams.get("logNo");

  if (!blogId && !logNo && parts.length >= 2) {
    blogId = parts[0];
    logNo = parts[1];
  }

  if (!blogId || !logNo || !/^\d{6,}$/.test(logNo)) {
    throw new Error("네이버 블로그 글 주소에서 blogId/logNo를 찾지 못했습니다.");
  }

  return {
    blogId,
    logNo,
    canonicalUrl: `https://blog.naver.com/${blogId}/${logNo}`,
    mobileUrl: `https://m.blog.naver.com/${blogId}/${logNo}`
  };
};

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 IForestArchiveImporter/1.0",
      "accept": "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
};

const fetchPostHtml = async (postInfo) => {
  const warnings = [];
  try {
    const mobileHtml = await fetchText(postInfo.mobileUrl);
    if (mobileHtml.includes("se-main-container") || mobileHtml.includes("post_ct")) {
      return { html: mobileHtml, fetchedUrl: postInfo.mobileUrl, warnings };
    }
  } catch (error) {
    warnings.push(`모바일 글을 바로 읽지 못했습니다: ${error.message}`);
  }

  const canonicalHtml = await fetchText(postInfo.canonicalUrl);
  const iframeMatch = canonicalHtml.match(/id=["']mainFrame["'][^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    const iframeUrl = new URL(iframeMatch[1], postInfo.canonicalUrl).toString();
    return { html: await fetchText(iframeUrl), fetchedUrl: iframeUrl, warnings };
  }
  return { html: canonicalHtml, fetchedUrl: postInfo.canonicalUrl, warnings };
};

const extractMeta = (html, name) => {
  const property = html.match(new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"));
  if (property) return cleanText(property[1]);
  const metaName = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"));
  return metaName ? cleanText(metaName[1]) : "";
};

const extractTitle = (html) => {
  const title = extractMeta(html, "og:title")
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || html.match(/<(?:h1|h2|h3|strong)[^>]*>([\s\S]{3,140}?)<\/(?:h1|h2|h3|strong)>/i)?.[1]
    || "아이숲동물병원 치료 사례";
  return stripTags(title).replace(/\s*:\s*네이버\s*블로그\s*$/i, "").trim();
};

const extractDate = (html) => {
  const match = html.match(/(20\d{2})[.\-]\s*(\d{1,2})[.\-]\s*(\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const extractParagraphs = (html) => {
  const scoped = html.match(/<div[^>]+class=["'][^"']*(?:se-main-container|post_ct|se_component_wrap)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/body>)/i)?.[1] || html;
  const candidates = [];
  const paragraphRegex = /<(?:p|span|div)[^>]+class=["'][^"']*(?:se-text-paragraph|se-module-text|se-component-content|post-view)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|span|div)>/gi;
  let match;
  while ((match = paragraphRegex.exec(scoped))) {
    const text = stripTags(match[1]);
    if (text.length >= 8 && !/^(공감|댓글|태그|이웃추가|블로그|카테고리)$/i.test(text)) {
      candidates.push(text);
    }
  }

  if (candidates.length) {
    return [...new Set(candidates)].slice(0, 40);
  }

  return stripTags(scoped)
    .split(/\n| {2,}/)
    .map(cleanText)
    .filter((text) => text.length >= 12)
    .slice(0, 40);
};

const imageHostAllowed = (url) => ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));

const extractImageUrls = (html, baseUrl) => {
  const urls = [];
  const imgRegex = /<img[^>]+>/gi;
  const srcRegex = /\s(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html))) {
    let attrMatch;
    while ((attrMatch = srcRegex.exec(imgMatch[0]))) {
      try {
        const imageUrl = new URL(decodeEntities(attrMatch[1]), baseUrl);
        if (!["https:"].includes(imageUrl.protocol)) continue;
        if (!imageHostAllowed(imageUrl)) continue;
        const type = imageUrl.searchParams.get("type") || "";
        if (/blur|s1|profile/i.test(type)) continue;
        const pathName = imageUrl.pathname.toLowerCase();
        if (/(profile|icon|emoji|sticker|logo|btn|blank|common|sp_)/.test(pathName)) continue;
        urls.push(imageUrl.toString());
      } catch {
        // Ignore malformed image attributes.
      }
    }
  }
  return [...new Set(urls)].slice(0, 18);
};

const guessExtension = (url, contentType = "") => {
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
};

const tryConvertToWebp = async (buffer, outputPath) => {
  try {
    const sharp = require("sharp");
    await sharp(buffer).resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 82 }).toFile(outputPath);
    return true;
  } catch {
    return false;
  }
};

const downloadImages = async (imageUrls, slug, warnings) => {
  const imageDir = path.join(ASSET_ROOT, slug);
  await fs.mkdir(imageDir, { recursive: true });
  const downloaded = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      const response = await fetch(imageUrl, {
        headers: { "user-agent": "Mozilla/5.0 IForestArchiveImporter/1.0" }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) throw new Error(`이미지가 아닌 응답입니다: ${contentType}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 8);
      const baseName = `image-${String(index + 1).padStart(2, "0")}-${hash}`;
      const webpPath = path.join(imageDir, `${baseName}.webp`);
      const converted = await tryConvertToWebp(buffer, webpPath);
      let fileName = `${baseName}.webp`;

      if (!converted) {
        const ext = guessExtension(imageUrl, contentType);
        fileName = `${baseName}${ext}`;
        await fs.writeFile(path.join(imageDir, fileName), buffer);
        if (index === 0) {
          warnings.push("sharp 패키지가 없어 이미지를 WebP로 변환하지 않고 원본 형식으로 저장했습니다.");
        }
      }

      downloaded.push({
        src: `assets/cases/${slug}/${fileName}`,
        originalUrl: imageUrl,
        alt: "아이숲동물병원 치료 사례 이미지"
      });
    } catch (error) {
      warnings.push(`이미지 저장 실패: ${imageUrl} (${error.message})`);
    }
  }

  return downloaded;
};

const inferCategory = (title, paragraphs) => {
  const haystack = `${title} ${paragraphs.join(" ")}`.toLowerCase();
  const found = CATEGORY_RULES.find(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword.toLowerCase())));
  return found ? found[0] : "일반외과·종양수술";
};

const inferSpecies = (text) => {
  if (/고양이|냥이|묘/.test(text)) return "고양이";
  if (/강아지|개|견/.test(text)) return "강아지";
  return "";
};

const makeSummary = (paragraphs) => {
  const source = paragraphs.find((paragraph) => paragraph.length >= 18) || paragraphs[0] || "아이숲동물병원에서 직접 진료한 실제 치료 사례입니다.";
  return source.length > 120 ? `${source.slice(0, 118)}...` : source;
};

const makeSlug = (postInfo, title) => {
  const compactTitle = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 34);
  return `${postInfo.logNo}-${compactTitle || "case"}`.toLowerCase();
};

const updateSitemap = async (index) => {
  const publishedCases = index.filter((item) => item.published !== false && (item.slug || item.id));
  const urls = [
    "",
    "archive.html",
    ...publishedCases.map((item) => `case.html?id=${encodeURIComponent(item.slug || item.id)}`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${PUBLIC_BASE_URL}/${url}</loc></url>`).join("\n")}\n</urlset>\n`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), xml, "utf8");
};

const importPost = async (rawUrl) => {
  if (!rawUrl) {
    throw new Error("사용법: npm run import-case -- https://blog.naver.com/블로그ID/글번호");
  }

  const postInfo = getNaverPostInfo(rawUrl);
  const index = await readJson(CASE_INDEX, []);
  const duplicate = index.find((item) => item.sourcePostNo === postInfo.logNo || item.sourceUrl === postInfo.canonicalUrl);
  if (duplicate) {
    console.log(`이미 가져온 글입니다: ${duplicate.title}`);
    console.log(`초안/상세 확인: case.html?id=${encodeURIComponent(duplicate.slug || duplicate.id)}&preview=1`);
    return;
  }

  const { html, fetchedUrl, warnings } = await fetchPostHtml(postInfo);
  const title = extractTitle(html);
  const date = extractDate(html);
  const paragraphs = extractParagraphs(html);
  const imageUrls = extractImageUrls(html, fetchedUrl);
  const slug = makeSlug(postInfo, title);
  const images = await downloadImages(imageUrls, slug, warnings);
  const textAll = `${title} ${paragraphs.join(" ")}`;
  const category = inferCategory(title, paragraphs);
  const body = [
    ...paragraphs.slice(0, 16).map((text) => ({ type: "paragraph", text })),
    ...images.map((image) => ({ type: "image", src: image.src, alt: image.alt }))
  ];

  const caseData = {
    id: slug,
    slug,
    title,
    category,
    categories: [category],
    summary: makeSummary(paragraphs),
    species: inferSpecies(textAll),
    breed: "",
    age: "",
    date,
    thumbnail: images[0]?.src || "",
    images,
    body,
    sourceUrl: postInfo.canonicalUrl,
    sourcePostNo: postInfo.logNo,
    importedAt: new Date().toISOString(),
    published: false
  };

  await writeJson(path.join(CASE_DIR, `${slug}.json`), caseData);
  const nextIndex = [...index, caseData];
  await writeJson(CASE_INDEX, nextIndex);
  await updateSitemap(nextIndex);

  console.log("네이버 블로그 글을 초안으로 가져왔습니다.");
  console.log(`제목: ${title}`);
  console.log(`카테고리 후보: ${category}`);
  console.log(`이미지: ${images.length}개 저장`);
  console.log(`초안 파일: content/cases/${slug}.json`);
  console.log(`미리보기: case.html?id=${encodeURIComponent(slug)}&preview=1`);
  console.log("게시하려면 content/cases/index.json 및 초안 파일의 published 값을 true로 바꿔 주세요.");
  if (warnings.length) {
    console.log("\n확인 필요:");
    warnings.forEach((warning) => console.log(`- ${warning}`));
  }
};

importPost(process.argv[2]).catch((error) => {
  console.error(`가져오기 실패: ${error.message}`);
  process.exitCode = 1;
});
