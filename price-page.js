const priceRoot = document.querySelector("[data-price-list]");
const priceCategories = window.IFOREST_PRICE_CATEGORIES || [];

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderPriceSection = ({ category, items = [] }) => {
  const tableRows = items
    .map(
      (item) => `
        <tr>
          <td data-label="구분">${escapeHtml(category)}</td>
          <th scope="row" data-label="진료 항목">${escapeHtml(item.name)}</th>
          <td class="price-value" data-label="진료비용">${escapeHtml(item.price || "추후 입력")}</td>
          <td data-label="비고">${escapeHtml(item.note || "-")}</td>
        </tr>
      `
    )
    .join("");

  const mobileCards = items
    .map(
      (item) => `
        <article class="price-item-card">
          <p class="price-item-category">${escapeHtml(category)}</p>
          <h3>${escapeHtml(item.name)}</h3>
          <dl>
            <div>
              <dt>진료비용</dt>
              <dd>${escapeHtml(item.price || "추후 입력")}</dd>
            </div>
            <div>
              <dt>비고</dt>
              <dd>${escapeHtml(item.note || "-")}</dd>
            </div>
          </dl>
        </article>
      `
    )
    .join("");

  return `
    <section class="price-category-card" aria-labelledby="price-${escapeHtml(category).replace(/\s+/g, "-")}">
      <div class="price-category-heading">
        <span aria-hidden="true"></span>
        <h2 id="price-${escapeHtml(category).replace(/\s+/g, "-")}">${escapeHtml(category)}</h2>
      </div>
      <div class="price-table-wrap">
        <table class="price-table">
          <thead>
            <tr>
              <th scope="col">구분</th>
              <th scope="col">진료 항목</th>
              <th scope="col">진료비용</th>
              <th scope="col">비고</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="price-mobile-list">${mobileCards}</div>
    </section>
  `;
};

if (priceRoot) {
  priceRoot.innerHTML = priceCategories.map(renderPriceSection).join("");
}
