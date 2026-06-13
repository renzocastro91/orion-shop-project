const state = {
  token: sessionStorage.getItem('token'),
  user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  products: [],
  categories: [],
  cart: JSON.parse(localStorage.getItem('cart') || '{}'),
  editingProductId: null,
  settings: {},
  theme: localStorage.getItem('theme') || 'light',
  productSearch: '',
  selectedCategoryId: '',
  expandedProductId: null,
  cashback: { rewardPesos: 0, points: 0, totalPurchased: 0 },
  useCashback: false,
  inactivityTimer: null,
  lastTokenRefreshAt: Number(sessionStorage.getItem('lastTokenRefreshAt') || Date.now()),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function money(value) {
  return Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function isYoutubeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(parsed.hostname);
  } catch (_error) {
    return false;
  }
}

function renderExtraInfo(value) {
  const text = String(value || '').trim();
  if (!text) return '<p>Todavía no hay información extra cargada para este producto.</p>';

  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const html = escapeHtml(text).replace(urlPattern, (rawUrl) => {
    const cleanUrl = rawUrl.replace(/[).,;!?]+$/, '');
    const trailing = rawUrl.slice(cleanUrl.length);
    const youtube = isYoutubeUrl(cleanUrl);
    const label = youtube ? 'Video de YouTube' : cleanUrl;
    const dataAttr = youtube ? ` data-youtube-url="${cleanUrl}"` : '';
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer"${dataAttr}>${label}</a>${trailing}`;
  });

  return `<p>${html}</p>`;
}

async function hydrateYoutubeLinks() {
  await Promise.all($$('[data-youtube-url]').map(async (link) => {
    const url = link.dataset.youtubeUrl;
    if (!url || link.dataset.loadedTitle === 'true') return;

    try {
      const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.title) {
        link.textContent = data.title;
        link.dataset.loadedTitle = 'true';
      }
    } catch (_error) {
      link.textContent = 'Video de YouTube';
    }
  }));
}

function renderRatingStars(rating, options = {}) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return [1, 2, 3, 4, 5].map((value) => {
    const active = value <= rounded ? 'active' : '';
    if (options.interactive) {
      return `<button class="rating-star ${active}" data-rate-product="${options.productId}" data-rating="${value}" type="button" aria-label="Calificar ${value} estrellas">&#9733;</button>`;
    }
    return `<span class="rating-star ${active}" aria-hidden="true">&#9733;</span>`;
  }).join('');
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3200);
}

function logout(message) {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('lastTokenRefreshAt');
  state.token = null;
  state.user = null;
  refreshSessionUI();
  loadProducts();
  showSection('home');
  if (message) toast(message);
}

function resetInactivityTimer() {
  if (!state.user) return;
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(() => logout('Sesion cerrada por inactividad'), 30 * 60 * 1000);
}

async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error inesperado' }));
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    if (response.status === 401 && !path.includes('/api/auth/login')) {
      logout('Sesion expirada. Ingresa nuevamente.');
    }
    throw new Error(message);
  }
  return response.json();
}

function saveSession(session) {
  state.token = session.accessToken;
  state.user = session.user;
  sessionStorage.setItem('token', state.token);
  sessionStorage.setItem('user', JSON.stringify(state.user));
  state.lastTokenRefreshAt = Date.now();
  sessionStorage.setItem('lastTokenRefreshAt', String(state.lastTokenRefreshAt));
  refreshSessionUI();
  resetInactivityTimer();
  showSection('home');
  loadCategories();
  loadProducts();
}

