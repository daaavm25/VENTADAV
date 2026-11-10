-- Esquema PostgreSQL para Punto de Venta Abarrotera
-- Fecha: 2026-03-24

BEGIN;

-- Limpieza opcional para reinstalacion local
DROP TABLE IF EXISTS compra_detalle CASCADE;
DROP TABLE IF EXISTS compras CASCADE;
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS movimientos_caja CASCADE;
DROP TABLE IF EXISTS venta_detalle CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS metodos_pago CASCADE;
DROP TABLE IF EXISTS cajas CASCADE;
DROP TABLE IF EXISTS sucursales CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS configuracion CASCADE;

CREATE TABLE categorias (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  usuario VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol VARCHAR(30) NOT NULL CHECK (rol IN ('admin', 'cajero', 'supervisor')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sucursales (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(140) NOT NULL,
  direccion TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cajas (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  sucursal_id BIGINT REFERENCES sucursales(id),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  telefono VARCHAR(40),
  email VARCHAR(140),
  rfc VARCHAR(20),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE metodos_pago (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE proveedores (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  telefono VARCHAR(40),
  email VARCHAR(140),
  contacto VARCHAR(120),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE productos (
  id BIGSERIAL PRIMARY KEY,
  codigo_barras VARCHAR(80) UNIQUE,
  sku VARCHAR(80) UNIQUE,
  nombre VARCHAR(180) NOT NULL,
  descripcion TEXT,
  categoria_id BIGINT NOT NULL REFERENCES categorias(id),
  precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_compra >= 0),
  precio_venta NUMERIC(12,2) NOT NULL CHECK (precio_venta >= 0),
  stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  unidad_medida VARCHAR(20) NOT NULL DEFAULT 'pieza',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ventas (
  id BIGSERIAL PRIMARY KEY,
  folio VARCHAR(60) NOT NULL UNIQUE,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  caja_id BIGINT NOT NULL REFERENCES cajas(id),
  cliente_id BIGINT REFERENCES clientes(id),
  metodo_pago_id BIGINT REFERENCES metodos_pago(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  iva NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estatus VARCHAR(20) NOT NULL DEFAULT 'pagada' CHECK (estatus IN ('pagada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venta_detalle (
  id BIGSERIAL PRIMARY KEY,
  venta_id BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  descuento_linea NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento_linea >= 0),
  impuesto_linea NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (impuesto_linea >= 0),
  subtotal_linea NUMERIC(12,2) NOT NULL CHECK (subtotal_linea >= 0),
  total_linea NUMERIC(12,2) NOT NULL CHECK (total_linea >= 0)
);

CREATE TABLE movimientos_caja (
  id BIGSERIAL PRIMARY KEY,
  caja_id BIGINT NOT NULL REFERENCES cajas(id),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('apertura', 'ingreso', 'retiro', 'cierre')),
  monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  referencia VARCHAR(120),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE movimientos_inventario (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  motivo VARCHAR(120) NOT NULL,
  referencia_tabla VARCHAR(40),
  referencia_id BIGINT,
  usuario_id BIGINT REFERENCES usuarios(id),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE compras (
  id BIGSERIAL PRIMARY KEY,
  folio VARCHAR(60) NOT NULL UNIQUE,
  proveedor_id BIGINT NOT NULL REFERENCES proveedores(id),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  iva NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estatus VARCHAR(20) NOT NULL DEFAULT 'recibida' CHECK (estatus IN ('recibida', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE compra_detalle (
  id BIGSERIAL PRIMARY KEY,
  compra_id BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(12,2) NOT NULL CHECK (costo_unitario >= 0),
  subtotal_linea NUMERIC(12,2) NOT NULL CHECK (subtotal_linea >= 0),
  total_linea NUMERIC(12,2) NOT NULL CHECK (total_linea >= 0)
);

CREATE TABLE configuracion (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(80) NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices de rendimiento
CREATE INDEX idx_productos_nombre ON productos (nombre);
CREATE INDEX idx_ventas_fecha_hora ON ventas (fecha_hora);
CREATE INDEX idx_venta_detalle_venta_id ON venta_detalle (venta_id);
CREATE INDEX idx_mov_inv_producto_fecha ON movimientos_inventario (producto_id, fecha_hora);
CREATE INDEX idx_mov_caja_caja_fecha ON movimientos_caja (caja_id, fecha_hora);

-- Datos base
INSERT INTO categorias (nombre) VALUES
('Granos y cereales'),
('Lacteos'),
('Abarrotes'),
('Bebidas'),
('Frutas y verduras'),
('Limpieza'),
('Panadería');

INSERT INTO metodos_pago (nombre) VALUES
('efectivo'),
('tarjeta'),
('transferencia');

INSERT INTO sucursales (nombre, direccion) VALUES
('Sucursal Centro', 'Zona Centro');

INSERT INTO cajas (nombre, sucursal_id) VALUES
('Caja 1', 1);

INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES
('Administrador', 'admin', 'CAMBIAR_HASH', 'admin');

INSERT INTO productos (codigo_barras, sku, nombre, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida)
VALUES
('750000000001', 'ARR-1KG', 'Arroz 1kg', 1, 22.00, 28.50, 45, 10, 'pieza'),
('750000000002', 'FRI-1KG', 'Frijol 1kg', 1, 29.00, 36.00, 32, 8, 'pieza'),
('750000000003', 'ACE-500', 'Aceite de girasol 500ml', 3, 38.00, 49.90, 26, 8, 'pieza'),
('750000000004', 'LEC-1L', 'Leche 1L', 2, 18.00, 24.00, 50, 12, 'pieza'),
('750000000005', 'YOG-900', 'Yogur natural 900g', 2, 54.00, 68.00, 22, 6, 'pieza'),
('750000000006', 'HUE-18', 'Huevo 18 pzas', 3, 50.00, 62.00, 20, 6, 'pieza'),
('750000000007', 'AZU-1KG', 'Azucar 1kg', 1, 24.00, 31.00, 40, 10, 'pieza'),
('750000000008', 'PAN-BL', 'Pan blanco 680g', 7, 30.00, 39.00, 18, 5, 'pieza'),
('750000000009', 'CAF-100G', 'Cafe soluble 100g', 4, 70.00, 89.00, 18, 5, 'pieza'),
('750000000010', 'REF-600', 'Refresco 600ml', 4, 15.00, 23.00, 42, 12, 'pieza'),
('750000000011', 'MAN-1KG', 'Manzana 1kg', 5, 26.00, 35.50, 30, 8, 'pieza'),
('750000000012', 'JAB-900', 'Jabón de tocador 900ml', 6, 33.00, 45.00, 24, 7, 'pieza'),
('750000000013', 'TOL-4R', 'Toalla de papel 4 rollos', 6, 42.00, 56.00, 16, 5, 'pieza'),
('750000000014', 'TOM-1KG', 'Tomate 1kg', 5, 28.00, 37.00, 27, 7, 'pieza'),
('750000000015', 'FRE-1KG', 'Fresa 1kg', 5, 48.00, 64.00, 14, 4, 'pieza'),
('750000000016', 'TOR-500', 'Tortillas de maíz 500g', 7, 26.00, 32.00, 19, 6, 'pieza');

INSERT INTO ventas (folio, usuario_id, caja_id, metodo_pago_id, subtotal, iva, total, estatus)
VALUES
('VTA-20261102-001', 1, 1, 1, 124.50, 19.92, 144.42, 'pagada'),
('VTA-20261102-002', 1, 1, 2, 220.00, 35.20, 255.20, 'pagada');

INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, descuento_linea, impuesto_linea, subtotal_linea, total_linea)
VALUES
(1, 1, 2, 28.50, 0, 9.12, 57.00, 66.12),
(1, 3, 1, 24.00, 0, 3.84, 24.00, 27.84),
(2, 9, 1, 89.00, 0, 14.24, 89.00, 103.24),
(2, 13, 2, 56.00, 0, 17.92, 112.00, 129.92);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
('iva_porcentaje', '16', 'IVA general del sistema'),
('prefijo_folio_venta', 'VTA', 'Prefijo para folios de venta'),
('prefijo_folio_compra', 'CMP', 'Prefijo para folios de compra');

COMMIT;
