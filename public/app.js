const state = {
  token: sessionStorage.getItem('token'),
  user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '{}'),
  editingProductId: null,
  settings: {},
  inactivityTimer: null,
  lastTokenRefreshAt: Number(sessionStorage.getItem('lastTokenRefreshAt') || Date.now()),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function money(value) {
  return Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
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
  if (id === 'cart') renderCart();
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
      ${state.user?.role === 'superuser' ? `<button class="trash-btn" data-delete-content="${block.id}" type="button" aria-label="Eliminar globo informativo">🗑</button>` : ''}
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

async function loadProducts() {
  state.products = await api('/api/products');
  $('#productList').innerHTML = state.products.map((product) => {
    const hasDiscount = product.discountPercent > 0;
    return `
      <article class="card">
        ${state.user?.role === 'superuser' ? `<button class="trash-btn" data-delete-product="${product.id}" type="button" aria-label="Eliminar producto">🗑</button>` : ''}
        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : '<div class="image-placeholder"></div>'}
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        ${hasDiscount ? `<span class="discount">${product.discountPercent}% OFF</span>` : ''}
        <div>
          ${hasDiscount ? `<div class="price-old">${money(product.price)}</div>` : ''}
          <div class="price-new">${money(product.finalPrice)}</div>
        </div>
        <button data-add="${product.id}">Agregar al carrito</button>
        ${state.user?.role === 'superuser' ? `
          <div class="admin-actions">
            <button class="secondary" data-edit-product="${product.id}" type="button">Editar</button>
          </div>
        ` : ''}
      </article>
    `;
  }).join('') || '<div class="panel">Todavia no hay productos cargados.</div>';

  $$('[data-add]').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
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
}

function resetProductForm() {
  const form = $('#productForm');
  form.reset();
  form.elements.id.value = '';
  form.elements.discountPercent.value = 0;
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
  form.elements.price.value = Number(product.price);
  form.elements.discountPercent.value = product.discountPercent ?? 0;
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

function persistCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  const count = Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
  $('#cartCount').textContent = count;
  $('#cartIconEmpty').classList.toggle('hidden', count > 0);
  $('#cartIconFull').classList.toggle('hidden', count === 0);
}

function renderCart() {
  const items = Object.entries(state.cart)
    .map(([id, quantity]) => ({ product: state.products.find((item) => item.id === id), quantity }))
    .filter((item) => item.product);

  if (!items.length) {
    $('#cartList').innerHTML = 'El carrito esta vacio.';
    return;
  }

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
      <p><strong>Total: ${money(order.total)}</strong></p>
      <button data-order-action="${active ? 'attend' : 'reactivate'}" data-order-id="${order.id}">
        ${active ? 'Atendido' : 'Volver a activos'}
      </button>
      ${!active ? `<button class="danger-btn" data-close-order="${order.id}" type="button">Cerrar Pedido</button>` : ''}
    </article>
  `).join('') || '<div class="panel">No hay pedidos para mostrar.</div>';

  $$('[data-order-action]').forEach((btn) => btn.addEventListener('click', async () => {
    await api(`/api/orders/${btn.dataset.orderId}/${btn.dataset.orderAction}`, { method: 'PATCH' });
    await loadOrders(active);
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
      <p><strong>Total: ${money(order.total)}</strong></p>
    </article>
  `).join('') || '<div class="panel">Todavia no hiciste pedidos.</div>';
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
      const items = Object.entries(state.cart).map(([productId, quantity]) => ({ productId, quantity }));
      if (!items.length) return toast('El carrito esta vacio');
      await api('/api/orders', { method: 'POST', body: JSON.stringify({ items }) });
      state.cart = {};
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
  bindForms();
  persistCart();
  try {
    await Promise.all([loadSettings(), loadContent(), loadProducts()]);
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