function refreshSessionUI() {
  const isAdmin = state.user?.role === 'superuser';
  const isBuyer = state.user?.role === 'buyer';
  document.body.classList.toggle('is-admin', isAdmin);
  document.body.classList.toggle('is-buyer', isBuyer);
  $('#loginGate').classList.toggle('hidden', Boolean(state.user));
  $('#appShell').classList.toggle('hidden', !state.user);
  $('#logoutBtn').classList.toggle('hidden', !state.user);
  $('#userBadge').textContent = state.user ? `${state.user.firstName} (${state.user.role})` : '';
  $$('.admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin));
  $$('.buyer-only').forEach((el) => el.classList.toggle('hidden', !isBuyer));
  renderCategoryAdminList();
}

function applyTheme() {
  const isDark = state.theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  const themeToggle = $('#themeToggleBtn');
  if (!themeToggle) return;
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
  themeToggle.title = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', state.theme);
  applyTheme();
}

function toggleProductSearch() {
  const panel = $('#productSearchPanel');
  const input = $('#productSearchInput');
  const button = $('#productSearchToggle');
  const topbar = button.closest('.topbar');
  const isOpening = !panel.classList.contains('open');

  panel.classList.toggle('open', isOpening);
  topbar?.classList.toggle('search-open', isOpening);
  button.classList.toggle('active', isOpening);
  button.setAttribute('aria-expanded', String(isOpening));
  button.setAttribute('aria-label', isOpening ? 'Cerrar busqueda' : 'Abrir busqueda');

  if (isOpening) {
    input.focus();
    return;
  }

  input.value = '';
  state.productSearch = '';
  renderProducts();
}

function fillProfileForm() {
  const form = $('#profileForm');
  if (!form || !state.user) return;

  form.elements.firstName.value = state.user.firstName || '';
  form.elements.lastName.value = state.user.lastName || '';
  form.elements.email.value = state.user.email || '';
  form.elements.phone.value = state.user.phone || '';
  form.elements.password.value = '';
  form.elements.role.value = state.user.role || '';
}

function showSection(id) {
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === id));
  $$('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === id));
  if (id === 'profile') fillProfileForm();
  if (id === 'activeOrders') loadOrders(true);
  if (id === 'attendedOrders') loadOrders(false);
  if (id === 'myOrders') loadMyOrders();
  if (id === 'buyersSummary') loadBuyersSummary();
  if (id === 'cart') loadCashback().finally(renderCart);
}

function formDataToJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function loadSettings() {
  const settings = await api('/api/settings');
  state.settings = settings;
  if (settings.backgroundUrl) document.body.style.backgroundImage = `url("${settings.backgroundUrl}")`;
  $('#brandName').textContent = settings.companyName || 'Orion Shop';
  $('#loginCompanyName').textContent = settings.companyName || 'Orion Shop';
  $('#brandForm').elements.companyName.value = settings.companyName || 'Orion Shop';

  ['#brandLogo', '#loginLogo'].forEach((selector) => {
    const logo = $(selector);
    logo.classList.toggle('hidden', !settings.logoUrl);
    if (settings.logoUrl) logo.src = settings.logoUrl;
  });

}

async function loadContent() {
  const blocks = await api('/api/content-blocks');
  $('#contentList').innerHTML = blocks.map((block) => `
    <article class="card">
      ${state.user?.role === 'superuser' ? `<button class="trash-btn" data-delete-content="${block.id}" type="button" aria-label="Eliminar globo informativo">ðŸ—‘</button>` : ''}
      <h3>${block.title}</h3>
      <p>${block.body}</p>
      ${block.imageUrl ? `<img class="content-image" src="${block.imageUrl}" alt="${block.title}">` : ''}
    </article>
  `).join('') || '<div class="panel">Todavia no hay informacion cargada.</div>';

  $$('[data-delete-content]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Eliminar este globo informativo?')) return;
    try {
      await api(`/api/content-blocks/${btn.dataset.deleteContent}`, { method: 'DELETE' });
      await loadContent();
      toast('Globo informativo eliminado');
    } catch (error) {
      toast(error.message);
    }
  }));
}

function categoryOptions(defaultLabel = 'Sin categoria') {
  return `<option value="">${defaultLabel}</option>${state.categories.map((category) => (
    `<option value="${category.id}">${category.name}</option>`
  )).join('')}`;
}

function refreshCategoryControls() {
  const productCategorySelect = $('#productForm')?.elements.categoryId;
  const categoryFilterSelect = $('#categoryFilterSelect');
  const currentProductCategory = productCategorySelect?.value || '';
  const currentFilter = categoryFilterSelect?.value || state.selectedCategoryId;

  if (productCategorySelect) {
    productCategorySelect.innerHTML = categoryOptions('Sin categoria');
    productCategorySelect.value = currentProductCategory;
  }

  if (categoryFilterSelect) {
    categoryFilterSelect.innerHTML = categoryOptions('Todas las categorias');
    categoryFilterSelect.value = currentFilter;
  }
}

