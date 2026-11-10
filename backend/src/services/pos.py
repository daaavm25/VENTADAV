import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class Product:
    id: int
    nombre: str
    precio: float
    stock: int
    categoria: str


class POS:
    def __init__(self, productos_path: Optional[str] = None) -> None:
        if productos_path is None:
            base_dir = Path(__file__).resolve().parent.parent
            productos_path = str(base_dir / "data" / "productos.json")

        self.productos_path = Path(productos_path)
        self.productos: List[Product] = self._cargar_productos()
        self.carrito: List[Dict] = []

    def _cargar_productos(self) -> List[Product]:
        with self.productos_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return [Product(**item) for item in data]

    def buscar_productos(self, texto: str) -> List[Product]:
        texto = texto.strip().lower()
        if not texto:
            return []
        return [p for p in self.productos if texto in p.nombre.lower()]

    def obtener_producto_por_nombre(self, nombre: str) -> Optional[Product]:
        nombre = nombre.strip().lower()
        for producto in self.productos:
            if producto.nombre.lower() == nombre:
                return producto

        # Si no hay match exacto, toma el primer match parcial.
        candidatos = self.buscar_productos(nombre)
        return candidatos[0] if candidatos else None

    def agregar_al_carrito(self, nombre_producto: str, cantidad: int) -> Dict:
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")

        producto = self.obtener_producto_por_nombre(nombre_producto)
        if not producto:
            raise ValueError("Producto no encontrado")

        if cantidad > producto.stock:
            raise ValueError("Stock insuficiente")

        subtotal = round(cantidad * producto.precio, 2)
        producto.stock -= cantidad

        item = {
            "id": producto.id,
            "nombre": producto.nombre,
            "precio": producto.precio,
            "cantidad": cantidad,
            "subtotal": subtotal,
        }
        self.carrito.append(item)
        return item

    def total_compra(self) -> float:
        total = sum(item["subtotal"] for item in self.carrito)
        return round(total, 2)

    def resumen_carrito(self) -> List[Dict]:
        return self.carrito
