const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const desktopDropdowns = document.querySelectorAll("[data-desktop-dropdown]");
const mobileAccordions = document.querySelectorAll("[data-mobile-accordion]");
const caseGrid = document.querySelector("[data-case-grid]");
const mobileCaseArchive = document.querySelector("[data-mobile-case-archive]");
const contactInfo = window.IFOREST_CONTACT || {};

const applyContactInfo = () => {
  document.querySelectorAll("[data-contact]").forEach((element) => {
    const value = contactInfo[element.dataset.contact];
    if (value) element.textContent = value;
  });

  document.querySelectorAll("[data-contact-link]").forEach((element) => {
    const key = element.dataset.contactLink;
    const value = contactInfo[key];
    if (!value) {
      element.classList.add("disabled");
      element.setAttribute("aria-disabled", "true");
      return;
    }
    element.href = key === "tel" ? `tel:${value}` : value;
  });

};

applyContactInfo();

const initNaverMap = () => {
  const mapElement = document.querySelector("[data-naver-map]");
  if (!mapElement) return;

  const mapWrap = mapElement.closest(".naver-map-wrap");
  const fallback = mapWrap?.querySelector("[data-naver-map-fallback]");
  const location = contactInfo.location || {};
  const clientId = contactInfo.naverMapClientId;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const mobileCenterConfig = location.mobileCenter || {};
  const mobileCenterLat = Number(mobileCenterConfig.lat);
  const mobileCenterLng = Number(mobileCenterConfig.lng);

  const showMapError = (reason, detail) => {
    if (fallback) {
      fallback.innerHTML = "<strong>지도를 불러오지 못했습니다.</strong><p>네이버 지도에서 위치를 확인해 주세요.</p>";
    }
    console.warn(`[NaverMap] ${reason}`, detail || "");
  };

  if (!clientId) {
    showMapError("Naver Maps Client ID is missing. Set naverMapClientId in contact-data.js.");
    return;
  }

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    showMapError("Hospital coordinates are invalid.", location);
    return;
  }

  const renderMap = () => {
    try {
      if (!window.naver?.maps || mapElement.dataset.mapInitialized === "true") return;

      const hospitalPosition = new window.naver.maps.LatLng(lat, lng);
      const mobileQuery = window.matchMedia("(max-width: 768px)");
      const getMapCenter = () => {
        const hasMobileCenter = !Number.isNaN(mobileCenterLat) && !Number.isNaN(mobileCenterLng);
        return mobileQuery.matches && hasMobileCenter
          ? new window.naver.maps.LatLng(mobileCenterLat, mobileCenterLng)
          : hospitalPosition;
      };
      const getMapInteractionOptions = () => {
        const isMobile = mobileQuery.matches;
        return {
          draggable: !isMobile,
          scrollWheel: false,
          pinchZoom: !isMobile,
          keyboardShortcuts: !isMobile,
          disableDoubleClickZoom: isMobile,
          disableDoubleTapZoom: isMobile,
          disableTwoFingerTapZoom: isMobile,
          zoomControl: !isMobile
        };
      };
      const setMobileMapLock = () => {
        mapWrap?.classList.toggle("mobile-map-locked", mobileQuery.matches);
      };
      setMobileMapLock();
      const map = new window.naver.maps.Map(mapElement, {
        center: getMapCenter(),
        zoom: mobileQuery.matches
          ? location.mobileZoom || 15
          : location.zoom || 16,
        ...getMapInteractionOptions(),
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT
        }
      });

      const marker = new window.naver.maps.Marker({
        map,
        position: hospitalPosition,
        title: location.name || contactInfo.hospitalName || "아이숲동물병원",
        zIndex: 100
      });

      const infoWindow = new window.naver.maps.InfoWindow({
        content: `<div class="naver-info-window"><strong>${location.name || contactInfo.hospitalName || "아이숲동물병원"}</strong><span>${location.address || contactInfo.address || ""}</span></div>`,
        borderWidth: 0,
        backgroundColor: "transparent",
        disableAnchor: true,
        disableAutoPan: true
      });

      infoWindow.open(map, marker);
      window.naver.maps.Event.addListener(marker, "click", () => {
        if (infoWindow.getMap()) {
          infoWindow.close();
        } else {
          infoWindow.open(map, marker);
        }
      });

      window.addEventListener("resize", () => {
        if (!window.naver?.maps?.Event) return;
        const isMobile = mobileQuery.matches;
        setMobileMapLock();
        map.setOptions?.(getMapInteractionOptions());
        map.setZoom(isMobile ? location.mobileZoom || 15 : location.zoom || 16);
        window.naver.maps.Event.trigger(map, "resize");
        map.setCenter(getMapCenter());
      }, { passive: true });

      mapElement.dataset.mapInitialized = "true";
      mapWrap?.classList.add("map-ready");
    } catch (error) {
      showMapError("Map initialization failed. Check Naver Maps API domain registration and Client ID.", error);
    }
  };

  if (window.naver?.maps) {
    renderMap();
    return;
  }

  const existingScript = document.querySelector("script[data-naver-map-script]");
  if (existingScript) {
    existingScript.addEventListener("load", renderMap, { once: true });
    existingScript.addEventListener("error", (event) => showMapError("Naver Maps SDK loading failed.", event), { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
  script.async = true;
  script.dataset.naverMapScript = "true";
  script.addEventListener("load", renderMap, { once: true });
  script.addEventListener("error", (event) => showMapError("Naver Maps SDK loading failed.", event), { once: true });
  document.head.append(script);
};

initNaverMap();

const setHeaderState = () => {
  header?.classList.toggle("scrolled", window.scrollY > 12);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

const closeMobileNav = () => {
  if (!mobileNav?.classList.contains("open")) return;
  mobileNav.classList.remove("open");
  document.body.classList.remove("nav-open");
  menuToggle?.setAttribute("aria-expanded", "false");
  mobileAccordions.forEach((accordion) => {
    accordion.closest(".mobile-accordion")?.classList.remove("open");
    accordion.setAttribute("aria-expanded", "false");
  });
};

menuToggle?.addEventListener("click", () => {
  const isOpen = mobileNav.classList.toggle("open");
  document.body.classList.toggle("nav-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
});

desktopDropdowns.forEach((dropdown) => {
  const toggle = dropdown.querySelector("[data-desktop-dropdown-toggle]");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const isOpen = dropdown.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    desktopDropdowns.forEach((otherDropdown) => {
      if (otherDropdown === dropdown) return;
      otherDropdown.classList.remove("open");
      otherDropdown.querySelector("[data-desktop-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
    });
  });

  dropdown.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      dropdown.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
});

document.addEventListener("click", (event) => {
  desktopDropdowns.forEach((dropdown) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("open");
      dropdown.querySelector("[data-desktop-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
    }
  });
});

mobileAccordions.forEach((accordion) => {
  accordion.addEventListener("click", () => {
    const wrapper = accordion.closest(".mobile-accordion");
    const isOpen = wrapper.classList.toggle("open");
    accordion.setAttribute("aria-expanded", String(isOpen));
  });
});

mobileNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileNav.classList.remove("open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "메뉴 열기");
    mobileAccordions.forEach((accordion) => {
      accordion.closest(".mobile-accordion").classList.remove("open");
      accordion.setAttribute("aria-expanded", "false");
    });
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileNav();
});

document.addEventListener("click", (event) => {
  if (!mobileNav?.classList.contains("open")) return;
  if (mobileNav.contains(event.target) || menuToggle?.contains(event.target)) return;
  closeMobileNav();
});

const getCaseCategories = (item) => item.categories || item.category || [];
const iconPaths = {
  bone: [
    '<path d="M35 30c-5-5-13-5-18 0s-5 13 0 18c2 2 4 3 6 4l29 29c1 2 2 4 4 6 5 5 13 5 18 0s5-13 0-18c-2-2-4-3-6-4L39 36c-1-2-2-4-4-6z"/>',
    '<path d="M19 30l10 10"/>',
    '<path d="M64 74l10 10"/>'
  ],
  hip: [
    '<path d="M35 30c-5-5-13-5-18 0s-5 13 0 18c2 2 4 3 6 4l29 29c1 2 2 4 4 6 5 5 13 5 18 0s5-13 0-18c-2-2-4-3-6-4L39 36c-1-2-2-4-4-6z"/>',
    '<path d="M19 30l10 10"/>',
    '<path d="M64 74l10 10"/>'
  ],
  orthopedic: [
    '<path d="M35 30c-5-5-13-5-18 0s-5 13 0 18c2 2 4 3 6 4l29 29c1 2 2 4 4 6 5 5 13 5 18 0s5-13 0-18c-2-2-4-3-6-4L39 36c-1-2-2-4-4-6z"/>',
    '<path d="M19 30l10 10"/>',
    '<path d="M64 74l10 10"/>'
  ],
  scalpel: [
    '<path d="M24 80 72 32"/>',
    '<path d="M62 22 82 42 72 52 52 32z"/>',
    '<path d="M24 80c-5 5-5 11 0 16 5-5 11-5 16 0"/>',
    '<path d="M34 70 46 82"/>'
  ],
  internal: [
    '<path d="M34 22v28c0 11 8 20 18 20s18-9 18-20V22"/>',
    '<path d="M26 22h16"/>',
    '<path d="M62 22h16"/>',
    '<path d="M52 70v8c0 9 7 16 16 16s16-7 16-16"/>',
    '<circle cx="84" cy="78" r="8"/>'
  ],
  dental: [
    '<path d="M38 22c-11 0-18 9-16 22 2 16 8 40 16 40 6 0 5-20 14-20s8 20 14 20c8 0 14-24 16-40 2-13-5-22-16-22-6 0-9 3-14 3s-8-3-14-3z"/>'
  ],
  eye: [
    '<path d="M14 52s14-24 38-24 38 24 38 24-14 24-38 24-38-24-38-24z"/>',
    '<circle cx="52" cy="52" r="13"/>',
    '<path d="M52 39v6M52 59v6"/>'
  ],
  cat: [
    '<path d="M29 40 20 22l20 10"/>',
    '<path d="M75 40 84 22 64 32"/>',
    '<path d="M22 51c0 21 14 35 30 35s30-14 30-35c0-15-12-27-30-27S22 36 22 51z"/>',
    '<path d="M42 58h.01M62 58h.01"/>',
    '<path d="M52 64v8"/>',
    '<path d="M40 74c7 5 17 5 24 0"/>',
    '<path d="M30 64h12M62 64h12"/>'
  ],
  emergency: [
    '<path d="M52 20v64"/>',
    '<path d="M20 52h64"/>',
    '<rect x="18" y="18" width="68" height="68" rx="18"/>'
  ],
  kidney: [
    '<path d="M40 22h24"/>',
    '<path d="M44 22v13l-13 11v40c0 5 4 9 9 9h24c5 0 9-4 9-9V46L60 35V22"/>',
    '<path d="M40 58h24"/>',
    '<path d="M47 76h10"/>'
  ],
  endocrine: [
    '<path d="M36 26h32c9 0 16 7 16 16s-7 16-16 16H36c-9 0-16-7-16-16s7-16 16-16z"/>',
    '<path d="M52 26v32"/>',
    '<path d="M68 46c9 0 16 7 16 16s-7 16-16 16H36c-9 0-16-7-16-16s7-16 16-16"/>',
    '<path d="M52 46v32"/>'
  ],
  heart: [
    '<path d="M52 86S22 68 22 44c0-12 8-21 19-21 6 0 11 3 11 3s5-3 11-3c11 0 19 9 19 21 0 24-30 42-30 42z"/>',
    '<path d="M18 58h17l7-13 11 26 8-15h25"/>'
  ],
  skin: [
    '<path d="M52 44c5 0 9 4 9 9 0 3 2 6 5 8 6 3 10 9 10 16 0 9-7 15-16 13-5-1-10-3-15-3s-10 2-15 3c-9 2-16-4-16-13 0-7 4-13 10-16 3-2 5-5 5-8 0-5 4-9 9-9 4 0 7 2 9 5 2-3 5-5 9-5z"/>',
    '<circle cx="31" cy="34" r="7"/>',
    '<circle cx="47" cy="27" r="7"/>',
    '<circle cx="63" cy="34" r="7"/>'
  ]
};

const createCaseIcon = (iconName, className = "case-thumb-icon") => {
  const wrapper = document.createElement("span");
  wrapper.className = className;
  wrapper.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 104 104");
  svg.setAttribute("fill", "none");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = iconPaths[iconName || "internal"]?.join("") || iconPaths.internal.join("");
  wrapper.append(svg);
  return wrapper;
};

const isRecentCase = (publishedAt) => {
  if (!publishedAt) return false;
  const published = new Date(`${publishedAt}T00:00:00`);
  if (Number.isNaN(published.getTime())) return false;
  const now = new Date();
  const diffDays = (now - published) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 90;
};

const createCaseThumbnail = (item) => {
  const media = document.createElement("div");
  media.className = "case-media";

  const textWrap = document.createElement("div");
  textWrap.className = "case-thumb-text";

  const label = document.createElement("span");
  label.className = "case-thumb-label";
  label.textContent = getCaseCategories(item)[0] || "吏꾨즺 ?щ?";

  if (isRecentCase(item.publishedAt)) {
    const newBadge = document.createElement("span");
    newBadge.className = "case-new-badge";
    newBadge.textContent = "NEW";
    media.append(newBadge);
  }

  const title = document.createElement("strong");
  title.className = "case-thumb-title";
  const thumbnailLines = Array.isArray(item.thumbnailLines)
    ? item.thumbnailLines
    : String(item.thumbnailTitle || item.title).split("\n");
  thumbnailLines.slice(0, 2).forEach((line) => {
    const lineElement = document.createElement("span");
    lineElement.className = "case-thumb-title-line";
    lineElement.textContent = line;
    title.append(lineElement);
  });

  const icon = createCaseIcon(item.icon);

  textWrap.append(label, title);
  media.append(textWrap, icon);
  return media;
};

const createCaseCard = (item) => {
  const caseUrl = item.blogUrl || item.url;
  const card = document.createElement(caseUrl ? "a" : "article");
  card.className = "case-card";
  if (caseUrl) {
    card.href = caseUrl;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.setAttribute("aria-label", `${item.title} 치료 과정 보기`);
  } else {
    card.classList.add("case-card-disabled");
    card.setAttribute("aria-label", `${item.title} 치료 과정 준비 중`);
  }

  const media = createCaseThumbnail(item);
  const body = document.createElement("div");
  body.className = "case-body";

  const title = document.createElement("h3");
  title.textContent = item.title;
  body.append(title);

  const summary = document.createElement("p");
  if (Array.isArray(item.descriptionLines)) {
    item.descriptionLines.forEach((line) => {
      const span = document.createElement("span");
      span.textContent = line;
      summary.append(span);
    });
  } else {
    summary.textContent = item.description || item.subtitle || "";
  }
  body.append(summary);

  const cta = document.createElement("span");
  cta.className = "case-link";
  cta.textContent = "치료 과정 보기 →";
  body.append(cta);

  card.append(media, body);
  return card;
};

const updateCaseControls = (track, previousButton, nextButton) => {
  const canScroll = track.scrollWidth > track.clientWidth + 2;
  previousButton.disabled = !canScroll || track.scrollLeft <= 2;
  nextButton.disabled = !canScroll || track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
};

const createCaseSection = (section, cases) => {
  const sectionElement = document.createElement("section");
  sectionElement.className = "case-category-section";
  sectionElement.id = section.id;
  sectionElement.setAttribute("aria-labelledby", `case-title-${section.id}`);

  const header = document.createElement("div");
  header.className = "case-category-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "case-category-title";
  titleWrap.append(createCaseIcon(section.icon, "case-category-icon"));

  const heading = document.createElement("h3");
  heading.id = `case-title-${section.id}`;
  heading.textContent = section.title;

  const description = document.createElement("p");
  description.textContent = section.description;
  titleWrap.append(heading, description);

  const actions = document.createElement("div");
  actions.className = "case-category-actions";

  const viewAll = document.createElement("a");
  viewAll.href = "https://blog.naver.com/vet_jackpark";
  viewAll.target = "_blank";
  viewAll.rel = "noopener noreferrer";
  viewAll.textContent = `${section.title} 치료 사례 모두 보기 →`;
  viewAll.setAttribute("aria-label", `${section.title} 치료 사례 모두 보기`);
  actions.append(viewAll);
  header.append(titleWrap, actions);

  const row = document.createElement("div");
  row.className = "case-row";

  const previousButton = document.createElement("button");
  previousButton.className = "case-row-button previous";
  previousButton.type = "button";
  previousButton.setAttribute("aria-label", `${section.title} 이전 사례 보기`);
  previousButton.textContent = "‹";

  const nextButton = document.createElement("button");
  nextButton.className = "case-row-button next";
  nextButton.type = "button";
  nextButton.setAttribute("aria-label", `${section.title} 다음 사례 보기`);
  nextButton.textContent = "›";

  const track = document.createElement("div");
  track.className = "case-track";
  track.setAttribute("tabindex", "0");
  track.setAttribute("aria-label", `${section.title} 치료 사례 목록`);

  cases.forEach((item) => track.append(createCaseCard(item)));

  const mobileToggle = document.createElement("button");
  mobileToggle.className = "case-mobile-toggle";
  mobileToggle.type = "button";
  mobileToggle.textContent = `${section.title} 치료 사례 더보기`;
  mobileToggle.setAttribute("aria-expanded", "false");

  const scrollByCard = (direction) => {
    const card = track.querySelector(".case-card");
    const amount = card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: amount * direction, behavior: "smooth" });
  };

  previousButton.addEventListener("click", () => scrollByCard(-1));
  nextButton.addEventListener("click", () => scrollByCard(1));
  track.addEventListener("scroll", () => updateCaseControls(track, previousButton, nextButton), { passive: true });
  window.addEventListener("resize", () => updateCaseControls(track, previousButton, nextButton));
  mobileToggle.addEventListener("click", () => {
    const isExpanded = sectionElement.classList.toggle("mobile-expanded");
    mobileToggle.setAttribute("aria-expanded", String(isExpanded));
    mobileToggle.textContent = isExpanded ? `${section.title} 치료 사례 접기` : `${section.title} 치료 사례 더보기`;
  });

  row.append(previousButton, track, nextButton);
  sectionElement.append(header, row, mobileToggle);

  requestAnimationFrame(() => updateCaseControls(track, previousButton, nextButton));
  return sectionElement;
};

