import os
import secrets
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import IntegrityError


app = Flask(__name__)

sesiones_activas: Dict[str, Dict[str, Any]] = {}


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
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Auth-Token"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"ok": True})


@app.route("/api/categorias", methods=["GET", "OPTIONS"])
def listar_categorias():
    if request.method == "OPTIONS":
        return ("", 204)

    denegado = requiere_roles("admin", "cajero")
    if denegado:
        return denegado

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

    denegado = requiere_roles("admin", "cajero")
    if denegado:
        return denegado

    if request.method == "GET":
        return listar_productos()

    if usuario_autenticado()["rol"] != "admin":
        return jsonify({"ok": False, "errores": ["Solo el administrador puede crear productos."]}), 403
    return crear_producto()


@app.route("/api/ventas", methods=["GET", "POST", "OPTIONS"])
def ventas_handler():
    if request.method == "OPTIONS":
        return ("", 204)

    denegado = requiere_roles("admin", "cajero")
    if denegado:
        return denegado

    if request.method == "GET":
        return listar_ventas()

    return crear_venta()


@app.route("/api/inventario/movimientos", methods=["POST", "OPTIONS"])
def registrar_movimiento_inventario():
    if request.method == "OPTIONS":
        return ("", 204)

    denegado = requiere_roles("admin")
    if denegado:
        return denegado

    payload = request.get_json(silent=True) or {}

    try:
        producto_id = int(payload.get("producto_id"))
        tipo = str(payload.get("tipo", "")).strip().lower()
        cantidad = Decimal(str(payload.get("cantidad", 0)))
        motivo = str(payload.get("motivo", "")).strip() or "Ajuste manual"
    except (TypeError, ValueError, InvalidOperation):
        return jsonify({"ok": False, "errores": ["Datos de movimiento invalidos."]}), 400

    if tipo not in {"entrada", "salida"}:
        return jsonify({"ok": False, "errores": ["El tipo debe ser entrada o salida."]}), 400

    if cantidad <= 0:
        return jsonify({"ok": False, "errores": ["La cantidad debe ser mayor a 0."]}), 400

    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, nombre, stock_actual
                    FROM productos
                    WHERE id = %s AND activo = TRUE
                    FOR UPDATE
                    """,
                    (producto_id,),
                )
                producto = cur.fetchone()

                if producto is None:
                    return jsonify({"ok": False, "errores": ["Producto no encontrado."]}), 404

                stock_actual = Decimal(str(producto["stock_actual"]))
                if tipo == "salida" and stock_actual < cantidad:
                    return jsonify({"ok": False, "errores": ["Stock insuficiente para salida."]}), 400

                signo = Decimal("1") if tipo == "entrada" else Decimal("-1")
                nuevo_stock = stock_actual + (cantidad * signo)

                cur.execute(
                    """
                    UPDATE productos
                    SET stock_actual = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (float(nuevo_stock), producto_id),
                )

                cur.execute(
                    """
                    INSERT INTO movimientos_inventario (
                      producto_id, tipo, cantidad, motivo, referencia_tabla, referencia_id, usuario_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (producto_id, tipo, float(cantidad), motivo, "manual", None, 1),
                )

                conn.commit()

        return jsonify(
            {
                "ok": True,
                "movimiento": {
                    "producto_id": producto_id,
                    "tipo": tipo,
                    "cantidad": float(cantidad),
                    "motivo": motivo,
                    "stock_actual": float(nuevo_stock),
                },
            }
        )
    except Exception as exc:
        return jsonify({"ok": False, "errores": [f"Error al registrar movimiento: {exc}"]}), 500


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


def usuario_autenticado():
    token = request.headers.get("X-Auth-Token", "")
    return sesiones_activas.get(token)


def requiere_roles(*roles):
    usuario = usuario_autenticado()
    if usuario is None:
        return jsonify({"ok": False, "errores": ["Sesión no válida. Inicia sesión nuevamente."]}), 401
    if usuario["rol"] not in roles:
        return jsonify({"ok": False, "errores": ["No tienes permisos para realizar esta acción."]}), 403
    return None


@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    usuario = str(payload.get("usuario", "")).strip()
    password = str(payload.get("password", ""))
    if not usuario or not password:
        return jsonify({"ok": False, "errores": ["Usuario y contraseña son obligatorios."]}), 400

    with get_db_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, nombre, usuario, password_hash, telefono, rol, activo FROM usuarios WHERE usuario = %s",
                (usuario,),
            )
            fila = cur.fetchone()

    if fila is None or not fila["activo"]:
        return jsonify({"ok": False, "errores": ["Credenciales incorrectas."]}), 401

    if not check_password_hash(fila["password_hash"], password):
        return jsonify({"ok": False, "errores": ["Credenciales incorrectas."]}), 401

    cliente_id = None
    if fila["rol"] == "cliente":
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM clientes WHERE usuario_id = %s", (fila["id"],))
                cliente = cur.fetchone()
                if cliente:
                    cliente_id = cliente["id"]

    token = secrets.token_urlsafe(32)
    sesiones_activas[token] = {
        "id": fila["id"],
        "nombre": fila["nombre"],
        "usuario": fila["usuario"],
        "rol": fila["rol"],
        "telefono": fila.get("telefono"),
        "cliente_id": cliente_id,
    }

    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE usuarios SET ultimo_login = NOW() WHERE id = %s", (fila["id"],))
        conn.commit()

    return jsonify({"ok": True, "token": token, "usuario": sesiones_activas[token]}), 200


@app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return ("", 204)
    token = request.headers.get("X-Auth-Token", "")
    sesiones_activas.pop(token, None)
    return jsonify({"ok": True}), 200


@app.route("/api/auth/me", methods=["GET"])
def usuario_actual():
    usuario = usuario_autenticado()
    if usuario is None:
        return jsonify({"ok": False, "errores": ["Sesión no válida."]}), 401
    return jsonify({"ok": True, "usuario": usuario}), 200


@app.route("/api/auth/register", methods=["POST", "OPTIONS"])
def registrar_cliente():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    nombre = str(payload.get("nombre", "")).strip()
    usuario = str(payload.get("usuario", "")).strip().lower()
    password = str(payload.get("password", ""))
    telefono = str(payload.get("telefono", "")).strip()

    if not nombre or not usuario or not password or not telefono:
        return jsonify({"ok": False, "errores": ["Nombre de usuario, contraseña y número son obligatorios."]}), 400
    if len(usuario) < 3:
        return jsonify({"ok": False, "errores": ["El nombre de usuario debe tener al menos 3 caracteres."]}), 400
    if len(password) < 6:
        return jsonify({"ok": False, "errores": ["La contraseña debe tener al menos 6 caracteres."]}), 400

    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM usuarios WHERE usuario = %s", (usuario,))
                if cur.fetchone():
                    return jsonify({"ok": False, "errores": ["Ese nombre de usuario ya existe."]}), 409

                cur.execute(
                    """
                    INSERT INTO usuarios (nombre, usuario, password_hash, telefono, rol, activo)
                    VALUES (%s, %s, %s, %s, 'cliente', TRUE)
                    RETURNING id
                    """,
                    (nombre, usuario, generate_password_hash(password), telefono),
                )
                usuario_id = cur.fetchone()["id"]

                cur.execute(
                    """
                    INSERT INTO clientes (nombre, telefono, activo, usuario_id)
                    VALUES (%s, %s, TRUE, %s)
                    RETURNING id
                    """,
                    (nombre, telefono, usuario_id),
                )
                cliente_id = cur.fetchone()["id"]
                conn.commit()

        token = secrets.token_urlsafe(32)
        sesiones_activas[token] = {
            "id": usuario_id,
            "nombre": nombre,
            "usuario": usuario,
            "rol": "cliente",
            "cliente_id": cliente_id,
        }
        return jsonify({"ok": True, "token": token, "usuario": sesiones_activas[token]}), 201
    except Exception as exc:
        return jsonify({"ok": False, "errores": [f"No se pudo crear la cuenta: {exc}"]}), 500


@app.route("/api/catalogo", methods=["GET", "OPTIONS"])
def catalogo_cliente():
    if request.method == "OPTIONS":
        return ("", 204)

    denegado = requiere_roles("cliente", "admin", "cajero")
    if denegado:
        return denegado

    with get_db_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT p.id, p.nombre, p.descripcion, p.precio_venta,
                       p.stock_actual, p.unidad_medida,
                       c.nombre AS categoria_nombre
                FROM productos p
                JOIN categorias c ON c.id = p.categoria_id
                WHERE p.activo = TRUE AND p.stock_actual > 0
                ORDER BY p.nombre ASC
                """
            )
            productos = cur.fetchall()
    return jsonify(productos)


