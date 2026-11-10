import os
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List

from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import IntegrityError


app = Flask(__name__)


def filtrar_ventas_por_scope(ventas: List[Dict[str, Any]], scope: str = "hoy") -> List[Dict[str, Any]]:
    scope = str(scope or "hoy").lower()

    if scope == "all":
        return ventas

    fecha_base = datetime.now().date()
    if scope == "ayer":
        fecha_base = fecha_base - timedelta(days=1)

    filtradas = []
    for venta in ventas:
        fecha_hora = venta.get("fecha_hora")
        if not fecha_hora:
            continue

        try:
            fecha = datetime.fromisoformat(str(fecha_hora).replace("Z", "+00:00")).date()
        except ValueError:
            continue

        if fecha == fecha_base:
            filtradas.append(venta)

    return filtradas


def calcular_total_ventas(ventas: List[Dict[str, Any]]) -> float:
    total = 0.0
    for venta in ventas:
        total += float(venta.get("total", 0) or 0)
    return round(total, 2)


def get_db_conn():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "pos_abarrotera"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"ok": True})


@app.route("/api/categorias", methods=["GET", "OPTIONS"])
def listar_categorias():
    if request.method == "OPTIONS":
        return ("", 204)

    with get_db_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, nombre
                FROM categorias
                WHERE activa = TRUE
                ORDER BY nombre ASC
                """
            )
            rows = cur.fetchall()

    return jsonify(rows)


@app.route("/api/productos", methods=["GET", "POST", "OPTIONS"])
def productos_handler():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        return listar_productos()

    return crear_producto()


@app.route("/api/ventas", methods=["GET", "POST", "OPTIONS"])
def ventas_handler():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        return listar_ventas()

    return crear_venta()


def listar_productos():
    with get_db_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                  p.id,
                  p.codigo_barras,
                  p.sku,
                  p.nombre,
                  p.precio_venta,
                  p.stock_actual,
                  p.unidad_medida,
                  c.id AS categoria_id,
                  c.nombre AS categoria_nombre
                FROM productos p
                JOIN categorias c ON c.id = p.categoria_id
                WHERE p.activo = TRUE
                ORDER BY p.nombre ASC
                """
            )
            rows = cur.fetchall()

    return jsonify(rows)


def validar_payload(payload: Dict[str, Any]) -> List[str]:
    errores = []

    nombre = str(payload.get("nombre", "")).strip()
    if not nombre:
        errores.append("El nombre es obligatorio")

    try:
        categoria_id = int(payload.get("categoria_id"))
        if categoria_id <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        errores.append("categoria_id invalido")

    try:
        precio_venta = float(payload.get("precio_venta"))
        if precio_venta < 0:
            raise ValueError()
    except (TypeError, ValueError):
        errores.append("precio_venta invalido")

    try:
        stock_actual = float(payload.get("stock_actual"))
        if stock_actual < 0:
            raise ValueError()
    except (TypeError, ValueError):
        errores.append("stock_actual invalido")

    return errores