const getCaseUrl = (item) => item.blogUrl || item.url || "";

const getMobileCaseTags = (item) => {
  if (Array.isArray(item.mobileTags)) return item.mobileTags.slice(0, 3);
  if (Array.isArray(item.tags)) return item.tags.slice(0, 3);

  const source = [item.subtitle, item.description, item.title]
    .filter(Boolean)
    .join(" ")
    .replace(/[()]/g, " ")
    .split(/[·,/|\s]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 1 && !["및", "등", "진단과"].includes(tag));

  return [...new Set(source)].slice(0, 3);
};

const createMobileCaseCard = (item, sectionTitle) => {
  const card = document.createElement("a");
  card.className = "mobile-case-card";
  card.href = getCaseUrl(item) || "https://blog.naver.com/vet_jackpark";
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.setAttribute("aria-label", `${item.title} 블로그 원문 보기`);

  const badge = document.createElement("span");
  badge.className = "mobile-case-badge";
  badge.textContent = sectionTitle || getCaseCategories(item)[0] || "진료 사례";

  const title = document.createElement("strong");
  title.className = "mobile-case-title";
  title.textContent = item.mobileTitle || item.title;

  const tags = document.createElement("div");
  tags.className = "mobile-case-tags";
  getMobileCaseTags(item).forEach((tag) => {
    const tagElement = document.createElement("span");
    tagElement.textContent = `#${tag.replace(/^#/, "")}`;
    tags.append(tagElement);
  });

  const link = document.createElement("em");
  link.className = "mobile-case-link";
  link.textContent = "블로그 원문 보기 →";

  card.append(badge, title, tags, link);
  return card;
};

