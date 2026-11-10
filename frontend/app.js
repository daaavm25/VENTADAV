const API_BASE = `http://${window.location.hostname}:5000/api`;

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

const busquedaInput = document.getElementById("busqueda");
const sugerenciasEl = document.getElementById("sugerenciasProductos");
const limpiarBusquedaBtn = document.getElementById("limpiarBusqueda");
const estadoApiEl = document.getElementById("estadoApi");
const resultadosEl = document.getElementById("resultados");
const estadoBusquedaEl = document.getElementById("estadoBusqueda");
const formProducto = document.getElementById("formProducto");
const categoriaProductoSelect = document.getElementById("categoriaProducto");
const mensajeProductoEl = document.getElementById("mensajeProducto");
const carritoEl = document.getElementById("carrito");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const historialVentasEl = document.getElementById("historialVentas");
const vaciarCarritoBtn = document.getElementById("vaciarCarrito");
const finalizarCompraBtn = document.getElementById("finalizarCompra");
const mensajeEl = document.getElementById("mensaje");

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

async function cargarCategorias() {
  const response = await fetch(`${API_BASE}/categorias`);
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
  const response = await fetch(`${API_BASE}/productos`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar productos");
  }

  const rows = await response.json();
  productos.length = 0;
  productos.push(...rows.map(mapProductoApi));
  renderResultados();
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
    const response = await fetch(`${API_BASE}/ventas?scope=${scope}`);
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
      headers: {
        "Content-Type": "application/json"
      },
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
      headers: {
        "Content-Type": "application/json"
      },
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
  } catch (error) {
    mensajeProductoEl.textContent = "Error al guardar en base de datos. Verifica la API y credenciales PostgreSQL.";
  }
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

document.querySelectorAll("[data-historial-scope]").forEach((btn) => {
  btn.addEventListener("click", () => {
    cargarHistorialVentas(btn.dataset.historialScope);
  });
});

inicializarApi();
cargarHistorialVentas(historialScope);
renderCarrito();
