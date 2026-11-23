const API_BASE = `http://${window.location.hostname}:5000/api`;
const STOCK_MINIMO_ALERTA = 5;

const productos = [];
let categorias = [];
let apiDisponible = false;

const FALLBACK_CATEGORIAS = [
  { id: 1, nombre: "Granos" },
  { id: 2, nombre: "Lacteos" },
  { id: 3, nombre: "Abarrotes" },
  { id: 4, nombre: "Bebidas" }
];

const FALLBACK_PRODUCTOS = [
  { id: 1, nombre: "Arroz 1kg", precio: 28.5, stock: 45, categoria: "Granos" },
  { id: 2, nombre: "Frijol 1kg", precio: 36.0, stock: 32, categoria: "Granos" },
  { id: 3, nombre: "Leche 1L", precio: 24.0, stock: 50, categoria: "Lacteos" },
  { id: 4, nombre: "Huevo 18 pzas", precio: 62.0, stock: 20, categoria: "Abarrotes" },
  { id: 5, nombre: "Azucar 1kg", precio: 31.0, stock: 40, categoria: "Granos" },
  { id: 6, nombre: "Cafe soluble 100g", precio: 89.0, stock: 18, categoria: "Bebidas" }
];

const carrito = [];
let historialScope = "hoy";
const LOGIN_TOKEN_KEY = "pdv_auth_token";
let sesionUsuario = null;

let alertaStockTimer = null;
let alertaStockFirma = null;

const busquedaInput = document.getElementById("busqueda");
const sugerenciasEl = document.getElementById("sugerenciasProductos");
const limpiarBusquedaBtn = document.getElementById("limpiarBusqueda");
const estadoApiEl = document.getElementById("estadoApi");
const resultadosEl = document.getElementById("resultados");
const estadoBusquedaEl = document.getElementById("estadoBusqueda");
const formProducto = document.getElementById("formProducto");
const categoriaProductoSelect = document.getElementById("categoriaProducto");
const mensajeProductoEl = document.getElementById("mensajeProducto");
const alertaStockBox = document.getElementById("alertaStockBox");
const alertaStockTexto = document.getElementById("alertaStockTexto");
const abrirAlertaStockBtn = document.getElementById("abrirAlertaStock");
const abrirVentanaInventarioBtn = document.getElementById("abrirVentanaInventario");
const carritoEl = document.getElementById("carrito");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const historialVentasEl = document.getElementById("historialVentas");
const vaciarCarritoBtn = document.getElementById("vaciarCarrito");
const finalizarCompraBtn = document.getElementById("finalizarCompra");
const mensajeEl = document.getElementById("mensaje");
const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const loginUsuario = document.getElementById("loginUsuario");
const loginPassword = document.getElementById("loginPassword");
const loginMensaje = document.getElementById("loginMensaje");
const userSessionBar = document.getElementById("userSessionBar");
const sessionUsuario = document.getElementById("sessionUsuario");
const cerrarSesionBtn = document.getElementById("cerrarSesionBtn");
const registroForm = document.getElementById("registroForm");
const registroNombre = document.getElementById("registroNombre");
const registroUsuario = document.getElementById("registroUsuario");
const registroPassword = document.getElementById("registroPassword");
const registroTelefono = document.getElementById("registroTelefono");
const registroMensaje = document.getElementById("registroMensaje");
const mostrarLogin = document.getElementById("mostrarLogin");
const mostrarRegistro = document.getElementById("mostrarRegistro");
const abrirVentanaPedidosBtn = document.getElementById("abrirVentanaPedidos");
const pedidosBadge = document.getElementById("pedidosBadge");

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(value);
}

function mapProductoApi(productoApi) {
  return {
    id: Number(productoApi.id),
    nombre: productoApi.nombre,
    precio: Number(productoApi.precio_venta),
    stock: Number(productoApi.stock_actual),
    categoria: productoApi.categoria_nombre
  };
}

function obtenerProductosStockMinimo() {
  return productos
    .filter((producto) => Number(producto.stock) <= STOCK_MINIMO_ALERTA)
    .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre));
}

