import importlib
import unittest
from datetime import date, timedelta
from pathlib import Path

from backend.src.api import calcular_total_ventas, filtrar_ventas_por_scope
from backend.src.services.pos import POS


class TestPOS(unittest.TestCase):
    def setUp(self) -> None:
        productos = Path("/home/david/Escritorio/VENTADAV/backend/src/data/productos.json")
        self.pos = POS(str(productos))

    def test_busqueda_por_nombre(self) -> None:
        resultados = self.pos.buscar_productos("arroz")
        self.assertTrue(any(p.nombre == "Arroz 1kg" for p in resultados))

    def test_agregar_producto_y_total(self) -> None:
        item = self.pos.agregar_al_carrito("Leche 1L", 2)
        self.assertEqual(item["subtotal"], 48.0)
        self.assertEqual(self.pos.total_compra(), 48.0)

    def test_stock_insuficiente(self) -> None:
        with self.assertRaises(ValueError):
            self.pos.agregar_al_carrito("Cafe soluble 100g", 100)

    def test_historial_total_y_por_dia(self) -> None:
        hoy = date.today()
        ayer = hoy - timedelta(days=1)

        ventas = [
            {"fecha_hora": f"{hoy.isoformat()}T10:00:00", "total": 150.0},
            {"fecha_hora": f"{hoy.isoformat()}T12:30:00", "total": 50.0},
            {"fecha_hora": f"{ayer.isoformat()}T09:00:00", "total": 75.0},
        ]

        self.assertEqual(calcular_total_ventas(ventas), 275.0)
        self.assertEqual(calcular_total_ventas(filtrar_ventas_por_scope(ventas, "hoy")), 200.0)
        self.assertEqual(calcular_total_ventas(filtrar_ventas_por_scope(ventas, "ayer")), 75.0)
        self.assertEqual(calcular_total_ventas(filtrar_ventas_por_scope(ventas, "all")), 275.0)

    def test_main_se_importa_desde_la_raiz_del_proyecto(self) -> None:
        modulo = importlib.import_module("backend.src.main")
        self.assertTrue(hasattr(modulo, "POS"))


if __name__ == "__main__":
    unittest.main()