function renderCategoryAdminList() {
  const target = $('#categoryAdminList');
  if (!target) return;

  target.innerHTML = state.categories.map((category) => `
    <div class="category-admin-item">
      <div>
        <strong>${category.name}</strong>
        ${category.description ? `<small>${category.description}</small>` : '<small>Sin descripcion</small>'}
      </div>
      ${state.user?.role === 'superuser' ? `<button class="danger-btn" data-delete-category="${category.id}" type="button">Quitar</button>` : ''}
    </div>
  `).join('') || '<p class="muted">Todavia no hay categorias cargadas.</p>';

  $$('[data-delete-category]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Quitar esta categoria? Los productos asociados quedaran sin categoria.')) return;
    try {
      await api(`/api/product-categories/${btn.dataset.deleteCategory}`, { method: 'DELETE' });
      if (state.selectedCategoryId === btn.dataset.deleteCategory) state.selectedCategoryId = '';
      await loadCategories();
      await loadProducts();
      toast('Categoria quitada');
    } catch (error) {
      toast(error.message);
    }
  }));
}

async function loadCategories() {
  state.categories = await api('/api/product-categories');
  if (state.selectedCategoryId && !state.categories.some((category) => category.id === state.selectedCategoryId)) {
    state.selectedCategoryId = '';
  }
  refreshCategoryControls();
  renderCategoryAdminList();
}

async function loadProducts() {
  state.products = await api('/api/products');
  cleanCartUnavailableProducts();
  renderProducts();
}

function cleanCartUnavailableProducts(showMessage = false) {
  const activeProductIds = new Set(state.products.map((product) => product.id));
  const beforeCount = Object.keys(state.cart).length;

  Object.keys(state.cart).forEach((productId) => {
    if (!activeProductIds.has(productId)) delete state.cart[productId];
  });

  const removedCount = beforeCount - Object.keys(state.cart).length;
  if (!removedCount) return false;

  persistCart();
  if (showMessage) {
    toast(removedCount === 1
      ? 'Se quito del carrito un producto que ya no esta disponible'
      : 'Se quitaron del carrito productos que ya no estan disponibles');
  }
  return true;
}