def crear_producto():
    payload = request.get_json(silent=True) or {}
    errores = validar_payload(payload)
    if errores:
        return jsonify({"ok": False, "errores": errores}), 400

    data = {
        "codigo_barras": (payload.get("codigo_barras") or None),
        "sku": (payload.get("sku") or None),
        "nombre": payload["nombre"].strip(),
        "categoria_id": int(payload["categoria_id"]),
        "precio_compra": float(payload.get("precio_compra", 0)),
        "precio_venta": float(payload["precio_venta"]),
        "stock_actual": float(payload["stock_actual"]),
        "stock_minimo": float(payload.get("stock_minimo", 0)),
        "unidad_medida": (payload.get("unidad_medida") or "pieza").strip(),
    }

    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO productos (
                      codigo_barras,
                      sku,
                      nombre,
                      categoria_id,
                      precio_compra,
                      precio_venta,
                      stock_actual,
                      stock_minimo,
                      unidad_medida
                    )
                    VALUES (%(codigo_barras)s, %(sku)s, %(nombre)s, %(categoria_id)s,
                            %(precio_compra)s, %(precio_venta)s, %(stock_actual)s,
                            %(stock_minimo)s, %(unidad_medida)s)
                    RETURNING id
                    """,
                    data,
                )
                inserted = cur.fetchone()
                producto_id = inserted["id"]

                cur.execute(
                    """
                    SELECT
                      p.id,
                      p.codigo_barras,
                      p.sku,
                      p.nombre,
                      p.precio_venta,
                      p.stock_actual,
                      p.unidad_medida,
                      c.id AS categoria_id,
                      c.nombre AS categoria_nombre
                    FROM productos p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE p.id = %s
                    """,
                    (producto_id,),
                )
                created = cur.fetchone()

        return jsonify({"ok": True, "producto": created}), 201
    except IntegrityError as exc:
        return jsonify({"ok": False, "errores": [f"Conflicto de datos: {exc.pgerror}"]}), 409
    except Exception as exc:
        return jsonify({"ok": False, "errores": [f"Error de servidor: {exc}"]}), 500


def listar_ventas():
    scope = str(request.args.get("scope", "hoy") or "hoy").lower()

    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if scope == "all":
                    cur.execute(
                        """
                        SELECT
                          v.id,
                          v.folio,
                          v.fecha_hora,
                          v.subtotal,
                          v.iva,
                          v.total,
                          u.nombre AS usuario_nombre,
                          c.nombre AS caja_nombre,
                          mp.nombre AS metodo_pago
                        FROM ventas v
                        LEFT JOIN usuarios u ON u.id = v.usuario_id
                        LEFT JOIN cajas c ON c.id = v.caja_id
                        LEFT JOIN metodos_pago mp ON mp.id = v.metodo_pago_id
                        ORDER BY v.fecha_hora DESC
                        """
                    )
                elif scope == "ayer":
                    cur.execute(
                        """
                        SELECT
                          v.id,
                          v.folio,
                          v.fecha_hora,
                          v.subtotal,
                          v.iva,
                          v.total,
                          u.nombre AS usuario_nombre,
                          c.nombre AS caja_nombre,
                          mp.nombre AS metodo_pago
                        FROM ventas v
                        LEFT JOIN usuarios u ON u.id = v.usuario_id
                        LEFT JOIN cajas c ON c.id = v.caja_id
                        LEFT JOIN metodos_pago mp ON mp.id = v.metodo_pago_id
                        WHERE v.fecha_hora >= date_trunc('day', now() - interval '1 day')
                          AND v.fecha_hora < date_trunc('day', now())
                        ORDER BY v.fecha_hora DESC
                        """
                    )
                else:
                    cur.execute(
                        """
                        SELECT
                          v.id,
                          v.folio,
                          v.fecha_hora,
                          v.subtotal,
                          v.iva,
                          v.total,
                          u.nombre AS usuario_nombre,
                          c.nombre AS caja_nombre,
                          mp.nombre AS metodo_pago
                        FROM ventas v
                        LEFT JOIN usuarios u ON u.id = v.usuario_id
                        LEFT JOIN cajas c ON c.id = v.caja_id
                        LEFT JOIN metodos_pago mp ON mp.id = v.metodo_pago_id
                        WHERE v.fecha_hora >= date_trunc('day', now())
                        ORDER BY v.fecha_hora DESC
                        """
                    )

                ventas = cur.fetchall()

                resultado = []
                for venta in ventas:
                    cur.execute(
                        """
                        SELECT
                          vd.cantidad,
                          vd.precio_unitario,
                          vd.total_linea,
                          p.nombre AS producto_nombre
                        FROM venta_detalle vd
                        JOIN productos p ON p.id = vd.producto_id
                        WHERE vd.venta_id = %s
                        ORDER BY p.nombre ASC
                        """,
                        (venta["id"],),
                    )
                    detalle = cur.fetchall()
                    venta["detalle"] = detalle
                    resultado.append(venta)

        ventas_filtradas = filtrar_ventas_por_scope(resultado, scope)
        return jsonify(ventas_filtradas)
    except Exception as exc:
        return jsonify({"ok": False, "errores": [f"Error al consultar ventas: {exc}"]}), 500


def crear_venta():
    payload = request.get_json(silent=True) or {}
    items = payload.get("items", [])

    if not isinstance(items, list) or not items:
        return jsonify({"ok": False, "errores": ["La venta debe incluir al menos un producto."]}), 400

    try:
        subtotal = Decimal(str(payload.get("subtotal", 0)))
        iva = Decimal(str(payload.get("iva", 0)))
        total = Decimal(str(payload.get("total", subtotal)))
        metodo_pago_id = int(payload.get("metodo_pago_id", 1))
    except (TypeError, ValueError, InvalidOperation):
        return jsonify({"ok": False, "errores": ["Datos de venta invalidos."]}), 400

    if subtotal < 0 or total < 0:
        return jsonify({"ok": False, "errores": ["El total no puede ser negativo."]}), 400

    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                valid_items = []
                for entry in items:
                    if not isinstance(entry, dict):
                        raise ValueError("Cada producto debe venir como un objeto valido.")

                    producto_id = int(entry.get("id"))
                    cantidad = Decimal(str(entry.get("cantidad", 0)))
                    precio_unitario = Decimal(str(entry.get("precio", 0)))

                    cur.execute(
                        "SELECT id, nombre, stock_actual FROM productos WHERE activo = TRUE AND id = %s",
                        (producto_id,),
                    )
                    producto = cur.fetchone()
                    if producto is None:
                        raise ValueError(f"Producto {producto_id} no encontrado.")

                    if cantidad <= 0:
                        raise ValueError(f"Cantidad invalida para {producto['nombre']}.")

                    if Decimal(str(producto["stock_actual"])) < cantidad:
                        raise ValueError(f"Stock insuficiente para {producto['nombre']}.")

                    valid_items.append({
                        "id": producto_id,
                        "cantidad": cantidad,
                        "precio": precio_unitario,
                        "nombre": producto["nombre"],
                    })

                folio = f"VTA-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                cur.execute(
                    """
                    INSERT INTO ventas (folio, usuario_id, caja_id, metodo_pago_id, subtotal, iva, total, estatus)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'pagada')
                    RETURNING id, folio, subtotal, iva, total
                    """,
                    (folio, 1, 1, metodo_pago_id, float(subtotal), float(iva), float(total)),
                )
                venta = cur.fetchone()

                for item in valid_items:
                    subtotal_linea = item["cantidad"] * item["precio"]
                    cur.execute(
                        """
                        INSERT INTO venta_detalle (
                          venta_id, producto_id, cantidad, precio_unitario,
                          descuento_linea, impuesto_linea, subtotal_linea, total_linea
                        )
                        VALUES (%s, %s, %s, %s, 0, 0, %s, %s)
                        """,
                        (
                            venta["id"],
                            item["id"],
                            float(item["cantidad"]),
                            float(item["precio"]),
                            float(subtotal_linea),
                            float(subtotal_linea),
                        ),
                    )

                    cur.execute(
                        "UPDATE productos SET stock_actual = stock_actual - %s, updated_at = NOW() WHERE id = %s",
                        (float(item["cantidad"]), item["id"]),
                    )

                conn.commit()
                return jsonify({"ok": True, "venta": venta}), 201
    except ValueError as exc:
        return jsonify({"ok": False, "errores": [str(exc)]}), 400
    except Exception as exc:
        return jsonify({"ok": False, "errores": [f"Error al guardar venta: {exc}"]}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
