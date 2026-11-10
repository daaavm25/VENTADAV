# Que debe llevar un punto de venta (PDV)

## Modulos minimos

1. Catalogo de productos
2. Busqueda rapida por nombre o codigo
3. Carrito de compra
4. Calculo de subtotal, impuestos y total
5. Control de inventario
6. Corte de caja y reportes diarios
7. Usuarios y permisos (cajero, admin)

## Datos clave por producto

- Nombre
- Codigo (SKU o codigo de barras)
- Precio
- Existencia
- Categoria
- Estado (activo/inactivo)

## Flujo basico de venta

1. Buscar producto por nombre.
2. Seleccionar producto.
3. Capturar cantidad.
4. Agregar al carrito.
5. Repetir hasta terminar.
6. Mostrar total y confirmar cobro.
7. Descontar inventario.
8. Generar ticket.

## Recomendaciones tecnicas

- Validar que no se venda mas de la existencia.
- Registrar fecha, hora y usuario en cada venta.
- Guardar historico de ventas para reportes.
- Preparar integracion futura con lector de codigo y ticketera.