const getMobileSectionCases = (section, cases, limit = 3) =>
  cases
    .filter((item) => getCaseCategories(item).includes(section.title) && getCaseUrl(item))
    .slice(0, limit);

const renderMobileCaseArchive = (cases, sections) => {
  if (!mobileCaseArchive) return;

  const intro = document.createElement("div");
  intro.className = "mobile-case-intro";
  intro.innerHTML = `
    <p class="eyebrow">CASE ARCHIVE</p>
    <h3>실제 진료 케이스를<br>분야별로 모아봅니다</h3>
    <p>아이숲동물병원에서 직접 진료한 사례를 분야별로 정리했습니다. 자세한 내용은 블로그 원문에서 확인하실 수 있습니다.</p>
  `;

  const filters = document.createElement("div");
  filters.className = "mobile-case-filters";
  filters.setAttribute("role", "tablist");
  filters.setAttribute("aria-label", "치료 케이스 분야 선택");

  const list = document.createElement("div");
  list.className = "mobile-case-list";

  const sectionMap = sections.map((section) => ({
    section,
    cases: getMobileSectionCases(section, cases, 3)
  })).filter((entry) => entry.cases.length);

  const renderList = (activeId = "all") => {
    const visibleEntries = activeId === "all"
      ? sectionMap.map((entry) => ({ ...entry, cases: entry.cases.slice(0, 1) }))
      : sectionMap.filter((entry) => entry.section.id === activeId).map((entry) => ({ ...entry, cases: entry.cases.slice(0, 3) }));

    const fragment = document.createDocumentFragment();
    visibleEntries.forEach(({ section, cases: sectionCases }) => {
      sectionCases.forEach((item) => fragment.append(createMobileCaseCard(item, section.title)));
    });
    list.replaceChildren(fragment);
  };

  const makeFilterButton = (label, id, selected = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.mobileCaseFilter = id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(selected));
    if (selected) button.classList.add("active");
    button.addEventListener("click", () => {
      filters.querySelectorAll("button").forEach((filter) => {
        const isActive = filter === button;
        filter.classList.toggle("active", isActive);
        filter.setAttribute("aria-selected", String(isActive));
      });
      renderList(id);
    });
    return button;
  };

  filters.append(makeFilterButton("전체", "all", true));
  sectionMap.forEach(({ section }) => filters.append(makeFilterButton(section.title, section.id)));

  const more = document.createElement("a");
  more.className = "mobile-case-more";
  more.href = "https://blog.naver.com/vet_jackpark";
  more.target = "_blank";
  more.rel = "noopener noreferrer";
  more.textContent = "네이버 블로그에서 전체 치료 사례 보기 →";

  mobileCaseArchive.replaceChildren(intro, filters, list, more);
  renderList("all");
};

const renderCases = () => {
  if (!Array.isArray(window.IFOREST_CASES)) return;

  const fragment = document.createDocumentFragment();
  const cases = window.IFOREST_CASES;
  const sections = Array.isArray(window.IFOREST_CASE_SECTIONS) ? window.IFOREST_CASE_SECTIONS : [];

  if (caseGrid) {
    sections.forEach((section) => {
      const sectionCases = cases.filter((item) => getCaseCategories(item).includes(section.title));
      if (sectionCases.length) {
        fragment.append(createCaseSection(section, sectionCases));
      }
    });

    caseGrid.replaceChildren(fragment);
    requestAnimationFrame(() => {
      caseGrid.querySelectorAll(".case-card").forEach((card) => card.classList.add("visible"));
      const targetId = decodeURIComponent(window.location.hash.slice(1));
      const target = targetId ? document.getElementById(targetId) : null;
      target?.scrollIntoView();
    });
  }

  renderMobileCaseArchive(cases, sections);
};

renderCases();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
);

const revealItems = document.querySelectorAll(".reveal");
revealItems.forEach((item) => revealObserver.observe(item));
