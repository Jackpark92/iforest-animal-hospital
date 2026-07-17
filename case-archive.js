const CASE_CATEGORY_ORDER = [
  "전체",
  "정형외과",
  "일반외과·종양수술",
  "내과·노령질환",
  "고양이 특화진료",
  "심장·건강검진",
  "치과",
  "안과"
];

const normalizeCategory = (category = "") => String(category).replace(/\s*·\s*/g, "·").trim();

const getUrlParams = () => new URLSearchParams(window.location.search);

const escapeText = (value = "") => {
  const span = document.createElement("span");
  span.textContent = String(value);
  return span.innerHTML;
};

const toCaseId = (item) => item.slug || item.id;

const toCaseDetailUrl = (item) => `case.html?id=${encodeURIComponent(toCaseId(item))}`;

const fallbackImage = "assets/hero.jpg";

const loadOptionalScript = (src, test) => new Promise((resolve) => {
  if (test?.()) {
    resolve(true);
    return;
  }
  if (document.querySelector(`script[src="${src}"]`)) {
    const existing = document.querySelector(`script[src="${src}"]`);
    existing.addEventListener("load", () => resolve(true), { once: true });
    existing.addEventListener("error", () => resolve(false), { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.addEventListener("load", () => resolve(true), { once: true });
  script.addEventListener("error", () => resolve(false), { once: true });
  document.head.append(script);
});

const getSupabaseConfig = async () => {
  const hasConfig = (config) => config?.supabaseUrl && (config?.supabasePublishableKey || config?.supabaseAnonKey);
  if (hasConfig(window.IFOREST_ADMIN_CONFIG)) {
    return window.IFOREST_ADMIN_CONFIG;
  }
  await loadOptionalScript("admin-config.js", () => Boolean(window.IFOREST_ADMIN_CONFIG));
  return hasConfig(window.IFOREST_ADMIN_CONFIG)
    ? window.IFOREST_ADMIN_CONFIG
    : null;
};

const loadDatabaseCases = async () => {
  const config = await getSupabaseConfig();
  if (!config) return [];
  const hasClient = await loadOptionalScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", () => Boolean(window.supabase?.createClient));
  if (!hasClient) return [];
  try {
    const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey;
    const client = window.supabase.createClient(config.supabaseUrl, publishableKey);
    const { data, error } = await client
      .from(config.tableName || "cases")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((item) => ({
      id: item.slug || item.id,
      slug: item.slug || item.id,
      title: item.title,
      category: normalizeCategory(item.category),
      categories: [normalizeCategory(item.category)],
      summary: item.summary || "",
      species: item.species || "",
      breed: item.breed || "",
      age: item.age || "",
      sex: item.sex || "",
      diagnosis: item.diagnosis || "",
      date: (item.published_at || item.created_at || "").slice(0, 10),
      thumbnail: item.thumbnail_url || item.thumbnail || "",
      sourceUrl: item.source_url || "",
      contentHtml: item.content_html || "",
      body: item.body || [],
      images: item.images || [],
      published: true
    }));
  } catch (error) {
    console.info("Supabase case archive is not available.", error);
    return [];
  }
};

const loadImportedCases = async () => {
  try {
    const response = await fetch("content/cases/index.json", { cache: "no-store" });
    if (!response.ok) return [];
    const imported = await response.json();
    if (!Array.isArray(imported)) return [];
    return imported;
  } catch (error) {
    console.info("Imported case index is not available.", error);
    return [];
  }
};

const getBaseCases = () => (Array.isArray(window.IFOREST_CASES) ? window.IFOREST_CASES : []).map((item) => ({
  id: item.id,
  slug: item.id,
  title: item.title,
  category: normalizeCategory((item.categories || [])[0] || item.category || "치료 사례"),
  categories: item.categories || [item.category].filter(Boolean),
  summary: item.description || item.subtitle || "아이숲동물병원에서 직접 진료한 실제 치료 사례입니다.",
  species: item.species || "",
  breed: item.breed || "",
  age: item.age || "",
  date: item.publishedAt || "",
  thumbnail: item.thumbnail || fallbackImage,
  sourceUrl: item.blogUrl || "",
  body: item.body || [],
  images: item.images || [],
  published: item.published !== false,
  featured: Boolean(item.featured)
}));

const mergeCases = async () => {
  const includeDrafts = getUrlParams().get("preview") === "1" || getUrlParams().get("draft") === "1";
  const baseCases = getBaseCases();
  const importedCases = (await loadImportedCases()).map((item) => ({
    ...item,
    category: normalizeCategory(item.category),
    categories: item.categories || [item.category].filter(Boolean).map(normalizeCategory)
  }));
  const databaseCases = await loadDatabaseCases();
  const byId = new Map();
  [...baseCases, ...importedCases, ...databaseCases].forEach((item) => {
    const id = toCaseId(item);
    if (!id) return;
    byId.set(id, item);
  });
  return [...byId.values()].filter((item) => includeDrafts || item.published !== false);
};

const renderArchive = async () => {
  const list = document.querySelector("[data-archive-list]");
  if (!list) return;

  const filters = document.querySelector("[data-archive-filters]");
  const count = document.querySelector("[data-archive-count]");
  const cases = await mergeCases();
  const activeCategory = normalizeCategory(getUrlParams().get("category") || "전체");

  const makeButton = (category) => {
    const link = document.createElement("a");
    link.href = category === "전체" ? "archive.html" : `archive.html?category=${encodeURIComponent(category)}`;
    link.textContent = category;
    if (normalizeCategory(category) === activeCategory || (activeCategory === "전체" && category === "전체")) {
      link.setAttribute("aria-current", "page");
    }
    return link;
  };

  filters?.replaceChildren(...CASE_CATEGORY_ORDER.map(makeButton));

  const visibleCases = activeCategory === "전체"
    ? cases
    : cases.filter((item) => (item.categories || [item.category]).map(normalizeCategory).includes(activeCategory));

  if (count) {
    count.textContent = `${visibleCases.length}개의 치료 사례를 확인할 수 있습니다.`;
  }

  if (!visibleCases.length) {
    list.innerHTML = '<p class="archive-empty">아직 등록된 치료 사례가 없습니다.</p>';
    return;
  }

  const cards = visibleCases.map((item) => {
    const image = item.thumbnail || item.images?.[0]?.src || fallbackImage;
    const meta = [item.species, item.age, item.diagnosis || item.breed].filter(Boolean).join(" · ");
    const category = normalizeCategory(item.category || item.categories?.[0] || "치료 사례");
    return `
      <a class="archive-card" href="${toCaseDetailUrl(item)}">
        <div class="archive-card-media">
          <img src="${escapeText(image)}" alt="${escapeText(item.title)} 대표 이미지" loading="lazy">
          <h3>${escapeText(item.title)}</h3>
        </div>
        <div class="archive-card-info">
          <span>${escapeText(category)}</span>
          <p>${escapeText(item.summary || "아이숲동물병원의 실제 진료 사례입니다.")}</p>
          <small>${escapeText(meta || item.date || "진료 사례")}</small>
        </div>
      </a>
    `;
  }).join("");

  list.innerHTML = cards;
};

const createBodyHtml = (item) => {
  if (item.contentHtml) {
    return sanitizeRichHtml(item.contentHtml);
  }
  if (Array.isArray(item.body) && item.body.length) {
    return item.body.map((block) => {
      if (block.type === "heading") return `<h2>${escapeText(block.text)}</h2>`;
      if (block.type === "image") {
        return `<figure><img src="${escapeText(block.src)}" alt="${escapeText(block.alt || item.title)}" loading="lazy"><figcaption>${escapeText(block.caption || "")}</figcaption></figure>`;
      }
      return `<p>${escapeText(block.text || "")}</p>`;
    }).join("");
  }

  const summary = item.summary || "아이숲동물병원에서 직접 진료한 실제 치료 사례입니다.";
  const source = item.sourceUrl
    ? `<p>자세한 원문 기록은 하단의 네이버 블로그 원문 보기에서 확인하실 수 있습니다.</p>`
    : "";
  return `<p>${escapeText(summary)}</p>${source}`;
};

const sanitizeRichHtml = (html = "") => {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["P", "H2", "H3", "H4", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "BLOCKQUOTE", "HR", "A", "IMG", "FIGURE", "FIGCAPTION", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "BR", "DIV", "SPAN"]);
  const allowedAttrs = new Set(["href", "target", "rel", "src", "alt", "loading", "width", "height", "class"]);
  template.content.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (!allowedAttrs.has(name) || /^on/i.test(name)) {
        node.removeAttribute(attr.name);
        return;
      }
      if ((name === "href" || name === "src") && /^(javascript|data):/i.test(attr.value)) {
        node.removeAttribute(attr.name);
      }
    });
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    if (node.tagName === "IMG") {
      node.setAttribute("loading", "lazy");
    }
  });
  return template.innerHTML;
};