@app.route("/api/pedidos", methods=["GET", "POST", "OPTIONS"])
def pedidos_cliente():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        denegado = requiere_roles("admin", "cajero")
        if denegado:
            return denegado

        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT v.id, v.folio, v.fecha_hora, v.subtotal, v.iva,
                           v.total, v.estatus,
                           COALESCE(cl.nombre, u.nombre) AS cliente_nombre,
                           COALESCE(cl.telefono, u.telefono) AS cliente_telefono
                    FROM ventas v
                    JOIN usuarios u ON u.id = v.usuario_id
                    LEFT JOIN clientes cl ON cl.id = v.cliente_id
                    WHERE v.folio LIKE 'PED-%'
                    ORDER BY v.fecha_hora DESC
                    """
                )
                pedidos = cur.fetchall()

                resultado = []
                for pedido in pedidos:
                    cur.execute(
                        """
                        SELECT p.nombre, vd.cantidad, vd.precio_unitario,
                               vd.total_linea
                        FROM venta_detalle vd
                        JOIN productos p ON p.id = vd.producto_id
                        WHERE vd.venta_id = %s
                        ORDER BY p.nombre ASC
                        """,
                        (pedido["id"],),
                    )
                    pedido["productos"] = cur.fetchall()
                    resultado.append(pedido)

        return jsonify(resultado)

    denegado = requiere_roles("cliente")
    if denegado:
        return denegado

    usuario = usuario_autenticado()
    items = (request.get_json(silent=True) or {}).get("items", [])
    if not isinstance(items, list) or not items:
        return jsonify({"ok": False, "errores": ["El pedido debe incluir productos."]}), 400

    try:
        subtotal = Decimal("0")
        detalles_validos = []

        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                for entry in items:
                    producto_id = int(entry.get("id"))
                    cantidad = Decimal(str(entry.get("cantidad", 0)))
                    if cantidad <= 0:
                        raise ValueError("La cantidad debe ser mayor a cero.")

                    cur.execute(
                        "SELECT id, nombre, precio_venta, stock_actual FROM productos WHERE id = %s AND activo = TRUE FOR UPDATE",
                        (producto_id,),
                    )
                    producto = cur.fetchone()
                    if not producto:
                        raise ValueError("Producto no encontrado.")
                    if Decimal(str(producto["stock_actual"])) < cantidad:
                        raise ValueError(f"Stock insuficiente para {producto['nombre']}.")

                    precio = Decimal(str(producto["precio_venta"]))
                    subtotal += precio * cantidad
                    detalles_validos.append((producto_id, cantidad, precio))

                iva = Decimal("0")
                total = subtotal
                folio = f"PED-{datetime.now().strftime('%Y%m%d%H%M%S')}-{usuario['id']}"

                cur.execute(
                    """
                    INSERT INTO ventas (
                      folio, usuario_id, caja_id, cliente_id, metodo_pago_id,
                      subtotal, iva, total, estatus
                    )
                    VALUES (%s, %s, 1, %s, 1, %s, %s, %s, 'pagada')
                    RETURNING id, folio, subtotal, iva, total
                    """,
                    (folio, usuario["id"], usuario.get("cliente_id"), float(subtotal), float(iva), float(total)),
                )
                venta = cur.fetchone()

                for producto_id, cantidad, precio in detalles_validos:
                    subtotal_linea = cantidad * precio
                    cur.execute(
                        """
                        INSERT INTO venta_detalle (
                          venta_id, producto_id, cantidad, precio_unitario,
                          descuento_linea, impuesto_linea, subtotal_linea, total_linea
                        )
                        VALUES (%s, %s, %s, %s, 0, 0, %s, %s)
                        """,
                        (venta["id"], producto_id, float(cantidad), float(precio), float(subtotal_linea), float(subtotal_linea)),
                    )
                    cur.execute(
                        "UPDATE productos SET stock_actual = stock_actual - %s, updated_at = NOW() WHERE id = %s",
                        (float(cantidad), producto_id),
                    )

                conn.commit()

        return jsonify({"ok": True, "pedido": venta}), 201
    except ValueError as exc:
        return jsonify({"ok": False, "errores": [str(exc)]}), 400
    except Exception as exc:
        return jsonify({"ok": False, "errores": [f"Error al crear pedido: {exc}"]}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
