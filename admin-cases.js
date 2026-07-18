const CATEGORIES = [
  "정형외과",
  "일반외과·종양수술",
  "내과·노령질환",
  "고양이 특화진료",
  "심장·건강검진",
  "치과",
  "안과"
];

const state = {
  config: null,
  client: null,
  user: null,
  cases: [],
  thumbnail: null,
  images: [],
  currentCase: null
};

const $ = (selector, root = document) => root.querySelector(selector);

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

const renderAuthState = async () => {
  const loggedIn = Boolean(state.user);
  show("[data-admin-login]", !loggedIn);
  show("[data-admin-dashboard]", loggedIn);
  if (loggedIn) {
    await loadCases();
    resetForm();
  }
};

const bindEvents = () => {
  $("[data-login-form]")?.addEventListener("submit", handleLogin);
  $("[data-logout]")?.addEventListener("click", () => state.client.auth.signOut());
  $("[data-new-case]")?.addEventListener("click", resetForm);
  $("[data-import-base-cases]")?.addEventListener("click", importBaseCases);
  $("[data-case-form]")?.addEventListener("submit", handleSave);
  $("[data-preview-case]")?.addEventListener("click", renderPreview);
  $("[data-thumbnail-input]")?.addEventListener("change", (event) => uploadThumbnail(event.target.files?.[0]));
  $("[data-remove-thumbnail]")?.addEventListener("click", removeThumbnail);
  $("[data-image-input]")?.addEventListener("change", (event) => uploadFiles([...event.target.files]));
  $(".admin-file-drop")?.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("dragging");
  });
  $(".admin-file-drop")?.addEventListener("dragleave", (event) => event.currentTarget.classList.remove("dragging"));
  $(".admin-file-drop")?.addEventListener("drop", (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragging");
    uploadFiles([...event.dataTransfer.files]);
  });
  document.querySelectorAll("[data-command]").forEach((button) => {
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
    message("[data-editor-message]", `목록을 불러오지 못했습니다: ${error.message}`, true);
    return;
  }
  state.cases = data || [];
  renderCaseList();
};

const getCaseUrl = (item) => `case.html?id=${encodeURIComponent(item.slug || item.id)}&preview=1`;

const getStatusLabel = (status = "draft") => ({
  draft: "임시저장",
  published: "공개",
  private: "비공개"
}[status] || status);

const renderCaseList = () => {
  const list = $("[data-case-list]");
  if (!list) return;
  if (!state.cases.length) {
    list.innerHTML = '<p class="admin-empty">아직 등록된 치료 사례가 없습니다.</p>';
    return;
  }
  list.innerHTML = state.cases.map((item) => `
    <article class="admin-case-item">
      <img src="${item.thumbnail_url || "assets/hero.jpg"}" alt="" loading="lazy">
      <div>
        <strong>${item.title}</strong>
        <span>${item.category || "카테고리 없음"} · ${getStatusLabel(item.status)}</span>
        <small>게시일 ${(item.published_at || "").slice(0, 10) || "-"}</small>
      </div>
      <button type="button" data-edit-id="${item.id}">수정</button>
      <button type="button" data-delete-id="${item.id}">삭제</button>
      <a href="${getCaseUrl(item)}" target="_blank" rel="noopener noreferrer">공개 페이지 보기</a>
    </article>
  `).join("");
  list.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => editCase(button.dataset.editId));
  });
  list.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteCase(button.dataset.deleteId));
  });
};

const resetForm = () => {
  state.currentCase = null;
  state.thumbnail = null;
  state.images = [];
  const form = $("[data-case-form]");
  form?.reset();
  if (form) form.elements.publishedAt.value = new Date().toISOString().slice(0, 10);
  $("[data-rich-editor]").innerHTML = "<p>진료 사례 내용을 입력해 주세요.</p>";
  $("[data-editor-title]").textContent = "새 치료 사례 작성";
  renderThumbnail();
  renderImages();
  message("[data-editor-message]", "");
};

const editCase = (id) => {
  const item = state.cases.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  state.currentCase = item;
  state.thumbnail = item.thumbnail_url ? { url: item.thumbnail_url, path: item.thumbnail_path || "", alt: `${item.title || "대표"} 섬네일` } : null;
  state.images = Array.isArray(item.images) ? item.images.map(({ isThumbnail, ...image }) => image) : [];
  const form = $("[data-case-form]");
  form.elements.id.value = item.id;
  form.elements.title.value = item.title || "";
  form.elements.slug.value = item.slug || "";
  form.elements.category.value = item.category || CATEGORIES[0];
  form.elements.status.value = item.status || "draft";
  form.elements.species.value = item.species || "";
  form.elements.breed.value = item.breed || "";
  form.elements.age.value = item.age || "";
  form.elements.sex.value = item.sex || "";
  form.elements.diagnosis.value = item.diagnosis || "";
  form.elements.summary.value = item.summary || "";
  form.elements.sourceUrl.value = item.source_url || "";
  form.elements.publishedAt.value = (item.published_at || "").slice(0, 10);
  $("[data-rich-editor]").innerHTML = item.content_html || "<p></p>";
  $("[data-editor-title]").textContent = "치료 사례 수정";
  renderThumbnail();
  renderImages();
};