function renderAlertaStock() {
  if (!alertaStockBox || !alertaStockTexto) {
    return;
  }

  const productosBajoStock = obtenerProductosStockMinimo();
  if (!productosBajoStock.length) {
    if (alertaStockTimer) {
      clearTimeout(alertaStockTimer);
      alertaStockTimer = null;
    }
    alertaStockFirma = null;
    alertaStockBox.hidden = true;
    return;
  }

  const firmaActual = productosBajoStock
    .map((producto) => `${producto.id}:${producto.stock}`)
    .join("|");

  const etiquetas = productosBajoStock.slice(0, 3).map((p) => `${p.nombre} (${p.stock})`);
  const resumen = etiquetas.join(", ");
  const restantes = productosBajoStock.length - etiquetas.length;

  alertaStockTexto.textContent = restantes > 0
    ? `${resumen} y ${restantes} producto(s) mas tienen stock en ${STOCK_MINIMO_ALERTA} o menos.`
    : `${resumen} tiene(n) stock en ${STOCK_MINIMO_ALERTA} o menos.`;

  if (firmaActual === alertaStockFirma) {
    return;
  }

  alertaStockFirma = firmaActual;

  if (alertaStockTimer) {
    clearTimeout(alertaStockTimer);
  }

  alertaStockBox.hidden = false;
  alertaStockTimer = setTimeout(() => {
    alertaStockBox.hidden = true;
    alertaStockTimer = null;
  }, 5000);
}

function abrirVentanaStockMinimo() {
  window.open("stock_alertas.html", "_blank", "noopener,noreferrer");
}

function abrirVentanaInventario() {
  window.open("inventario.html", "_blank", "noopener,noreferrer");
}

function abrirVentanaPedidos() {
  window.open("pedidos.html", "_blank", "noopener,noreferrer");
}

async function cargarCategorias() {
  const response = await fetch(`${API_BASE}/categorias`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error("No se pudieron cargar categorias");
  }

  categorias = await response.json();
  if (categorias.length === 0) {
    categorias = [...FALLBACK_CATEGORIAS];
  }
  renderCategorias();
}

