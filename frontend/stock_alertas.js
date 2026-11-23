const API_BASE = `http://${window.location.hostname}:5000/api`;
const STOCK_MINIMO_ALERTA = 5;

const alertaResumen = document.getElementById("alertaResumen");
const stockBody = document.getElementById("stockBody");
const volverInicioBtn = document.getElementById("volverInicio");

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(value || 0));
}

function renderTabla(productos) {
  stockBody.innerHTML = "";

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

    stockBody.appendChild(row);
  });
}

async function cargarStock() {
  const token = localStorage.getItem("pdv_auth_token");
  if (!token) {
    throw new Error("Inicia sesión desde el punto de venta para consultar stock.");
  }

  const response = await fetch(`${API_BASE}/productos`, {
    cache: "no-store",
    headers: { "X-Auth-Token": token }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.errores?.join(" | ") || "No se pudo consultar productos");
  }

  const productos = await response.json();
  const enRiesgo = productos.filter((producto) => Number(producto.stock_actual) <= STOCK_MINIMO_ALERTA);

  if (enRiesgo.length) {
    alertaResumen.textContent = `Hay ${enRiesgo.length} producto(s) en stock minimo (<= ${STOCK_MINIMO_ALERTA}).`;
  } else {
    alertaResumen.textContent = "No hay productos en stock minimo.";
  }

  renderTabla(productos);
}

if (volverInicioBtn) {
  volverInicioBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

cargarStock().catch(() => {
  alertaResumen.textContent = "No se pudo conectar con la API para consultar stock.";
});
