const API_BASE = `http://${window.location.hostname}:5000/api`;
const TOKEN_KEY = "pdv_auth_token";

const pedidosBody = document.getElementById("pedidosBody");
const pedidosEstado = document.getElementById("pedidosEstado");
const pedidosContador = document.getElementById("pedidosContador");

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function cargarPedidos() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  pedidosEstado.textContent = "Cargando pedidos...";
  try {
    const response = await fetch(`${API_BASE}/pedidos`, {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      pedidosEstado.textContent = body.errores?.join(" | ") || "No se pudieron cargar los pedidos.";
      return;
    }

    const pedidos = Array.isArray(body) ? body : [];
    pedidosContador.textContent = String(pedidos.length);
    pedidosContador.hidden = pedidos.length === 0;
    pedidosEstado.textContent = pedidos.length
      ? `${pedidos.length} pedido(s) registrado(s).`
      : "No hay pedidos de clientes.";

    pedidosBody.innerHTML = "";
    pedidos.forEach((pedido) => {
      const productos = (pedido.productos || [])
        .map((item) => `${item.nombre} x${Number(item.cantidad)}`)
        .join(", ");

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${pedido.cliente_nombre || "Cliente"}</strong></td>
        <td>${pedido.cliente_telefono || "-"}</td>
        <td>${pedido.folio}</td>
        <td>${productos || "Sin detalle"}</td>
        <td><strong>${formatMoney(pedido.total)}</strong></td>
        <td>${formatDate(pedido.fecha_hora)}</td>
      `;
      pedidosBody.appendChild(row);
    });
  } catch (error) {
    pedidosEstado.textContent = "No se pudo conectar con la API de pedidos.";
  }
}

document.getElementById("volverCajaPedidos").addEventListener("click", () => {
  window.location.href = "index.html";
});
document.getElementById("actualizarPedidos").addEventListener("click", cargarPedidos);

cargarPedidos();