async function cargarProductos() {
  const response = await fetch(`${API_BASE}/productos`, { headers: authHeaders(), cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudieron cargar productos");
  }

  const rows = await response.json();
  productos.length = 0;
  productos.push(...rows.map(mapProductoApi));
  renderResultados();
  renderAlertaStock();
}

async function cargarPedidos() {
  if (!sesionUsuario || !["admin", "cajero"].includes(sesionUsuario.rol)) return;

  try {
    const response = await fetch(`${API_BASE}/pedidos`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return;
    const pedidos = await response.json();
    const nuevos = Array.isArray(pedidos) ? pedidos.length : 0;
    pedidosBadge.textContent = String(nuevos);
    pedidosBadge.hidden = nuevos === 0;
  } catch (error) {
    pedidosBadge.hidden = true;
  }
}

function renderCategorias() {
  categoriaProductoSelect.innerHTML = "";

  if (categorias.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Sin categorias";
    categoriaProductoSelect.appendChild(option);
    return;
  }

  categorias.forEach((categoria) => {
    const option = document.createElement("option");
    option.value = String(categoria.id);
    option.textContent = categoria.nombre;
    categoriaProductoSelect.appendChild(option);
  });
}

async function inicializarApi() {
  try {
    await Promise.all([cargarCategorias(), cargarProductos()]);
    apiDisponible = true;
    estadoApiEl.textContent = "Conectado a base de datos (PostgreSQL).";
  } catch (error) {
    apiDisponible = false;
    categorias = [...FALLBACK_CATEGORIAS];
    productos.length = 0;
    productos.push(...FALLBACK_PRODUCTOS);
    renderCategorias();
    renderResultados();
    renderAlertaStock();
    estadoApiEl.textContent = "API no disponible: usando modo local. Inicia backend/src/api.py para guardar en BD.";
  }
}

function buscarProductos(query) {
  const text = query.trim().toLowerCase();
  if (!text) {
    return [];
  }

  return productos.filter((producto) => producto.nombre.toLowerCase().includes(text));
}

function getCantidadEnCarrito(productoId) {
  const item = carrito.find((entry) => entry.id === productoId);
  return item ? item.cantidad : 0;
}

function renderSugerencias() {
  const query = busquedaInput.value.trim().toLowerCase();
  sugerenciasEl.innerHTML = "";

  if (!query) {
    return;
  }

  const sugeridos = productos
    .filter((producto) => producto.nombre.toLowerCase().includes(query))
    .slice(0, 8);

  sugeridos.forEach((producto) => {
    const option = document.createElement("option");
    option.value = producto.nombre;
    sugerenciasEl.appendChild(option);
  });
}

function renderResultados() {
  const query = busquedaInput.value;
  const encontrados = buscarProductos(query);
  renderSugerencias();
  resultadosEl.innerHTML = "";

  if (!query.trim()) {
    estadoBusquedaEl.textContent = "Escribe para filtrar productos.";
    return;
  }

  if (encontrados.length === 0) {
    estadoBusquedaEl.textContent = "No se encontraron productos con ese nombre.";
    return;
  }

  estadoBusquedaEl.textContent = `Se encontraron ${encontrados.length} producto(s).`;

  encontrados.forEach((producto) => {
    const item = document.createElement("article");
    item.className = "item";

    const qtyInputId = `qty-${producto.id}`;
    const availableStock = producto.stock - getCantidadEnCarrito(producto.id);

    item.innerHTML = `
      <div>
        <strong>${producto.nombre}</strong>
        <div class="item__meta">
          <span>Categoria: ${producto.categoria}</span>
          <span>Precio: ${formatMoney(producto.precio)}</span>
          <span>Stock: ${availableStock}</span>
        </div>
      </div>
      <div class="item__actions">
        <input id="${qtyInputId}" class="qty" type="number" min="1" max="${Math.max(1, availableStock)}" value="1" />
        <button class="btn small" data-action="agregar" data-id="${producto.id}">Agregar</button>
      </div>
    `;

    if (availableStock <= 0) {
      const addButton = item.querySelector("button");
      addButton.disabled = true;
      addButton.title = "Sin stock disponible";
    }

    resultadosEl.appendChild(item);
  });
}

function renderCarrito() {
  carritoEl.innerHTML = "";

  if (carrito.length === 0) {
    carritoEl.innerHTML = '<p class="muted">No hay productos en el carrito.</p>';
    updateTotales();
    return;
  }

  carrito.forEach((item) => {
    const article = document.createElement("article");
    article.className = "item";
    article.innerHTML = `
      <div>
        <strong>${item.nombre}</strong>
        <div class="item__meta">
          <span>Cantidad: ${item.cantidad}</span>
          <span>Precio unitario: ${formatMoney(item.precio)}</span>
          <span>Importe: ${formatMoney(item.cantidad * item.precio)}</span>
        </div>
      </div>
      <div class="item__actions">
        <button class="btn btn--danger small" data-action="quitar" data-id="${item.id}">Quitar</button>
      </div>
    `;

    carritoEl.appendChild(article);
  });

  updateTotales();
}

function updateTotales() {
  const subtotal = carrito.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  const total = subtotal;

  subtotalEl.textContent = formatMoney(subtotal);
  totalEl.textContent = formatMoney(total);
}

function agregarAlCarrito(productoId, cantidad) {
  const producto = productos.find((entry) => entry.id === productoId);
  if (!producto) {
    return;
  }

  const cantidadActual = getCantidadEnCarrito(productoId);
  const nuevoTotal = cantidadActual + cantidad;

  if (nuevoTotal > producto.stock) {
    mensajeEl.textContent = `Stock insuficiente para ${producto.nombre}.`;
    return;
  }

  const existente = carrito.find((entry) => entry.id === productoId);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad
    });
  }

  mensajeEl.textContent = `Se agrego ${producto.nombre} x ${cantidad}.`;
  renderResultados();
  renderCarrito();
}

function quitarDelCarrito(productoId) {
  const index = carrito.findIndex((item) => item.id === productoId);
  if (index < 0) {
    return;
  }

  const [deleted] = carrito.splice(index, 1);
  mensajeEl.textContent = `Se quito ${deleted.nombre} del carrito.`;
  renderResultados();
  renderCarrito();
}

