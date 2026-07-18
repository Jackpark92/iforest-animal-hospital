const CATEGORIES = [
  "정형외과",
  "일반외과·종양수술",
  "내과·노령질환",
  "치과",
  "고양이 특화진료",
  "심장·건강검진",
  "안과"
];

const state = {
  config: null,
  client: null,
  user: null,
  cases: [],
  selectedCase: null,
  thumbnail: null,
  images: [],
  filters: {
    search: "",
    category: "",
    status: ""
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const show = (selector, visible) => {
  const element = $(selector);
  if (element) element.hidden = !visible;
};

const message = (selector, text, isError = false) => {
  const element = $(selector);
  if (!element) return;
  element.textContent = text || "";
  element.classList.toggle("error", Boolean(isError));
};

const loadConfig = () => new Promise((resolve) => {
  if (window.IFOREST_ADMIN_CONFIG) {
    resolve(window.IFOREST_ADMIN_CONFIG);
    return;
  }
  const script = document.createElement("script");
  script.src = "admin-config.js";
  script.onload = () => resolve(window.IFOREST_ADMIN_CONFIG || null);
  script.onerror = () => resolve(null);
  document.head.append(script);
});

const slugify = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFKC")
  .replace(/[^\p{L}\p{N}]+/gu, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 90);

const escapeText = (value = "") => {
  const span = document.createElement("span");
  span.textContent = String(value);
  return span.innerHTML;
};

const sanitizeHtml = (html = "") => {
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

const formatDate = (value) => {
  if (!value) return "-";
  return String(value).slice(0, 10);
};

const getStatusLabel = (status = "draft") => ({
  published: "공개",
  private: "비공개",
  draft: "임시저장"
}[status] || status);

const getCaseUrl = (item) => `case.html?id=${encodeURIComponent(item.slug || item.id)}&preview=1`;

const initialize = async () => {
  state.config = await loadConfig();
  const publishableKey = state.config?.supabasePublishableKey || state.config?.supabaseAnonKey;
  if (!state.config?.supabaseUrl || !publishableKey || !window.supabase?.createClient) {
    show("[data-admin-setup]", true);
    return;
  }

  state.client = window.supabase.createClient(state.config.supabaseUrl, publishableKey);
  const { data } = await state.client.auth.getSession();
  state.user = data.session?.user || null;
  state.client.auth.onAuthStateChange((_, session) => {
    state.user = session?.user || null;
    renderAuthState();
  });
  bindEvents();
  renderAuthState();
};

const bindEvents = () => {
  $("[data-login-form]")?.addEventListener("submit", handleLogin);
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-show-list], [data-back-to-list], [data-cancel-editor]");
    if (!action) return;
    event.preventDefault();
    showListView();
  });
  $$("[data-new-case]").forEach((button) => button.addEventListener("click", showCreateView));
  $("[data-logout]")?.addEventListener("click", () => state.client.auth.signOut());
  $("[data-case-search]")?.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderCaseList();
  });
  $("[data-category-filter]")?.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderCaseList();
  });
  $("[data-status-filter]")?.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderCaseList();
  });
  $("[data-case-form]")?.addEventListener("submit", handleSave);
  $("[data-thumbnail-input]")?.addEventListener("change", (event) => uploadThumbnail(event.target.files?.[0]));
  $("[data-image-input]")?.addEventListener("change", (event) => uploadContentImages([...event.target.files]));
  $$(".admin-file-drop").forEach((drop) => {
    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.currentTarget.classList.add("dragging");
    });
    drop.addEventListener("dragleave", (event) => event.currentTarget.classList.remove("dragging"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      event.currentTarget.classList.remove("dragging");
      const files = [...event.dataTransfer.files];
      if (event.currentTarget.querySelector("[data-thumbnail-input]")) {
        uploadThumbnail(files[0]);
        return;
      }
      uploadContentImages(files);
    });
  });
  $$("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      document.execCommand(button.dataset.command, false, button.dataset.value || null);
      $("[data-rich-editor]")?.focus();
    });
  });
  $("[data-insert-hr]")?.addEventListener("click", () => document.execCommand("insertHorizontalRule"));
  $("[data-insert-link]")?.addEventListener("click", () => {
    const url = window.prompt("연결할 URL을 입력해 주세요.");
    if (url && /^https:\/\//.test(url)) document.execCommand("createLink", false, url);
  });
  $("[data-detail-edit]")?.addEventListener("click", () => {
    if (state.selectedCase) showEditView(state.selectedCase.id);
  });
  $("[data-detail-delete]")?.addEventListener("click", () => {
    if (state.selectedCase) deleteCase(state.selectedCase.id);
  });
  $("[data-editor-delete]")?.addEventListener("click", () => {
    if (state.selectedCase) deleteCase(state.selectedCase.id);
  });
};