const collectPayload = (saveMode) => {
  const form = $("[data-case-form]");
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const slug = slugify(data.get("slug") || title);
  const contentHtml = sanitizeHtml($("[data-rich-editor]").innerHTML);
  const now = new Date().toISOString();
  return {
    title,
    slug,
    category: data.get("category"),
    species: data.get("species"),
    breed: data.get("breed"),
    age: data.get("age"),
    sex: data.get("sex"),
    diagnosis: data.get("diagnosis"),
    summary: data.get("summary"),
    thumbnail_url: state.thumbnail?.url || "",
    content_html: contentHtml,
    source_url: data.get("sourceUrl"),
    status: saveMode || data.get("status") || "draft",
    published_at: saveMode === "published" ? (data.get("publishedAt") || now.slice(0, 10)) : data.get("publishedAt") || null,
    images: state.images.map(({ isThumbnail, ...image }) => image),
    updated_at: now,
    author_id: state.user?.id
  };
};

const handleSave = async (event) => {
  event.preventDefault();
  const saveMode = event.submitter?.value;
  const payload = collectPayload(saveMode);
  if (!payload.title) {
    message("[data-editor-message]", "제목을 입력해 주세요.", true);
    return;
  }
  message("[data-editor-message]", "저장 중입니다.");
  const table = state.config.tableName || "cases";
  const id = $("[data-case-form]").elements.id.value;
  const query = id
    ? state.client.from(table).update(payload).eq("id", id).select().single()
    : state.client.from(table).insert({ ...payload, created_at: new Date().toISOString() }).select().single();
  const { data, error } = await query;
  if (error) {
    message("[data-editor-message]", `저장 실패: ${error.message}`, true);
    return;
  }
  message("[data-editor-message]", "저장되었습니다.");
  state.currentCase = data;
  await loadCases();
  editCase(data.id);
};

const deleteCase = async (id) => {
  if (!window.confirm("이 치료 사례를 삭제할까요? 삭제 후 되돌릴 수 없습니다.")) return;
  const { error } = await state.client.from(state.config.tableName || "cases").delete().eq("id", id);
  if (error) {
    message("[data-editor-message]", `삭제 실패: ${error.message}`, true);
    return;
  }
  await loadCases();
  resetForm();
};

const baseCaseToContentHtml = (item) => {
  if (Array.isArray(item.body) && item.body.length) {
    return item.body.map((block) => {
      if (block.type === "heading") return `<h2>${block.text || ""}</h2>`;
      if (block.type === "image") {
        return `<figure><img src="${block.src || ""}" alt="${block.alt || item.title || ""}" loading="lazy"><figcaption>${block.caption || ""}</figcaption></figure>`;
      }
      return `<p>${block.text || ""}</p>`;
    }).join("");
  }
  return `<p>${item.description || item.subtitle || "아이숲동물병원의 실제 치료 사례입니다."}</p>`;
};

