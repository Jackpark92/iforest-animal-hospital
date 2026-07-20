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

const isMobileArchiveViewport = () => window.matchMedia("(max-width: 768px)").matches;

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
  const byId = new Map();
  [...baseCases, ...importedCases].forEach((item) => {
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
  if (filters && !filters.parentElement?.classList.contains("archive-filter-scroll-wrap")) {
    const wrap = document.createElement("div");
    wrap.className = "archive-filter-scroll-wrap";
    filters.parentNode.insertBefore(wrap, filters);
    wrap.append(filters);

    const hint = document.createElement("span");
    hint.className = "archive-scroll-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = ">";
    wrap.append(hint);

    const updateHint = () => {
      const hasOverflow = filters.scrollWidth > filters.clientWidth + 2;
      const hasNotScrolled = filters.scrollLeft <= 2;
      wrap.classList.toggle("show-scroll-hint", hasOverflow && hasNotScrolled);
    };

    filters.addEventListener("scroll", updateHint, { passive: true });
    window.addEventListener("resize", updateHint);
    requestAnimationFrame(updateHint);
  }

  const visibleCases = activeCategory === "전체"
    ? cases
    : cases.filter((item) => (item.categories || [item.category]).map(normalizeCategory).includes(activeCategory));

  if (count) {
    const displayedCount = isMobileArchiveViewport() ? cases.length : visibleCases.length;
    count.textContent = `${displayedCount}개의 치료 사례를 확인할 수 있습니다.`;
  }

  if (!visibleCases.length) {
    list.innerHTML = '<p class="archive-empty">아직 등록된 치료 사례가 없습니다.</p>';
    return;
  }

  const cards = visibleCases.map((item) => {
    const image = item.thumbnail || item.images?.[0]?.src || fallbackImage;
    const meta = [item.species, item.age, item.date].filter(Boolean).join(" · ");
    const category = normalizeCategory(item.category || item.categories?.[0] || "치료 사례");
    const sourceUrl = item.sourceUrl || item.blogUrl || "";
    const content = `
        <img src="${escapeText(image)}" alt="${escapeText(item.title)} 대표 이미지" loading="lazy">
        <span>${escapeText(category)}</span>
        <h3>${escapeText(item.title)}</h3>
        <p>${escapeText(item.summary || "아이숲동물병원의 실제 진료 사례입니다.")}</p>
        <small>${escapeText(meta || "진료 사례")}</small>
    `;
    return sourceUrl
      ? `<a class="archive-card" href="${escapeText(sourceUrl)}" target="_blank" rel="noopener noreferrer">${content}</a>`
      : `<article class="archive-card archive-card-disabled">${content}</article>`;
  }).join("");

  list.innerHTML = cards;
};

const createBodyHtml = (item) => {
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
