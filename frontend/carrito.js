const API_BASE = `http://${window.location.hostname}:5000/api`;
const TOKEN_KEY = "pdv_auth_token";
const CART_KEY = "pdv_cliente_carrito";

const carritoCliente = document.getElementById("carritoCliente");
const carritoSubtotal = document.getElementById("carritoSubtotal");
const carritoTotal = document.getElementById("carritoTotal");
const pedidoMensaje = document.getElementById("pedidoMensaje");

let carrito = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
}

function guardar() {
  localStorage.setItem(CART_KEY, JSON.stringify(carrito));
  render();
}

function render() {
  carritoCliente.innerHTML = "";
  if (!carrito.length) {
    carritoCliente.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
  } else {
    carrito.forEach((item) => {
      const row = document.createElement("article");
      row.className = "cart-item";
      row.innerHTML = `
        <div>
          <strong>${item.nombre}</strong>
          <p class="muted">${formatMoney(item.precio)} por unidad</p>
        </div>
        <div class="cart-item-controls">
          <input type="number" min="1" max="${item.stock || 99}" value="${item.cantidad}" data-id="${item.id}" />
          <strong>${formatMoney(item.precio * item.cantidad)}</strong>
          <button class="btn btn--danger small" type="button" data-remove="${item.id}">Quitar</button>
        </div>
      `;
      carritoCliente.appendChild(row);
    });
  }

  const subtotal = carrito.reduce((total, item) => total + item.precio * item.cantidad, 0);
  carritoSubtotal.textContent = formatMoney(subtotal);
  carritoTotal.textContent = formatMoney(subtotal);
}

carritoCliente.addEventListener("change", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const item = carrito.find((entry) => entry.id === Number(event.target.dataset.id));
  const cantidad = Number(event.target.value);
  if (!item || !Number.isInteger(cantidad) || cantidad <= 0) return;
  if (cantidad > item.stock) {
    pedidoMensaje.textContent = `Solo hay ${item.stock} unidad(es) disponibles.`;
    event.target.value = item.cantidad;
    return;
  }
  item.cantidad = cantidad;
  pedidoMensaje.textContent = "";
  guardar();
});

carritoCliente.addEventListener("click", (event) => {
  const boton = event.target.closest("button[data-remove]");
  if (!boton) return;
  carrito = carrito.filter((item) => item.id !== Number(boton.dataset.remove));
  guardar();
});

document.getElementById("volverCatalogo").addEventListener("click", () => {
  window.location.href = "catalogo.html";
});

document.getElementById("finalizarPedido").addEventListener("click", async () => {
  if (!carrito.length) {
    pedidoMensaje.textContent = "Tu carrito está vacío.";
    return;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  pedidoMensaje.textContent = "Registrando pedido...";
  try {
    const response = await fetch(`${API_BASE}/pedidos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
      },
      body: JSON.stringify({
        items: carrito.map((item) => ({ id: item.id, cantidad: item.cantidad })),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      pedidoMensaje.textContent = body.errores?.join(" | ") || "No se pudo registrar el pedido.";
      return;
    }

    carrito = [];
    localStorage.removeItem(CART_KEY);
    render();
    pedidoMensaje.textContent = `Pedido registrado: ${body.pedido.folio}`;
  } catch (error) {
    pedidoMensaje.textContent = "No fue posible conectar con la API.";
  }
});

render();
