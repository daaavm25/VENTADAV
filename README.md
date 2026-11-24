# Punto de Venta - Tienda Abarrotera

Estructura base para un sistema de punto de venta (PDV) con:

- Busqueda de productos por nombre.
- Agregado de productos al carrito.
- Calculo automatico del total de compra.
- Control basico de inventario.

## Estructura

- `backend/src/main.py`: interfaz de consola para operar el PDV.
- `backend/src/services/pos.py`: logica de negocio (inventario, carrito, total).
- `backend/src/data/productos.json`: catalogo inicial de productos.
- `docs/que_debe_tener_un_pdv.md`: guia de lo que debe llevar un PDV.
- `tests/test_pos.py`: pruebas basicas de comportamiento.
- `frontend/`: espacio reservado para futura interfaz web o caja.

## Como ejecutar

```bash
cd backend/src
python3 main.py
```

## Como correr pruebas

```bash
cd /home/david/Escritorio/VENTADAV
python3 -m unittest discover -s tests -p "test_*.py"
```

## Version web (HTML, CSS, JS)

Se agrego una interfaz web en `frontend/` con:

- Busqueda de productos por nombre.
- Agregado de productos al carrito.
- Calculo de subtotal, IVA y total.
- Finalizacion de compra con descuento de stock.
- Lista de lo que debe llevar un PDV.

Para abrirla en Linux:

```bash
cd /home/david/Escritorio/VENTADAV/frontend
xdg-open index.html
```

## Base de datos PostgreSQL

Se agrego el esquema SQL en:

- `backend/db/schema.sql`

Para ejecutarlo:

```bash
cd /home/david/Escritorio/VENTADAV
psql -U postgres -d nombre_de_tu_bd -f backend/db/schema.sql
```

Notas:

- Cambia `nombre_de_tu_bd` por tu base real.
- El script inserta datos base (categorias, metodos de pago, productos y configuracion).
- El usuario `admin` se crea con `password_hash = 'CAMBIAR_HASH'`, debes reemplazarlo por un hash real.

## API para guardar productos en BD

Se agrego una API en:

- `backend/src/api.py`

Instalar dependencias:

```bash
cd /home/david/Escritorio/VENTADAV/backend
python3 -m pip install -r requirements.txt
```

Configurar variables de conexion (ejemplo):

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=nombre_de_tu_bd
export DB_USER=postgres
export DB_PASSWORD=tu_password
```

Ejecutar API:

```bash
cd /home/david/Escritorio/VENTADAV/backend/src
python3 api.py
```

Con la API encendida, el apartado `Agregar producto` de `frontend/index.html` guarda en PostgreSQL.

## Pagos en línea con Mercado Pago

1. Instala las dependencias:

```bash
cd /home/david/Escritorio/VENTADAV
.venv/bin/python -m pip install -r backend/requirements.txt
```

2. Aplica la migración a una base existente:

```bash
psql -U postgres -d nombre_de_tu_bd -f backend/db/migration_mercado_pago.sql
```

Para una instalación nueva, el esquema `backend/db/schema.sql` ya incluye pagos pendientes y el método `mercado_pago`.

3. Configura credenciales de prueba o producción:

```bash
export MERCADO_PAGO_ACCESS_TOKEN='APP_USR-...'
export MERCADO_PAGO_WEBHOOK_SECRET='clave_si_configuras_notificaciones'
export MERCADO_PAGO_CURRENCY='MXN'
export FRONTEND_PUBLIC_URL='http://localhost:5500'
export PUBLIC_API_URL='https://tu-dominio-publico.example'
```

4. Sirve el frontend por HTTP:

```bash
cd /home/david/Escritorio/VENTADAV/frontend
python3 -m http.server 5500
```

5. Inicia la API y abre `http://localhost:5500/index.html`. El botón del carrito abrirá Checkout Pro. El pedido y el descuento de stock se crean únicamente después de que Mercado Pago confirme que el pago fue aprobado.

Para desarrollo local sin dominio público, usa un túnel HTTPS y registra la URL pública del webhook como `https://tu-dominio/api/pagos/webhook`. No uses Access Tokens ni tarjetas reales durante pruebas; utiliza las tarjetas y credenciales de prueba de Mercado Pago.