const renderAuthState = async () => {
  const loggedIn = Boolean(state.user);
  show("[data-admin-login]", !loggedIn);
  show("[data-admin-dashboard]", loggedIn);
  if (!loggedIn) return;
  await loadCases();
  await migrateBaseCasesOnce();
  showListView();
};

const handleLogin = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  message("[data-login-message]", "로그인 중입니다.");
  const { error } = await state.client.auth.signInWithPassword({
    email: form.get("email"),
    password: form.get("password")
  });
  message("[data-login-message]", error ? "로그인에 실패했습니다. 계정을 확인해 주세요." : "", Boolean(error));
};

const loadCases = async () => {
  const { data, error } = await state.client
    .from(state.config.tableName || "cases")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    message("[data-admin-message]", `목록을 불러오지 못했습니다: ${error.message}`, true);
    return;
  }
  state.cases = data || [];
  renderCategoryFilter();
  renderCaseList();
};

const renderCategoryFilter = () => {
  const select = $("[data-category-filter]");
  if (!select) return;
  const current = select.value;
  const categories = [...new Set([...CATEGORIES, ...state.cases.map((item) => item.category).filter(Boolean)])];
  select.innerHTML = '<option value="">전체</option>' + categories.map((category) => (
    `<option value="${escapeText(category)}">${escapeText(category)}</option>`
  )).join("");
  select.value = categories.includes(current) ? current : "";
};

const getFilteredCases = () => {
  const search = state.filters.search;
  return state.cases.filter((item) => {
    const searchable = [
      item.title,
      item.card_description,
      item.summary,
      item.content_html,
      item.category
    ].filter(Boolean).join(" ").toLowerCase();
    return (!search || searchable.includes(search))
      && (!state.filters.category || item.category === state.filters.category)
      && (!state.filters.status || item.status === state.filters.status);
  });
};

const renderCaseList = () => {
  const list = $("[data-case-list]");
  if (!list) return;
  const cases = getFilteredCases();
  if (!state.cases.length) {
    list.innerHTML = '<p class="admin-empty">아직 등록된 치료 사례가 없습니다.</p>';
    return;
  }
  if (!cases.length) {
    list.innerHTML = '<p class="admin-empty">검색 조건에 맞는 치료 사례가 없습니다.</p>';
    return;
  }
  list.innerHTML = `
    <div class="admin-case-table-head" aria-hidden="true">
      <span>섬네일</span>
      <span>제목</span>
      <span>작성일</span>
      <span>수정</span>
      <span>삭제</span>
      <span>공개 보기</span>
    </div>
    ${cases.map((item) => `
      <article class="admin-case-item">
        <img src="${escapeText(item.thumbnail_url || "assets/hero.jpg")}" alt="" loading="lazy">
        <button class="admin-title-button" type="button" data-edit-id="${item.id}" title="수정 화면 열기">
          <strong>${escapeText(item.title)}</strong>
          <small>${escapeText(item.category || "카테고리 없음")} · ${getStatusLabel(item.status)}</small>
        </button>
        <small>${formatDate(item.created_at || item.updated_at)}</small>
        <button type="button" data-edit-id="${item.id}">수정</button>
        <button type="button" data-delete-id="${item.id}">삭제</button>
        <div class="admin-case-actions">
          <a href="${escapeText(getCaseUrl(item))}" target="_blank" rel="noopener noreferrer">공개 보기</a>
        </div>
      </article>
    `).join("")}`;
  $$("[data-edit-id]", list).forEach((button) => button.addEventListener("click", () => showEditView(button.dataset.editId)));
  $$("[data-delete-id]", list).forEach((button) => button.addEventListener("click", () => deleteCase(button.dataset.deleteId)));
};

const setView = (view) => {
  show("[data-list-view]", view === "list");
  show("[data-detail-view]", view === "detail");
  show("[data-editor-view]", view === "editor");
};