function vaciarCarrito() {
  carrito.length = 0;
  mensajeEl.textContent = "Carrito vaciado.";
  renderResultados();
  renderCarrito();
}

function renderHistorialVentas(ventas) {
  historialVentasEl.innerHTML = "";

  if (!ventas.length) {
    historialVentasEl.innerHTML = '<p class="muted">No hay ventas registradas.</p>';
    return;
  }

  const totalVentas = ventas.reduce((acc, venta) => acc + Number(venta.total || 0), 0);
  const lista = document.createElement("div");
  lista.className = "historial-lista";

  ventas.forEach((venta) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "venta-item";

    const detalle = Array.isArray(venta.detalle) ? venta.detalle : [];
    const productosHtml = detalle
      .map(
        (item) =>
          `<li><span>${item.producto_nombre}</span><strong>${item.cantidad} x ${formatMoney(item.precio_unitario)}</strong></li>`
      )
      .join("");

    const fecha = new Date(venta.fecha_hora).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    tarjeta.innerHTML = `
      <div class="venta-item__header">
        <div>
          <strong>${venta.folio}</strong>
          <span>${fecha}</span>
        </div>
        <strong>${formatMoney(Number(venta.total))}</strong>
      </div>
      <ul class="venta-productos">${productosHtml || "<li><span>Sin detalle</span></li>"}</ul>
      <div class="venta-item__meta">
        <span>${venta.metodo_pago || "Efectivo"}</span>
        <span>${venta.caja_nombre || "Caja 1"}</span>
      </div>
    `;
    lista.appendChild(tarjeta);
  });

  const resumen = document.createElement("div");
  resumen.className = "historial-total";
  const etiquetaTotal = historialScope === "hoy"
    ? "del día"
    : historialScope === "ayer"
      ? "de ayer"
      : "histórico";
  resumen.innerHTML = `
    <span>Total ${etiquetaTotal}</span>
    <strong>${formatMoney(totalVentas)}</strong>
  `;

  historialVentasEl.appendChild(lista);
  historialVentasEl.appendChild(resumen);
}

async function cargarHistorialVentas(scope = historialScope) {
  historialScope = scope;

  try {
    const response = await fetch(`${API_BASE}/ventas?scope=${scope}`, { headers: authHeaders(), cache: "no-store" });
    if (!response.ok) {
      throw new Error("No se pudo cargar el historial");
    }

    const ventas = await response.json();
    renderHistorialVentas(Array.isArray(ventas) ? ventas : []);

    document.querySelectorAll("[data-historial-scope]").forEach((btn) => {
      const isActive = btn.dataset.historialScope === scope;
      btn.classList.toggle("active", isActive);
    });
  } catch (error) {
    historialVentasEl.innerHTML = '<p class="muted">No hay historial disponible.</p>';
  }
}

async function finalizarCompra() {
  if (carrito.length === 0) {
    mensajeEl.textContent = "No hay productos para cobrar.";
    return;
  }

  const subtotal = carrito.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const payload = {
    subtotal,
    iva,
    total,
    metodo_pago_id: 1,
    items: carrito.map((item) => ({
      id: item.id,
      cantidad: item.cantidad,
      precio: item.precio
    }))
  };

  try {
    const response = await fetch(`${API_BASE}/ventas`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      const errores = body.errores?.join(" | ") || "No se pudo guardar la venta.";
      mensajeEl.textContent = errores;
      return;
    }

    const totalCobrado = formatMoney(total);
    carrito.length = 0;
    renderResultados();
    renderCarrito();
    await cargarProductos();
    await cargarHistorialVentas(historialScope);
    mensajeEl.textContent = `Compra finalizada. Total cobrado: ${totalCobrado}. Folio: ${body.venta?.folio || "VTA"}.`;
  } catch (error) {
    mensajeEl.textContent = "Error al guardar la venta. Verifica la API y PostgreSQL.";
  }
}

