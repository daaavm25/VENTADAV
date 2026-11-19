const API_BASE = `http://${window.location.hostname}:5000/api`;
const STOCK_MINIMO_ALERTA = 5;

const formMovimiento = document.getElementById("formMovimiento");
const movProducto = document.getElementById("movProducto");
const movTipo = document.getElementById("movTipo");
const movCantidad = document.getElementById("movCantidad");
const movMotivo = document.getElementById("movMotivo");
const movMensaje = document.getElementById("movMensaje");
const inventarioBody = document.getElementById("inventarioBody");
const volverInicioBtn = document.getElementById("volverInicio");

let productos = [];

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(value || 0));
}

function renderProductoOptions() {
  movProducto.innerHTML = "";
  productos.forEach((producto) => {
    const option = document.createElement("option");
    option.value = String(producto.id);
    option.textContent = `${producto.nombre} (stock: ${Number(producto.stock_actual)})`;
    movProducto.appendChild(option);
  });
}

function renderTabla() {
  inventarioBody.innerHTML = "";

  productos.forEach((producto) => {
    const row = document.createElement("tr");
    if (Number(producto.stock_actual) <= STOCK_MINIMO_ALERTA) {
      row.classList.add("row--low");
    }

    row.innerHTML = `
      <td>${producto.nombre}</td>
      <td>${producto.categoria_nombre}</td>
      <td>${formatMoney(producto.precio_venta)}</td>
      <td>${Number(producto.stock_actual)}</td>
    `;

    inventarioBody.appendChild(row);
  });
}

async function cargarProductos() {
  const response = await fetch(`${API_BASE}/productos`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudieron cargar productos");
  }

  productos = await response.json();
  renderProductoOptions();
  renderTabla();
}

async function guardarMovimiento(event) {
  event.preventDefault();

  const payload = {
    producto_id: Number(movProducto.value),
    tipo: movTipo.value,
    cantidad: Number(movCantidad.value),
    motivo: movMotivo.value.trim() || "Ajuste manual"
  };

  if (!payload.producto_id || payload.cantidad <= 0) {
    movMensaje.textContent = "Selecciona producto y cantidad valida.";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/inventario/movimientos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      const errores = body.errores?.join(" | ") || "No se pudo guardar el movimiento.";
      throw new Error(errores);
    }

    movMensaje.textContent = `Movimiento guardado. Stock actual: ${Number(body.movimiento.stock_actual)}.`;
    formMovimiento.reset();
    await cargarProductos();
  } catch (error) {
    movMensaje.textContent = error.message || "Error al registrar movimiento.";
  }
}

formMovimiento.addEventListener("submit", guardarMovimiento);

if (volverInicioBtn) {
  volverInicioBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

cargarProductos().catch(() => {
  movMensaje.textContent = "No se pudo conectar con la API de inventario.";
});