function renderProducts() {
  const search = normalizeText(state.productSearch);
  const filteredProducts = state.products.filter((product) => {
    const categoryId = product.category?.id || product.categoryId || '';
    const matchesCategory = !state.selectedCategoryId || categoryId === state.selectedCategoryId;
    const matchesSearch = !search || [
      product.name,
      product.description,
      product.category?.name,
    ].some((value) => normalizeText(value).includes(search));
    return matchesCategory && matchesSearch;
  });

  $('#productList').innerHTML = filteredProducts.map((product) => {
    const hasDiscount = product.discountPercent > 0;
    const categoryName = product.category?.name || 'Sin categoria';
    const isOpen = state.expandedProductId === product.id;
    const ratingLabel = product.ratingCount
      ? `${product.ratingAverageExact} (${product.ratingCount})`
      : 'Sin calificaciones';
    return `
      <article class="card product-card ${isOpen ? 'open' : ''}" data-product-card="${product.id}">
        ${state.user?.role === 'superuser' ? `<button class="trash-btn" data-delete-product="${product.id}" type="button" aria-label="Eliminar producto">ðŸ—‘</button>` : ''}
        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : '<div class="image-placeholder"></div>'}
        <span class="category-chip">${categoryName}</span>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="rating-summary" title="${ratingLabel}">
          <span class="rating-stars">${renderRatingStars(product.ratingAverage)}</span>
          <small>${ratingLabel}</small>
        </div>
        <span class="stock-chip ${product.stock <= 0 ? 'out-of-stock' : ''}">
          ${product.stock > 0 ? `Stock: ${product.stock}` : 'Sin stock'}
        </span>
        ${hasDiscount ? `<span class="discount">${product.discountPercent}% OFF</span>` : ''}
        <div>
          ${hasDiscount ? `<div class="price-old">${money(product.price)}</div>` : ''}
          <div class="price-new">${money(product.finalPrice)}</div>
        </div>
        <div class="product-detail">
          <h4>Información ampliada</h4>
          <div class="extra-info-content">${renderExtraInfo(product.extraInfo)}</div>
          <div class="rating-detail">
            <strong>Calificación del producto</strong>
            <div class="rating-summary large">
              <span class="rating-stars">${renderRatingStars(product.ratingAverage)}</span>
              <small>${ratingLabel}</small>
            </div>
            ${state.user?.role === 'buyer' ? `
              <div class="rating-picker">
                <span>Tu puntuación</span>
                <div>${renderRatingStars(product.myRating, { interactive: true, productId: product.id })}</div>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="product-actions">
          ${state.user?.role === 'superuser' ? `
            <div class="admin-actions">
              <button class="secondary" data-edit-product="${product.id}" type="button">Editar</button>
            </div>
          ` : ''}
          <button class="add-cart-btn" data-add="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>Agregar al carrito</button>
        </div>
              </article>
    `;
  }).join('') || '<div class="panel">No hay productos para mostrar con esos filtros.</div>';

  $$('[data-product-card]').forEach((card) => card.addEventListener('click', (event) => {
    if (event.target.closest('button, input, select, textarea, a, label')) return;
    state.expandedProductId = state.expandedProductId === card.dataset.productCard ? null : card.dataset.productCard;
    renderProducts();
  }));
  $$('[data-add]').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
  $$('[data-rate-product]').forEach((btn) => btn.addEventListener('click', async () => rateProduct(btn.dataset.rateProduct, Number(btn.dataset.rating))));
  $$('[data-edit-product]').forEach((btn) => btn.addEventListener('click', () => startProductEdit(btn.dataset.editProduct)));
  $$('[data-delete-product]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Eliminar este producto?')) return;
    try {
      await api(`/api/products/${btn.dataset.deleteProduct}`, { method: 'DELETE' });
      await loadProducts();
      toast('Producto eliminado');
    } catch (error) {
      toast(error.message);
    }
  }));
  hydrateYoutubeLinks();
}

function resetProductForm() {
  const form = $('#productForm');
  form.reset();
  form.elements.id.value = '';
  form.elements.discountPercent.value = 0;
  form.elements.extraInfo.value = '';
  form.elements.stock.value = 0;
  form.elements.categoryId.value = '';
  state.editingProductId = null;
  $('#productFormTitle').textContent = 'Cargar producto';
  $('#productSubmitBtn').textContent = 'Guardar producto';
  $('#productCancelBtn').classList.add('hidden');
}

function startProductEdit(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const form = $('#productForm');
  state.editingProductId = product.id;
  form.elements.id.value = product.id;
  form.elements.name.value = product.name;
  form.elements.description.value = product.description;
  form.elements.extraInfo.value = product.extraInfo || '';
  form.elements.price.value = Number(product.price);
  form.elements.discountPercent.value = product.discountPercent ?? 0;
  form.elements.stock.value = product.stock ?? 0;
  form.elements.categoryId.value = product.category?.id || product.categoryId || '';
  form.elements.image.value = '';

  $('#productFormTitle').textContent = `Editar producto: ${product.name}`;
  $('#productSubmitBtn').textContent = 'Guardar cambios';
  $('#productCancelBtn').classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addToCart(productId) {
  state.cart[productId] = (state.cart[productId] || 0) + 1;
  persistCart();
  toast('Producto agregado al carrito');
}

async function rateProduct(productId, rating) {
  try {
    await api(`/api/products/${productId}/rating`, { method: 'POST', body: JSON.stringify({ rating }) });
    state.expandedProductId = productId;
    await loadProducts();
    toast('Calificación guardada');
  } catch (error) {
    toast(error.message);
  }
}

function persistCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  const count = Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
  $('#cartCount').textContent = count;
  $('#cartIconEmpty').classList.toggle('hidden', count > 0);
  $('#cartIconFull').classList.toggle('hidden', count === 0);
}

async function loadCashback() {
  if (state.user?.role !== 'buyer') {
    state.cashback = { rewardPesos: 0, points: 0, totalPurchased: 0 };
    state.useCashback = false;
    return;
  }

  state.cashback = await api('/api/orders/my-cashback');
}

function renderCart() {
  cleanCartUnavailableProducts(true);
  const items = Object.entries(state.cart)
    .map(([id, quantity]) => ({ product: state.products.find((item) => item.id === id), quantity }))

  if (!items.length) {
    $('#cartList').innerHTML = 'El carrito esta vacio.';
    $('#cashbackBox').classList.add('hidden');
    return;
  }

  const originalTotal = items.reduce((sum, { product, quantity }) => sum + Number(product.finalPrice) * quantity, 0);
  const cashbackAvailable = Math.min(Number(state.cashback.rewardPesos || 0), originalTotal);
  if (!cashbackAvailable) state.useCashback = false;
  const discountedTotal = Math.max(0, originalTotal - (state.useCashback ? cashbackAvailable : 0));

  $('#cartList').innerHTML = items.map(({ product, quantity }) => `
    <div class="cart-row">
      <div>
        <strong>${product.name}</strong>
        <div>${money(product.finalPrice)} c/u</div>
      </div>
      <input data-qty="${product.id}" type="number" min="1" value="${quantity}">
      <button data-remove="${product.id}">Quitar</button>
    </div>
  `).join('');

  $('#cashbackBox').classList.toggle('hidden', state.user?.role !== 'buyer');
  $('#cashbackAvailable').textContent = money(state.cashback.rewardPesos || 0);
  $('#useCashbackInput').checked = state.useCashback;
  $('#useCashbackInput').disabled = !cashbackAvailable;
  $('#cashbackPreview').classList.toggle('hidden', !state.useCashback || !cashbackAvailable);
  $('#cartOriginalTotal').textContent = money(originalTotal);
  $('#cartDiscountedTotal').textContent = money(discountedTotal);

  $$('[data-qty]').forEach((input) => input.addEventListener('change', () => {
    state.cart[input.dataset.qty] = Math.max(1, Number(input.value));
    persistCart();
    renderCart();
  }));
  $$('[data-remove]').forEach((btn) => btn.addEventListener('click', () => {
    delete state.cart[btn.dataset.remove];
    persistCart();
    renderCart();
  }));
}

async function loadOrders(active) {
  const endpoint = active ? '/api/orders/active' : '/api/orders/attended';
  const target = active ? '#activeOrdersList' : '#attendedOrdersList';
  const orders = await api(endpoint);
  $(target).innerHTML = orders.map((order) => `
    <article class="order-card">
      <h3>#Pedido ${order.id}</h3>
      <p><strong>${order.buyer.firstName} ${order.buyer.lastName}</strong></p>
      <p>${order.buyer.email} - ${order.buyer.phone || 'Sin telefono'}</p>
      <ul>
        ${order.items.map((item) => `<li>${item.quantity} x ${item.name} - ${money(item.subtotal)}</li>`).join('')}
      </ul>
      ${Number(order.cashbackDiscount || 0) > 0 ? `
        <p>Cashback aplicado: <strong>-${money(order.cashbackDiscount)}</strong></p>
        <p>Total original: <span class="price-old">${money(order.originalTotal || order.total)}</span></p>
      ` : ''}
      <p><strong>Total: ${money(order.total)}</strong></p>
      <button data-order-action="${active ? 'attend' : 'reactivate'}" data-order-id="${order.id}">
        ${active ? 'Atendido' : 'Volver a activos'}
      </button>
      ${!active ? `<button class="danger-btn" data-close-order="${order.id}" type="button">Cerrar Pedido</button>` : ''}
    </article>
  `).join('') || '<div class="panel">No hay pedidos para mostrar.</div>';

  $$('[data-order-action]').forEach((btn) => btn.addEventListener('click', async () => {
    const isReactivate = btn.dataset.orderAction === 'reactivate';
    const options = { method: 'PATCH' };
    if (isReactivate) {
      const restoreStock = confirm('Este pedido ya habia descontado stock. Queres devolver al stock las unidades de este pedido?');
      options.body = JSON.stringify({ restoreStock });
    }
    await api(`/api/orders/${btn.dataset.orderId}/${btn.dataset.orderAction}`, options);
    await loadOrders(active);
    await loadProducts();
  }));

  $$('[data-close-order]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Cerrar este pedido y eliminarlo definitivamente de la base de datos?')) return;
    try {
      await api(`/api/orders/${btn.dataset.closeOrder}`, { method: 'DELETE' });
      await loadOrders(false);
      toast('Pedido cerrado');
    } catch (error) {
      toast(error.message);
    }
  }));
}

async function loadMyOrders() {
  if (!state.user) {
    $('#myOrdersList').innerHTML = '<div class="panel">Necesitas iniciar sesion para ver tus pedidos.</div>';
    return;
  }

  const orders = await api('/api/orders/my-history');
  $('#myOrdersList').innerHTML = orders.map((order) => `
    <article class="order-card">
      <h3>Mi Pedido #${order.buyerOrderNumber}</h3>
      <p>Estado: <strong>${order.isActive ? 'Pendiente' : 'Atendido'}</strong></p>
      <p>Fecha: ${new Date(order.createdAt).toLocaleString('es-AR')}</p>
      <ul>
        ${order.items.map((item) => `<li>${item.quantity} x ${item.name} - ${money(item.subtotal)}</li>`).join('')}
      </ul>
      ${Number(order.cashbackDiscount || 0) > 0 ? `
        <p>Cashback aplicado: <strong>-${money(order.cashbackDiscount)}</strong></p>
        <p>Total original: <span class="price-old">${money(order.originalTotal || order.total)}</span></p>
      ` : ''}
      <p><strong>Total: ${money(order.total)}</strong></p>
    </article>
  `).join('') || '<div class="panel">Todavia no hiciste pedidos.</div>';
}

async function loadBuyersSummary() {
  const summary = await api('/api/orders/buyers-summary');
  const form = $('#pointsRateForm');
  if (form) {
    form.elements.pesosPerPoint.value = summary.pesosPerPoint;
    form.elements.cashbackPesos.value = summary.cashbackPesos;
  }

  $('#buyersSummaryBody').innerHTML = summary.buyers.map((buyer) => `
    <tr>
      <td><strong>${buyer.firstName} ${buyer.lastName}</strong></td>
      <td>${buyer.email}</td>
      <td>${buyer.phone || 'Sin telefono'}</td>
      <td>${money(buyer.totalPurchased)}</td>
      <td>${money(buyer.rewardBasePurchased)}</td>
      <td><strong>${buyer.points}</strong></td>
      <td>${money(buyer.rewardPesos)}</td>
    </tr>
  `).join('') || `
    <tr>
      <td colspan="7">No hay clientes registrados.</td>
    </tr>
  `;
}

function bindForms() {
  ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      resetInactivityTimer();
      refreshTokenIfNeeded();
    }, { passive: true });
  });

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      saveSession(await api('/api/auth/login', { method: 'POST', body: JSON.stringify(formDataToJson(event.target)) }));
    } catch (error) {
      toast(error.message);
    }
  });

  $('#registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      saveSession(await api('/api/auth/register', { method: 'POST', body: JSON.stringify(formDataToJson(event.target)) }));
    } catch (error) {
      toast(error.message);
    }
  });

  $('#openRegisterBtn').addEventListener('click', () => {
    $('#registerPanel').classList.remove('hidden');
  });

  $('#closeRegisterBtn').addEventListener('click', () => {
    $('#registerPanel').classList.add('hidden');
  });

  $('#logoutBtn').addEventListener('click', () => {
    logout();
  });

  $('#cartNavBtn').addEventListener('click', () => showSection('cart'));
  $('#profileLinkBtn').addEventListener('click', () => showSection('profile'));
  $('#themeToggleBtn').addEventListener('click', toggleTheme);
  $('#useCashbackInput').addEventListener('change', (event) => {
    state.useCashback = event.target.checked;
    renderCart();
  });

  $$('.admin-tool-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const card = trigger.closest('.admin-tool-card');
      const isOpen = card.classList.contains('open');

      $$('.admin-tool-card').forEach((item) => {
        item.classList.remove('open');
        item.querySelector('.admin-tool-trigger')?.setAttribute('aria-expanded', 'false');
        item.querySelector('.admin-tool-body')?.setAttribute('aria-hidden', 'true');
      });

      if (!isOpen) {
        card.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        card.querySelector('.admin-tool-body')?.setAttribute('aria-hidden', 'false');
      }
    });
  });

  $('#productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const body = new FormData(event.target);
      body.delete('id');

      if (state.editingProductId) {
        await api(`/api/products/${state.editingProductId}`, { method: 'PATCH', body });
        toast('Producto actualizado');
      } else {
        await api('/api/products', { method: 'POST', body });
        toast('Producto creado');
      }

      resetProductForm();
      await loadProducts();
      await loadContent();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#productCancelBtn').addEventListener('click', resetProductForm);

  $('#categoryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/product-categories', { method: 'POST', body: JSON.stringify(formDataToJson(event.target)) });
      event.target.reset();
      await loadCategories();
      toast('Categoria creada');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#pointsRateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/settings/points-rate', { method: 'PATCH', body: JSON.stringify(formDataToJson(event.target)) });
      await loadBuyersSummary();
      toast('Criterio de puntos actualizado');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#productSearchInput').addEventListener('input', (event) => {
    state.productSearch = event.target.value;
    if (state.productSearch.trim()) showSection('products');
    renderProducts();
  });

  $('#productSearchToggle').addEventListener('click', toggleProductSearch);

  $('#categoryFilterSelect').addEventListener('change', (event) => {
    state.selectedCategoryId = event.target.value;
    renderProducts();
  });

  $('#contentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/content-blocks', { method: 'POST', body: new FormData(event.target) });
      event.target.reset();
      await loadContent();
      toast('Globo informativo publicado');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#backgroundForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const settings = await api('/api/settings/background-image', { method: 'PATCH', body: new FormData(event.target) });
      if (settings.backgroundUrl) document.body.style.backgroundImage = `url("${settings.backgroundUrl}")`;
      event.target.reset();
      toast('Fondo actualizado');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#brandForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const settings = await api('/api/settings/brand', { method: 'PATCH', body: new FormData(event.target) });
      state.settings = settings;
      $('#brandName').textContent = settings.companyName;
      $('#loginCompanyName').textContent = settings.companyName;
      ['#brandLogo', '#loginLogo'].forEach((selector) => {
        const logo = $(selector);
        logo.classList.toggle('hidden', !settings.logoUrl);
        if (settings.logoUrl) logo.src = settings.logoUrl;
      });
      toast('Marca actualizada');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const body = formDataToJson(event.target);
      if (!body.password) delete body.password;

      const session = await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) });
      state.token = session.accessToken;
      state.user = session.user;
      sessionStorage.setItem('token', state.token);
      sessionStorage.setItem('user', JSON.stringify(state.user));
      refreshSessionUI();
      fillProfileForm();
      toast('Perfil actualizado');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#orderBtn').addEventListener('click', async () => {
    try {
      if (!state.user) return toast('Necesitas iniciar sesion para hacer un pedido');
      await loadProducts();
      await loadCashback();
      cleanCartUnavailableProducts(true);
      const items = Object.entries(state.cart).map(([productId, quantity]) => ({ productId, quantity }));
      if (!items.length) return toast('El carrito esta vacio');
      await api('/api/orders', { method: 'POST', body: JSON.stringify({ items, useCashback: state.useCashback }) });
      state.cart = {};
      state.useCashback = false;
      await loadCashback();
      persistCart();
      renderCart();
      toast('Pedido generado');
      if (state.user?.role === 'buyer') await loadMyOrders();
    } catch (error) {
      toast(error.message);
    }
  });

  $$('.nav-btn').forEach((btn) => btn.addEventListener('click', () => showSection(btn.dataset.section)));
}

async function refreshTokenIfNeeded() {
  if (!state.user || Date.now() - state.lastTokenRefreshAt < 20 * 60 * 1000) return;
  try {
    const session = await api('/api/auth/refresh', { method: 'POST' });
    state.token = session.accessToken;
    state.user = session.user;
    sessionStorage.setItem('token', state.token);
    sessionStorage.setItem('user', JSON.stringify(state.user));
    state.lastTokenRefreshAt = Date.now();
    sessionStorage.setItem('lastTokenRefreshAt', String(state.lastTokenRefreshAt));
  } catch (_error) {
    logout('Sesion expirada');
  }
}

async function init() {
  applyTheme();
  bindForms();
  persistCart();
  try {
    await Promise.all([loadSettings(), loadContent(), loadCategories()]);
    await loadProducts();
    if (state.token && state.user) {
      const freshSession = await api('/api/auth/refresh', { method: 'POST' });
      saveSession(freshSession);
    } else {
      refreshSessionUI();
    }
    resetInactivityTimer();
  } catch (error) {
    if (state.token) logout('Sesion expirada. Ingresa nuevamente.');
    refreshSessionUI();
    toast(error.message);
  }
}

init();