async function guardarProductoEnDb(event) {
  event.preventDefault();

  if (!apiDisponible) {
    mensajeProductoEl.textContent = "No hay conexion a la base de datos. Revisa DB_USER/DB_PASSWORD y reinicia la API.";
    return;
  }

  const payload = {
    nombre: document.getElementById("nombreProducto").value.trim(),
    categoria_id: Number(categoriaProductoSelect.value),
    precio_venta: Number(document.getElementById("precioVenta").value),
    stock_actual: Number(document.getElementById("stockInicial").value),
    codigo_barras: document.getElementById("codigoBarras").value.trim() || null,
    sku: document.getElementById("skuProducto").value.trim() || null
  };

  if (!payload.nombre || !payload.categoria_id || payload.precio_venta < 0 || payload.stock_actual < 0) {
    mensajeProductoEl.textContent = "Completa los campos obligatorios correctamente.";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/productos`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      const errores = body.errores?.join(" | ") || "No se pudo guardar el producto.";
      mensajeProductoEl.textContent = errores;
      return;
    }

    const nuevoProducto = mapProductoApi(body.producto);
    productos.push(nuevoProducto);
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    formProducto.reset();
    mensajeProductoEl.textContent = `Producto guardado: ${nuevoProducto.nombre}.`;
    renderResultados();
    renderAlertaStock();
  } catch (error) {
    mensajeProductoEl.textContent = "Error al guardar en base de datos. Verifica la API y credenciales PostgreSQL.";
  }
}

// Oculta cualquier alerta heredada del HTML hasta que exista stock bajo real.
if (alertaStockBox) {
  alertaStockBox.hidden = true;
}

busquedaInput.addEventListener("input", () => {
  renderSugerencias();
  renderResultados();
});

busquedaInput.addEventListener("change", () => {
  const valor = busquedaInput.value.trim();
  if (!valor) {
    return;
  }

  const producto = productos.find((entry) => entry.nombre.toLowerCase() === valor.toLowerCase());
  if (producto) {
    busquedaInput.value = producto.nombre;
  }
  renderResultados();
});

limpiarBusquedaBtn.addEventListener("click", () => {
  busquedaInput.value = "";
  sugerenciasEl.innerHTML = "";
  mensajeEl.textContent = "";
  renderResultados();
});

resultadosEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.dataset.action !== "agregar") {
    return;
  }

  const productoId = Number(target.dataset.id);
  const qtyInput = document.getElementById(`qty-${productoId}`);

  if (!(qtyInput instanceof HTMLInputElement)) {
    return;
  }

  const cantidad = Number(qtyInput.value);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    mensajeEl.textContent = "La cantidad debe ser un entero mayor a 0.";
    return;
  }

  agregarAlCarrito(productoId, cantidad);
});

carritoEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.dataset.action !== "quitar") {
    return;
  }

  quitarDelCarrito(Number(target.dataset.id));
});

vaciarCarritoBtn.addEventListener("click", vaciarCarrito);
finalizarCompraBtn.addEventListener("click", finalizarCompra);
formProducto.addEventListener("submit", guardarProductoEnDb);

if (abrirAlertaStockBtn) {
  abrirAlertaStockBtn.addEventListener("click", abrirVentanaStockMinimo);
}

if (abrirVentanaInventarioBtn) {
  abrirVentanaInventarioBtn.addEventListener("click", abrirVentanaInventario);
}

if (abrirVentanaPedidosBtn) {
  abrirVentanaPedidosBtn.addEventListener("click", abrirVentanaPedidos);
}

document.querySelectorAll("[data-historial-scope]").forEach((btn) => {
  btn.addEventListener("click", () => {
    cargarHistorialVentas(btn.dataset.historialScope);
  });
});

if (loginForm) {
  loginForm.addEventListener("submit", iniciarSesion);
}
if (cerrarSesionBtn) {
  // El controlador principal de cierre se registra al final del archivo.
}

async function iniciarAplicacion() {
  actualizarEstadoSesion();
  await restaurarSesion();
  renderCarrito();

  if (!sesionUsuario) {
    estadoApiEl.textContent = "Inicia sesión para conectar con PostgreSQL.";
    return;
  }

  await inicializarApi();
  await cargarHistorialVentas(historialScope);
}

// Inicialización
iniciarAplicacion();

// Funciones de autenticación
function mostrarMensajeLogin(mensaje, esError = false) {
  loginMensaje.textContent = mensaje;
  loginMensaje.classList.toggle("error", esError);
}

function guardarTokenEnSesion(token) {
  localStorage.setItem(LOGIN_TOKEN_KEY, token);
}

function obtenerTokenDeSesion() {
  return localStorage.getItem(LOGIN_TOKEN_KEY);
}

function eliminarTokenDeSesion() {
  localStorage.removeItem(LOGIN_TOKEN_KEY);
}

function actualizarEstadoSesion() {
  const hayToken = Boolean(obtenerTokenDeSesion());
  if (!hayToken) {
    userSessionBar.hidden = true;
    userSessionBar.style.removeProperty("display");
    loginOverlay.hidden = false;
    loginOverlay.style.removeProperty("display");
  }
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem(LOGIN_TOKEN_KEY);
  return token ? { ...extra, "X-Auth-Token": token } : extra;
}

function aplicarPermisos() {
  const esAdmin = sesionUsuario?.rol === "admin";
  const esCajero = sesionUsuario?.rol === "cajero";

  if (document.querySelector("#abrirVentanaInventario")?.closest(".card")) {
    document.querySelector("#abrirVentanaInventario").closest(".card").hidden = !esAdmin;
  }
  if (formProducto) {
    formProducto.closest(".card").hidden = !esAdmin;
  }

  document.querySelectorAll("[data-historial-scope='ayer'], [data-historial-scope='all']")
    .forEach((boton) => { boton.hidden = !esAdmin; });

  if (esCajero) {
    historialScope = "hoy";
  }

  if (userSessionBar && sessionUsuario) {
    sessionUsuario.textContent = "";
    sessionUsuario.hidden = true;
    userSessionBar.classList.remove("is-leaving");
    userSessionBar.style.removeProperty("display");
    userSessionBar.hidden = false;
  }

  if (document.getElementById("pedidosCard")) {
    document.getElementById("pedidosCard").hidden = !esAdmin && !esCajero;
  }

  actualizarPedidosBadge();
}

async function iniciarSesion(event) {
  event.preventDefault();
  loginMensaje.textContent = "Verificando...";

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: loginUsuario.value.trim(),
        password: loginPassword.value,
      }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body.ok) {
      loginMensaje.textContent = body.errores?.join(" | ") || "No se pudo iniciar sesión.";
      return;
    }

    localStorage.setItem(LOGIN_TOKEN_KEY, body.token);
    sesionUsuario = body.usuario;

    if (sesionUsuario.rol === "cliente") {
      window.location.href = "catalogo.html";
      return;
    }

    loginPassword.value = "";
    loginOverlay.classList.remove("is-entering");
    loginOverlay.style.removeProperty("display");
    loginOverlay.hidden = true;
    aplicarPermisos();
    await inicializarApi();
    await cargarHistorialVentas("hoy");
  } catch (error) {
    loginMensaje.textContent = "No fue posible conectar con el backend.";
  }
}

async function cerrarSesion() {
  const token = localStorage.getItem(LOGIN_TOKEN_KEY);
  if (userSessionBar) {
    userSessionBar.classList.add("is-leaving");
  }

  await new Promise((resolve) => setTimeout(resolve, 260));

  if (token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "X-Auth-Token": token },
    }).catch(() => {});
  }

  localStorage.removeItem(LOGIN_TOKEN_KEY);
  sesionUsuario = null;
  userSessionBar.classList.remove("is-leaving");
  userSessionBar.style.removeProperty("display");
  userSessionBar.hidden = true;
  loginOverlay.hidden = false;
  loginOverlay.style.removeProperty("display");
  loginOverlay.classList.remove("is-entering");
  void loginOverlay.offsetWidth;
  loginOverlay.classList.add("is-entering");
  loginUsuario.value = "";
  loginPassword.value = "";
  loginMensaje.textContent = "";
  loginUsuario.focus();
}

async function restaurarSesion() {
  const token = localStorage.getItem(LOGIN_TOKEN_KEY);
  if (!token) {
    loginOverlay.hidden = false;
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, { headers: { "X-Auth-Token": token } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      localStorage.removeItem(LOGIN_TOKEN_KEY);
      loginOverlay.hidden = false;
      return;
    }
    sesionUsuario = body.usuario;
    loginOverlay.hidden = true;
    aplicarPermisos();
  } catch (error) {
    loginOverlay.hidden = false;
  }
}

// Eventos de autenticación
loginForm.addEventListener("submit", iniciarSesion);
cerrarSesionBtn.addEventListener("click", cerrarSesion);

function mostrarMensajeRegistro(mensaje, esError = false) {
  registroMensaje.textContent = mensaje;
  registroMensaje.classList.toggle("error", esError);
}

async function registrarUsuario(event) {
  event.preventDefault();
  mostrarMensajeRegistro("Registrando...");

  const payload = {
    nombre: registroNombre.value.trim(),
    usuario: registroUsuario.value.trim(),
    password: registroPassword.value,
    telefono: registroTelefono.value.trim() || null
  };

  try {
    const response = await fetch(`${API_BASE}/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body.ok) {
      mostrarMensajeRegistro(body.errores?.join(" | ") || "Error al registrar usuario.", true);
      return;
    }

    mostrarMensajeRegistro("Registro exitoso. Inicia sesión.", false);
    setTimeout(() => {
      loginUsuario.value = payload.usuario;
      loginPassword.value = payload.password;
      iniciarSesion(event);
    }, 1000);
  } catch (error) {
    mostrarMensajeRegistro("Error de conexión. Intenta nuevamente.", true);
  }
}