const renderDetail = async () => {
  const root = document.querySelector("[data-case-detail]");
  if (!root) return;

  const id = getUrlParams().get("id");
  const cases = await mergeCases();
  const index = cases.findIndex((item) => toCaseId(item) === id);
  const item = cases[index];

  if (!item) {
    root.innerHTML = `
      <section class="case-detail-shell">
        <a class="case-back-link" href="archive.html">← 목록으로 돌아가기</a>
        <h1>치료 사례를 찾을 수 없습니다.</h1>
        <p>주소가 변경되었거나 아직 게시되지 않은 초안일 수 있습니다.</p>
      </section>
    `;
    return;
  }

  const previous = cases[index - 1];
  const next = cases[index + 1];
  const heroImage = item.thumbnail || item.images?.[0]?.src || fallbackImage;
  const patientInfo = [item.species, item.breed, item.age].filter(Boolean).join(" · ");
  const category = normalizeCategory(item.category || item.categories?.[0] || "치료 사례");
  document.title = `${item.title} | 아이숲동물병원 치료 사례`;

  root.innerHTML = `
    <article class="case-detail-shell">
      <a class="case-back-link" href="archive.html">← 목록으로 돌아가기</a>
      <header class="case-detail-hero">
        <div>
          <span>${escapeText(category)}</span>
          <h1>${escapeText(item.title)}</h1>
          <p>${escapeText(item.summary || "")}</p>
          <small>${escapeText([patientInfo, item.date].filter(Boolean).join(" · "))}</small>
        </div>
        <img src="${escapeText(heroImage)}" alt="${escapeText(item.title)} 대표 이미지" loading="eager">
      </header>
      <div class="case-detail-body">${createBodyHtml(item)}</div>
      <footer class="case-detail-actions">
        <a href="archive.html">목록으로 돌아가기</a>
        ${previous ? `<a href="${toCaseDetailUrl(previous)}">이전 치료 사례</a>` : ""}
        ${next ? `<a href="${toCaseDetailUrl(next)}">다음 치료 사례</a>` : ""}
        ${item.sourceUrl ? `<a href="${escapeText(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">네이버 블로그 원문 보기</a>` : ""}
        <a href="index.html#visit">진료 문의 및 예약</a>
      </footer>
    </article>
  `;
};

const bindArchiveMenu = () => {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-mobile-nav]");
  toggle?.addEventListener("click", () => {
    const isOpen = nav?.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });
};

bindArchiveMenu();
renderArchive();
renderDetail();
