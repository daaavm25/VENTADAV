try:
    from .services.pos import POS
except ImportError:
    try:
        from services.pos import POS
    except ModuleNotFoundError:
        from backend.src.services.pos import POS


def imprimir_menu() -> None:
    print("\n=== Punto de Venta Abarrotera ===")
    print("1. Buscar producto por nombre")
    print("2. Agregar producto al carrito")
    print("3. Ver carrito")
    print("4. Ver total")
    print("5. Salir")


def main() -> None:
    pos = POS()

    while True:
        imprimir_menu()
        opcion = input("Elige una opcion: ").strip()

        if opcion == "1":
            termino = input("Nombre o parte del nombre del producto: ")
            encontrados = pos.buscar_productos(termino)
            if not encontrados:
                print("No se encontraron productos.")
                continue

            print("\nResultados:")
            for p in encontrados:
                print(f"- {p.nombre} | Precio: ${p.precio} | Stock: {p.stock}")

        elif opcion == "2":
            nombre = input("Nombre del producto: ")
            cantidad_str = input("Cantidad: ").strip()

            if not cantidad_str.isdigit():
                print("La cantidad debe ser un numero entero positivo.")
                continue

            cantidad = int(cantidad_str)
            try:
                item = pos.agregar_al_carrito(nombre, cantidad)
                print(
                    f"Agregado: {item['nombre']} x{item['cantidad']} -> ${item['subtotal']}"
                )
            except ValueError as err:
                print(f"Error: {err}")

        elif opcion == "3":
            carrito = pos.resumen_carrito()
            if not carrito:
                print("El carrito esta vacio.")
                continue

            print("\nCarrito:")
            for item in carrito:
                print(
                    f"- {item['nombre']} x{item['cantidad']} | "
                    f"${item['precio']} c/u | Subtotal: ${item['subtotal']}"
                )

        elif opcion == "4":
            print(f"Total actual: ${pos.total_compra()}")

        elif opcion == "5":
            print("Saliendo del punto de venta.")
            break

        else:
            print("Opcion no valida.")


if __name__ == "__main__":
    main()