function toggleForms() {
  loginOverlay.classList.toggle("is-registering");
  void loginOverlay.offsetWidth;
  loginOverlay.classList.toggle("is-entering");
}

mostrarRegistro.addEventListener("click", (event) => {
  event.preventDefault();
  toggleForms();
});

mostrarLogin.addEventListener("click", (event) => {
  event.preventDefault();
  toggleForms();
});

registroForm.addEventListener("submit", registrarUsuario);

// Cambios sugeridos
function mostrarPestanaLogin() {
  loginForm.hidden = false;
  registroForm.hidden = true;
  mostrarLogin.classList.add("active");
  mostrarRegistro.classList.remove("active");
  loginMensaje.textContent = "";
}

function mostrarPestanaRegistro() {
  loginForm.hidden = true;
  registroForm.hidden = false;
  mostrarLogin.classList.remove("active");
  mostrarRegistro.classList.add("active");
  registroMensaje.textContent = "";
}

async function crearCuentaCliente(event) {
  event.preventDefault();
  registroMensaje.textContent = "Creando cuenta...";

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: registroNombre.value.trim(),
        usuario: registroUsuario.value.trim(),
        password: registroPassword.value,
        telefono: registroTelefono.value.trim(),
      }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body.ok) {
      registroMensaje.textContent = body.errores?.join(" | ") || "No se pudo crear la cuenta.";
      return;
    }

    localStorage.setItem(LOGIN_TOKEN_KEY, body.token);
    sesionUsuario = body.usuario;
    window.location.href = "catalogo.html";
  } catch (error) {
    registroMensaje.textContent = "No fue posible conectar con el backend.";
  }
}

if (mostrarLogin) mostrarLogin.addEventListener("click", mostrarPestanaLogin);
if (mostrarRegistro) mostrarRegistro.addEventListener("click", mostrarPestanaRegistro);
if (registroForm) registroForm.addEventListener("submit", crearCuentaCliente);

// Cambios sugeridos
async function actualizarPedidosBadge() {
  if (!sesionUsuario || !["admin", "cajero"].includes(sesionUsuario.rol)) return;
  try {
    const response = await fetch(`${API_BASE}/pedidos`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return;
    const pedidos = await response.json();
    const nuevos = Array.isArray(pedidos) ? pedidos.length : 0;
    if (pedidosBadge) {
      pedidosBadge.textContent = String(nuevos);
      pedidosBadge.hidden = nuevos === 0;
    }
  } catch (error) {
    if (pedidosBadge) pedidosBadge.hidden = true;
  }
}

setInterval(() => {
  if (sesionUsuario && ["admin", "cajero"].includes(sesionUsuario.rol)) {
    actualizarPedidosBadge();
  }
}, 15000);
