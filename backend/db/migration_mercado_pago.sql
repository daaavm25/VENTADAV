BEGIN;

INSERT INTO metodos_pago (nombre, activo)
VALUES ('mercado_pago', TRUE)
ON CONFLICT (nombre) DO UPDATE SET activo = TRUE;

CREATE TABLE IF NOT EXISTS pagos_pendientes (
  id BIGSERIAL PRIMARY KEY,
  external_reference VARCHAR(80) NOT NULL UNIQUE,
  preference_id VARCHAR(80),
  payment_id VARCHAR(80),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  cliente_id BIGINT REFERENCES clientes(id),
  items JSONB NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  estatus VARCHAR(20) NOT NULL DEFAULT 'pending',
  venta_id BIGINT UNIQUE REFERENCES ventas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_pendientes_usuario
  ON pagos_pendientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pendientes_estatus
  ON pagos_pendientes(estatus);

COMMIT;
