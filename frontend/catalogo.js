const API_BASE = `http://${window.location.hostname}:5000/api`;
const TOKEN_KEY = "pdv_auth_token";
const CART_KEY = "pdv_cliente_carrito";

const catalogoProductos = document.getElementById("catalogoProductos");
const catalogoMensaje = document.getElementById("catalogoMensaje");
const buscadorCatalogo = document.getElementById("buscadorCatalogo");
const carritoCantidad = document.getElementById("carritoCantidad");
const clienteNombre = document.getElementById("clienteNombre");

let productos = [];
let carrito = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
}

function guardarCarrito() {
  localStorage.setItem(CART_KEY, JSON.stringify(carrito));
  actualizarContador();
}

function actualizarContador() {
  const cantidad = carrito.reduce((total, item) => total + Number(item.cantidad), 0);
  carritoCantidad.textContent = String(cantidad);
}

function renderCatalogo() {
  const query = buscadorCatalogo.value.trim().toLowerCase();
  const visibles = productos.filter((producto) =>
    producto.nombre.toLowerCase().includes(query) ||
    (producto.categoria_nombre || "").toLowerCase().includes(query)
  );

  catalogoProductos.innerHTML = "";
  if (!visibles.length) {
    catalogoProductos.innerHTML = '<p class="muted">No se encontraron productos.</p>';
    return;
  }

  visibles.forEach((producto) => {
    const itemEnCarrito = carrito.find((item) => item.id === producto.id);
    const cantidadCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
    const disponible = Number(producto.stock_actual) - cantidadCarrito;

    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-card__visual">
        <span>${String(producto.categoria_nombre || "Producto").charAt(0).toUpperCase()}</span>
      </div>
      <div class="product-card__body">
        <p class="product-category">${producto.categoria_nombre || "Producto"}</p>
        <h3>${producto.nombre}</h3>
        <p class="product-stock">Disponible: ${Math.max(0, disponible)}</p>
        <div class="product-card__footer">
          <strong>${formatMoney(producto.precio_venta)}</strong>
          <div class="product-buy">
            <input class="product-qty" type="number" min="1" max="${Math.max(1, disponible)}" value="1" data-id="${producto.id}" ${disponible <= 0 ? "disabled" : ""} />
            <button class="btn small" data-action="agregar" data-id="${producto.id}" ${disponible <= 0 ? "disabled" : ""}>Agregar</button>
          </div>
        </div>
      </div>
    `;
    catalogoProductos.appendChild(card);
  });
}

async function verificarSesionYCargar() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const respuestaSesion = await fetch(`${API_BASE}/auth/me`, {
      headers: { "X-Auth-Token": token },
    });
    const sesion = await respuestaSesion.json().catch(() => ({}));
    if (!respuestaSesion.ok || sesion.usuario?.rol !== "cliente") {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "index.html";
      return;
    }

    clienteNombre.textContent = `Bienvenido, ${sesion.usuario.nombre}`;

    const response = await fetch(`${API_BASE}/catalogo`, {
      cache: "no-store",
      headers: { "X-Auth-Token": token },
    });
    if (!response.ok) throw new Error("No se pudo cargar el catálogo");
    productos = await response.json();
    renderCatalogo();
    actualizarContador();
  } catch (error) {
    catalogoMensaje.textContent = error.message;
  }
}

catalogoProductos.addEventListener("click", (event) => {
  const boton = event.target.closest("button[data-action='agregar']");
  if (!boton) return;

  const id = Number(boton.dataset.id);
  const producto = productos.find((item) => item.id === id);
  const input = catalogoProductos.querySelector(`.product-qty[data-id="${id}"]`);
  const cantidad = Number(input?.value || 0);

  if (!producto || !Number.isInteger(cantidad) || cantidad <= 0) {
    catalogoMensaje.textContent = "Selecciona una cantidad válida.";
    return;
  }

  const existente = carrito.find((item) => item.id === id);
  const cantidadNueva = (existente?.cantidad || 0) + cantidad;
  if (cantidadNueva > Number(producto.stock_actual)) {
    catalogoMensaje.textContent = `Solo hay ${producto.stock_actual} unidad(es) disponibles.`;
    return;
  }

  if (existente) {
    existente.cantidad = cantidadNueva;
  } else {
    carrito.push({
      id,
      nombre: producto.nombre,
      precio: Number(producto.precio_venta),
      cantidad,
      stock: Number(producto.stock_actual),
    });
  }

  guardarCarrito();
  catalogoMensaje.textContent = `${producto.nombre} agregado al carrito.`;
  renderCatalogo();
});

buscadorCatalogo.addEventListener("input", renderCatalogo);
document.getElementById("abrirCarrito").addEventListener("click", () => {
  window.location.href = "carrito.html";
});
document.getElementById("cerrarSesionCliente").addEventListener("click", async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { "X-Auth-Token": token } }).catch(() => {});
  }
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "index.html";
});

verificarSesionYCargar();