const importBaseCases = async () => {
  const baseCases = Array.isArray(window.IFOREST_CASES) ? window.IFOREST_CASES : [];
  if (!baseCases.length) {
    message("[data-editor-message]", "가져올 기본 치료 사례가 없습니다.", true);
    return;
  }
  if (!window.confirm(`기본 치료 사례 ${baseCases.length}개를 Supabase로 가져올까요? 같은 slug가 있으면 업데이트됩니다.`)) return;

  const now = new Date().toISOString();
  const rows = baseCases.map((item) => ({
    title: item.title || item.thumbnailTitle || item.id,
    slug: slugify(item.id || item.title),
    category: (item.categories || [item.category] || [])[0] || CATEGORIES[0],
    species: item.species || "",
    breed: item.breed || "",
    age: item.age || "",
    sex: item.sex || "",
    diagnosis: item.diagnosis || item.subtitle || item.description || "",
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

  message("[data-editor-message]", "기본 치료 사례를 Supabase로 가져오는 중입니다.");
  const { error } = await state.client
    .from(state.config.tableName || "cases")
    .upsert(rows, { onConflict: "slug" });

  if (error) {
    message("[data-editor-message]", `기본 사례 가져오기 실패: ${error.message}`, true);
    return;
  }
  message("[data-editor-message]", "기본 치료 사례를 Supabase로 가져왔습니다. 이제 관리자 목록에서 수정할 수 있습니다.");
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
    message("[data-editor-message]", "대표 섬네일은 JPG, PNG, WebP 이미지만 8MB 이하로 업로드할 수 있습니다.", true);
    return;
  }
  try {
    message("[data-thumbnail-progress]", "대표 섬네일 업로드 중입니다.");
    state.thumbnail = await uploadImageToStorage(file, "thumbnails");
    message("[data-thumbnail-progress]", "");
    renderThumbnail();
  } catch (error) {
    message("[data-thumbnail-progress]", "");
    message("[data-editor-message]", `대표 섬네일 업로드 실패: ${error.message}`, true);
  }
};

const removeThumbnail = async () => {
  if (!state.thumbnail) return;
  if (!window.confirm("대표 섬네일을 삭제할까요? 본문 이미지는 유지됩니다.")) return;
  const path = state.thumbnail.path || getPathFromPublicUrl(state.thumbnail.url);
  state.thumbnail = null;
  if (path) {
    await state.client.storage.from(state.config.storageBucket || "case-images").remove([path]);
  }
  renderThumbnail();
};

const uploadFiles = async (files) => {
  const validFiles = files.filter(isValidImageFile);
  if (!validFiles.length) {
    message("[data-editor-message]", "JPG, PNG, WebP 이미지만 8MB 이하로 업로드할 수 있습니다.", true);
    return;
  }
  for (const [index, file] of validFiles.entries()) {
    message("[data-upload-progress]", `${index + 1}/${validFiles.length} 업로드 중입니다.`);
    try {
      state.images.push(await uploadImageToStorage(file, "contents"));
    } catch (error) {
      message("[data-editor-message]", `본문 이미지 업로드 실패: ${error.message}`, true);
      continue;
    }
  }
  message("[data-upload-progress]", "");
  renderImages();
};

const renderThumbnail = () => {
  const target = $("[data-thumbnail-preview]");
  if (!target) return;
  if (!state.thumbnail) {
    target.innerHTML = '<p class="admin-empty">대표 섬네일이 없습니다.</p>';
    return;
  }
  target.innerHTML = `
    <article class="admin-image-item admin-thumbnail-item">
      <img src="${state.thumbnail.url}" alt="">
      <div>
        <strong>대표 섬네일</strong>
        <small>치료 아카이브 목록 카드에 표시됩니다.</small>
      </div>
      <button type="button" data-remove-thumbnail>삭제</button>
    </article>
  `;
  target.querySelector("[data-remove-thumbnail]")?.addEventListener("click", removeThumbnail);
};

const renderImages = () => {
  const list = $("[data-image-list]");
  if (!list) return;
  if (!state.images.length) {
    list.innerHTML = '<p class="admin-empty">업로드한 이미지가 없습니다.</p>';
    return;
  }
  list.innerHTML = state.images.map((image, index) => `
    <article class="admin-image-item">
      <img src="${image.url}" alt="">
      <input value="${image.alt || ""}" data-alt-index="${index}" aria-label="이미지 설명">
      <button type="button" data-insert-image="${index}">본문 삽입</button>
      <button type="button" data-remove-image="${index}">삭제</button>
    </article>
  `).join("");
  list.querySelectorAll("[data-alt-index]").forEach((input) => {
    input.addEventListener("input", () => {
      state.images[Number(input.dataset.altIndex)].alt = input.value;
    });
  });
  list.querySelectorAll("[data-insert-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const image = state.images[Number(button.dataset.insertImage)];
      document.execCommand("insertHTML", false, `<figure><img src="${image.url}" alt="${image.alt || ""}" loading="lazy"><figcaption>${image.alt || ""}</figcaption></figure>`);
    });
  });
  list.querySelectorAll("[data-remove-image]").forEach((button) => {
    button.addEventListener("click", () => {
      state.images.splice(Number(button.dataset.removeImage), 1);
      renderImages();
    });
  });
};

const renderPreview = () => {
  const payload = collectPayload($("[data-case-form]").elements.status.value);
  const target = $("[data-preview-content]");
  target.innerHTML = `
    <span>${payload.category}</span>
    <h1>${payload.title || "제목 없음"}</h1>
    ${payload.thumbnail_url ? `<img src="${payload.thumbnail_url}" alt="">` : ""}
    <p>${payload.summary || ""}</p>
    <small>${[payload.species, payload.breed, payload.age, payload.diagnosis].filter(Boolean).join(" · ")}</small>
    <div>${payload.content_html}</div>
  `;
  $("[data-preview]").hidden = false;
  $("[data-preview]").scrollIntoView({ behavior: "smooth", block: "start" });
};

initialize();