const showListView = (text = "") => {
  state.selectedCase = null;
  renderCaseList();
  setView("list");
  message("[data-admin-message]", text);
  $("[data-list-view]")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const showDetailView = (id, text = "") => {
  const item = state.cases.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  state.selectedCase = item;
  renderDetail(item);
  setView("detail");
  message("[data-admin-message]", text);
  $("[data-detail-view]")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const showCreateView = () => {
  resetForm();
  $("[data-editor-title]").textContent = "새 글 작성";
  $("[data-save-label]").textContent = "저장";
  show("[data-editor-delete]", false);
  setView("editor");
  $("[data-editor-view]")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const showEditView = (id) => {
  const item = state.cases.find((entry) => String(entry.id) === String(id));
  if (!item) {
    message("[data-admin-message]", "수정할 글을 찾지 못했습니다. 목록을 새로 불러와 주세요.", true);
    showListView();
    return;
  }
  fillForm(item);
  $("[data-editor-title]").textContent = "치료 사례 수정";
  $("[data-save-label]").textContent = "저장";
  show("[data-editor-delete]", true);
  setView("editor");
  $("[data-editor-view]")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const renderDetail = (item) => {
  $("[data-detail-title]").textContent = item.title || "치료 사례 상세";
  const publicLink = $("[data-detail-public]");
  if (publicLink) publicLink.href = getCaseUrl(item);
  const target = $("[data-detail-content]");
  if (!target) return;
  target.innerHTML = `
    ${item.thumbnail_url ? `<img class="admin-detail-thumb" src="${escapeText(item.thumbnail_url)}" alt="">` : ""}
    <dl class="admin-detail-meta">
      <div><dt>제목</dt><dd>${escapeText(item.title || "")}</dd></div>
      <div><dt>카테고리</dt><dd>${escapeText(item.category || "")}</dd></div>
      <div><dt>공개 상태</dt><dd>${getStatusLabel(item.status)}</dd></div>
      <div><dt>작성일</dt><dd>${formatDate(item.created_at)}</dd></div>
      <div><dt>수정일</dt><dd>${formatDate(item.updated_at)}</dd></div>
    </dl>
    <section>
      <h3>카드 설명</h3>
      <p>${escapeText(item.card_description || "카드 설명이 없습니다.")}</p>
    </section>
    <section>
      <h3>본문 내용</h3>
      <div class="admin-detail-body">${sanitizeHtml(item.content_html || "<p>본문 내용이 없습니다.</p>")}</div>
    </section>
  `;
};

const resetForm = () => {
  state.selectedCase = null;
  state.thumbnail = null;
  state.images = [];
  const form = $("[data-case-form]");
  form?.reset();
  if (form) {
    form.elements.id.value = "";
    form.elements.status.value = "published";
  }
  $("[data-rich-editor]").innerHTML = "<p>진료 사례 내용을 입력해 주세요.</p>";
  renderThumbnail();
  renderImages();
};

const fillForm = (item) => {
  state.selectedCase = item;
  state.thumbnail = item.thumbnail_url ? { url: item.thumbnail_url, path: item.thumbnail_path || "", alt: `${item.title || "대표"} 이미지` } : null;
  state.images = Array.isArray(item.images) ? item.images.map(({ isThumbnail, ...image }) => image) : [];
  const form = $("[data-case-form]");
  form.elements.id.value = item.id || "";
  form.elements.title.value = item.title || "";
  form.elements.category.value = item.category || CATEGORIES[0];
  form.elements.cardDescription.value = item.card_description || "";
  form.elements.status.value = item.status || "published";
  form.elements.sourceUrl.value = item.source_url || "";
  $("[data-rich-editor]").innerHTML = item.content_html || "<p></p>";
  renderThumbnail();
  renderImages();
};

const collectPayload = () => {
  const form = $("[data-case-form]");
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const now = new Date().toISOString();
  const status = data.get("status") || "published";
  return {
    title,
    slug: slugify(state.selectedCase?.slug || title),
    category: data.get("category"),
    card_description: String(data.get("cardDescription") || "").trim(),
    summary: String(data.get("cardDescription") || "").trim(),
    thumbnail_url: state.thumbnail?.url || "",
    content_html: sanitizeHtml($("[data-rich-editor]").innerHTML),
    source_url: data.get("sourceUrl"),
    status,
    published_at: status === "published" ? (state.selectedCase?.published_at || now.slice(0, 10)) : null,
    images: state.images.map(({ isThumbnail, ...image }) => image),
    updated_at: now,
    author_id: state.user?.id
  };
};

const handleSave = async (event) => {
  event.preventDefault();
  const form = $("[data-case-form]");
  const id = form.elements.id.value;
  const payload = collectPayload();
  if (!payload.title) {
    message("[data-admin-message]", "제목을 입력해 주세요.", true);
    return;
  }
  const table = state.config.tableName || "cases";
  const query = id
    ? state.client.from(table).update(payload).eq("id", id).select().single()
    : state.client.from(table).insert({ ...payload, created_at: new Date().toISOString() }).select().single();
  const { data, error } = await query;
  if (error) {
    message("[data-admin-message]", `저장 실패: ${error.message}`, true);
    return;
  }
  await loadCases();
  if (id) {
    showDetailView(data.id, "치료 사례가 수정되었습니다.");
  } else {
    showListView("치료 사례가 등록되었습니다.");
  }
};

const deleteCase = async (id) => {
  if (!window.confirm("이 치료 사례를 삭제하시겠습니까? 삭제한 내용은 복구하기 어렵습니다.")) return;
  const { error } = await state.client.from(state.config.tableName || "cases").delete().eq("id", id);
  if (error) {
    message("[data-admin-message]", `삭제 실패: ${error.message}`, true);
    return;
  }
  await loadCases();
  showListView("치료 사례가 삭제되었습니다.");
};

const baseCaseToContentHtml = (item) => {
  if (Array.isArray(item.body) && item.body.length) {
    return item.body.map((block) => {
      if (block.type === "heading") return `<h2>${escapeText(block.text || "")}</h2>`;
      if (block.type === "image") {
        return `<figure><img src="${escapeText(block.src || "")}" alt="${escapeText(block.alt || item.title || "")}" loading="lazy"><figcaption>${escapeText(block.caption || "")}</figcaption></figure>`;
      }
      return `<p>${escapeText(block.text || "")}</p>`;
    }).join("");
  }
  return `<p>${escapeText(item.description || item.subtitle || "아이숲동물병원의 실제 치료 사례입니다.")}</p>`;
};

const migrateBaseCasesOnce = async () => {
  const baseCases = Array.isArray(window.IFOREST_CASES) ? window.IFOREST_CASES : [];
  if (!baseCases.length) return;
  const migrationKey = "iforest-base-cases-migrated-v2";
  if (window.localStorage?.getItem(migrationKey) === "1") return;
  const existingSlugs = new Set(state.cases.map((item) => item.slug || item.id).filter(Boolean));
  const missingCases = baseCases.filter((item) => !existingSlugs.has(slugify(item.id || item.title)));
  if (!missingCases.length) {
    window.localStorage?.setItem(migrationKey, "1");
    return;
  }
  const now = new Date().toISOString();
  const rows = missingCases.map((item) => ({
    title: item.title || item.thumbnailTitle || item.id,
    slug: slugify(item.id || item.title),
    category: (item.categories || [item.category] || [])[0] || CATEGORIES[0],
    card_description: item.description || item.subtitle || "",
    summary: item.description || item.subtitle || "",
    thumbnail_url: item.thumbnail || "",
    content_html: sanitizeHtml(baseCaseToContentHtml(item)),
    source_url: item.blogUrl || "",
    status: item.published === false ? "draft" : "published",
    published_at: item.publishedAt || null,
    images: Array.isArray(item.images) ? item.images : [],
    updated_at: now,
    author_id: state.user?.id
  }));
  const { error } = await state.client
    .from(state.config.tableName || "cases")
    .upsert(rows, { onConflict: "slug" });
  if (error) {
    console.info("Base case migration skipped.", error);
    return;
  }
  window.localStorage?.setItem(migrationKey, "1");
  await loadCases();
};

const isValidImageFile = (file) => file && /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 8 * 1024 * 1024;

const createStoragePath = (folder, file) => {
  const ext = file.name.split(".").pop().toLowerCase();
  return `${folder}/${state.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
};

const getPathFromPublicUrl = (url) => {
  const bucket = state.config.storageBucket || "case-images";
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = String(url || "").indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : "";
};

const uploadImageToStorage = async (file, folder) => {
  const bucket = state.config.storageBucket || "case-images";
  const filePath = createStoragePath(folder, file);
  const { error } = await state.client.storage.from(bucket).upload(filePath, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type
  });
  if (error) throw error;
  const { data } = state.client.storage.from(bucket).getPublicUrl(filePath);
  return {
    url: data.publicUrl,
    path: filePath,
    alt: file.name.replace(/\.[^.]+$/, "")
  };
};

const uploadThumbnail = async (file) => {
  if (!file) return;
  if (!isValidImageFile(file)) {
    message("[data-admin-message]", "대표 이미지는 JPG, PNG, WebP 이미지만 8MB 이하로 업로드할 수 있습니다.", true);
    return;
  }
  try {
    message("[data-thumbnail-progress]", "대표 이미지 업로드 중입니다.");
    state.thumbnail = await uploadImageToStorage(file, "thumbnails");
    message("[data-thumbnail-progress]", "");
    renderThumbnail();
  } catch (error) {
    message("[data-thumbnail-progress]", "");
    message("[data-admin-message]", `대표 이미지 업로드 실패: ${error.message}`, true);
  }
};

const removeThumbnail = async () => {
  if (!state.thumbnail) return;
  if (!window.confirm("대표 이미지를 삭제할까요? 본문 이미지는 유지됩니다.")) return;
  const path = state.thumbnail.path || getPathFromPublicUrl(state.thumbnail.url);
  state.thumbnail = null;
  if (path) {
    await state.client.storage.from(state.config.storageBucket || "case-images").remove([path]);
  }
  renderThumbnail();
};

const renderThumbnail = () => {
  const target = $("[data-thumbnail-preview]");
  if (!target) return;
  if (!state.thumbnail) {
    target.innerHTML = '<p class="admin-empty">대표 이미지가 없습니다.</p>';
    return;
  }
  target.innerHTML = `
    <article class="admin-image-item admin-thumbnail-item">
      <img src="${escapeText(state.thumbnail.url)}" alt="">
      <div>
        <strong>대표 이미지</strong>
        <small>치료 사례 목록 카드에 표시됩니다.</small>
      </div>
      <button type="button" data-remove-thumbnail>삭제</button>
    </article>
  `;
  target.querySelector("[data-remove-thumbnail]")?.addEventListener("click", removeThumbnail);
};

const uploadContentImages = async (files) => {
  const validFiles = files.filter(isValidImageFile);
  if (!validFiles.length) {
    message("[data-admin-message]", "JPG, PNG, WebP 이미지만 8MB 이하로 업로드할 수 있습니다.", true);
    return;
  }
  for (const [index, file] of validFiles.entries()) {
    message("[data-upload-progress]", `${index + 1}/${validFiles.length} 업로드 중입니다.`);
    try {
      state.images.push(await uploadImageToStorage(file, "contents"));
    } catch (error) {
      message("[data-admin-message]", `본문 이미지 업로드 실패: ${error.message}`, true);
    }
  }
  message("[data-upload-progress]", "");
  renderImages();
};

const renderImages = () => {
  const list = $("[data-image-list]");
  if (!list) return;
  if (!state.images.length) {
    list.innerHTML = '<p class="admin-empty">업로드한 본문 이미지가 없습니다.</p>';
    return;
  }
  list.innerHTML = state.images.map((image, index) => `
    <article class="admin-image-item">
      <img src="${escapeText(image.url)}" alt="">
      <input value="${escapeText(image.alt || "")}" data-alt-index="${index}" aria-label="이미지 설명">
      <button type="button" data-insert-image="${index}">본문 삽입</button>
      <button type="button" data-remove-image="${index}">삭제</button>
    </article>
  `).join("");
  $$("[data-alt-index]", list).forEach((input) => {
    input.addEventListener("input", () => {
      state.images[Number(input.dataset.altIndex)].alt = input.value;
    });
  });
  $$("[data-insert-image]", list).forEach((button) => {
    button.addEventListener("click", () => {
      const image = state.images[Number(button.dataset.insertImage)];
      document.execCommand("insertHTML", false, `<figure><img src="${image.url}" alt="${image.alt || ""}" loading="lazy"><figcaption>${image.alt || ""}</figcaption></figure>`);
    });
  });
  $$("[data-remove-image]", list).forEach((button) => {
    button.addEventListener("click", () => {
      state.images.splice(Number(button.dataset.removeImage), 1);
      renderImages();
    });
  });
};

initialize();
