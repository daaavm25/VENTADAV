import getpass
import os
import psycopg2
from werkzeug.security import generate_password_hash

conn = psycopg2.connect(
    dbname="pos_abarrotera",
    user="postgres",
    password=os.getenv("PGPASSWORD", "DVDVAN2706"),
    host="localhost",
    port="5432",
)

print("Crear credenciales de usuarios")
usuarios = [
    ("Administrador", "admin", "admin"),
    ("Cajero", "cajero", "cajero"),
]

with conn:
    with conn.cursor() as cur:
        for nombre, usuario, rol in usuarios:
            password = getpass.getpass(f"Contraseña para '{usuario}': ")
            if len(password) < 6:
                raise ValueError(f"La contraseña de {usuario} debe tener al menos 6 caracteres.")
            cur.execute(
                """
                INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (usuario)
                DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    password_hash = EXCLUDED.password_hash,
                    rol = EXCLUDED.rol,
                    activo = TRUE
                """,
                (nombre, usuario, generate_password_hash(password), rol),
            )

print("Usuarios admin y cajero configurados correctamente.")
conn.close()
