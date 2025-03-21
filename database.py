import psycopg2
from psycopg2 import sql
import time
import os

# Récupérer les informations de connexion depuis les variables d'environnement
DATABASE_URL = os.getenv('DATABASE_URL')  # Exemple : "postgresql://user:password@host:port/database"

def connect_db():
    return psycopg2.connect(DATABASE_URL)

def create_tables():
    conn = connect_db()
    cursor = conn.cursor()

    # Table shops avec description
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shops (
            shop_id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT ''
        )
    """)

    # Table items avec description et stock
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS items (
            item_id SERIAL PRIMARY KEY,
            shop_id INTEGER REFERENCES shops(shop_id),
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT DEFAULT '',
            stock INTEGER DEFAULT -1,
            active INTEGER DEFAULT 1
        )
    """)

    # Table utilisateurs (balance)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id BIGINT PRIMARY KEY,
            balance INTEGER DEFAULT 0
        )
    """)

    # Inventaire avec quantité
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_items (
            user_id BIGINT REFERENCES users(user_id),
            shop_id INTEGER REFERENCES shops(shop_id),
            item_id INTEGER REFERENCES items(item_id),
            quantity INTEGER DEFAULT 1,
            PRIMARY KEY (user_id, shop_id, item_id)
        )
    """)

    # Dépôts bancaires
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bank_deposit (
            user_id BIGINT PRIMARY KEY REFERENCES users(user_id),
            amount INTEGER DEFAULT 0
        )
    """)

    # Salaires des rôles
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS role_salaries (
            role_id BIGINT PRIMARY KEY,
            salary INTEGER,
            cooldown INTEGER DEFAULT 3600
        )
    """)

    # Cooldown salaires utilisateurs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salary_cooldowns (
            user_id BIGINT PRIMARY KEY REFERENCES users(user_id),
            last_collect TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

# Gestion shops et items
def get_shops():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT shop_id, name, description FROM shops")
    result = cursor.fetchall()
    conn.close()
    return result

def create_shop(name, description=""):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO shops (name, description) VALUES (%s, %s) RETURNING shop_id", (name, description))
    shop_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()
    return shop_id

def delete_shop(shop_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM shops WHERE shop_id = %s", (shop_id,))
    cursor.execute("DELETE FROM items WHERE shop_id = %s", (shop_id,))
    conn.commit()
    conn.close()

def add_item_to_shop(shop_id, name, price, description="", stock=-1):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO items (shop_id, name, price, description, stock, active)
        VALUES (%s, %s, %s, %s, %s, 1)
        RETURNING item_id
    """, (shop_id, name, price, description, stock))
    item_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()
    return item_id

def remove_item(item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE items SET active = 0 WHERE item_id = %s", (item_id,))
    conn.commit()
    conn.close()

def get_shop_items(shop_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price, description, stock FROM items WHERE shop_id = %s AND active = 1", (shop_id,))
    result = cursor.fetchall()
    conn.close()
    return result

def get_shop_item(shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price, description, stock FROM items WHERE shop_id = %s AND item_id = %s AND active = 1", (shop_id, item_id))
    result = cursor.fetchone()
    conn.close()
    return result

def decrement_item_stock(shop_id, item_id, quantity):
    """
    Décrémente le stock d'un item de la quantité spécifiée.
    :param shop_id: ID du shop
    :param item_id: ID de l'item
    :param quantity: Quantité à décrémenter
    """
    try:
        conn = connect_db()
        cursor = conn.cursor()
        
        # Vérifier le stock actuel avant la décrémentation
        cursor.execute("SELECT stock FROM items WHERE shop_id = %s AND item_id = %s", (shop_id, item_id))
        current_stock = cursor.fetchone()
        
        if current_stock:
            print(f"Stock actuel pour shop_id={shop_id}, item_id={item_id} : {current_stock[0]}")  # Log
            if current_stock[0] >= quantity:  # Vérifier si le stock est suffisant
                cursor.execute("""
                    UPDATE items
                    SET stock = stock - %s
                    WHERE shop_id = %s AND item_id = %s AND stock >= %s
                """, (quantity, shop_id, item_id, quantity))
                conn.commit()
                print(f"Stock décrémenté de {quantity} avec succès")  # Log
            else:
                print("Stock insuffisant, aucune décrémentation effectuée.")  # Log
        else:
            print(f"Aucun item trouvé avec shop_id={shop_id}, item_id={item_id}")  # Log
        
    except Exception as e:
        print(f"Erreur lors de la décrémentation du stock : {e}")  # Log
    finally:
        if conn:
            conn.close()

def get_all_items():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price, description, shop_id, stock, active FROM items")
    result = cursor.fetchall()
    conn.close()
    return result

def get_item_by_name(name):
    """Récupère un item par son nom."""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT item_id, name, price, description, stock, active
        FROM items
        WHERE name = %s AND active = 1
        ORDER BY item_id
        LIMIT 1
    """, (name,))
    result = cursor.fetchone()
    conn.close()
    return result

def get_item_by_id(item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM items WHERE item_id = %s", (item_id,))
    result = cursor.fetchone()
    conn.close()
    return result

def reactivate_item(item_id, stock=None):
    conn = connect_db()
    cursor = conn.cursor()
    if stock is not None:
        cursor.execute("UPDATE items SET active = 1, stock = %s WHERE item_id = %s", (stock, item_id))
    else:
        cursor.execute("UPDATE items SET active = 1 WHERE item_id = %s", (item_id,))
    conn.commit()
    conn.close()

# Gestion des utilisateurs et balances
def get_balance(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT balance FROM users WHERE user_id = %s", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0

def set_balance(user_id, amount):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (user_id, balance)
        VALUES (%s, %s)
        ON CONFLICT (user_id)
        DO UPDATE SET balance = EXCLUDED.balance
    """, (user_id, amount))
    conn.commit()
    conn.close()

def update_balance(user_id, amount):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (user_id, balance)
        VALUES (%s, 0)
        ON CONFLICT (user_id)
        DO NOTHING
    """, (user_id,))
    cursor.execute("UPDATE users SET balance = balance + %s WHERE user_id = %s", (amount, user_id))
    conn.commit()
    conn.close()

# Gestion inventaire avec quantités
def add_user_item(user_id, shop_id, item_id, quantity=1):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_items (user_id, shop_id, item_id, quantity)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, shop_id, item_id)
        DO UPDATE SET quantity = user_items.quantity + EXCLUDED.quantity
    """, (user_id, shop_id, item_id, quantity))
    conn.commit()
    conn.close()

def remove_user_item(user_id, shop_id, item_id, quantity=1):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT quantity FROM user_items WHERE user_id = %s AND shop_id = %s AND item_id = %s", (user_id, shop_id, item_id))
    result = cursor.fetchone()
    if result:
        current_quantity = result[0]
        if current_quantity > quantity:
            cursor.execute("UPDATE user_items SET quantity = quantity - %s WHERE user_id = %s AND shop_id = %s AND item_id = %s", (quantity, user_id, shop_id, item_id))
        else:
            cursor.execute("DELETE FROM user_items WHERE user_id = %s AND shop_id = %s AND item_id = %s", (user_id, shop_id, item_id))
        conn.commit()
    conn.close()

def get_user_inventory(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.name, ui.quantity, s.name as shop_name
        FROM user_items ui
        JOIN items i ON ui.item_id = i.item_id AND ui.shop_id = i.shop_id
        JOIN shops s ON ui.shop_id = s.shop_id
        WHERE ui.user_id = %s
    """, (user_id,))
    result = cursor.fetchall()
    conn.close()
    return result

# Dépôts bancaires
def deposit(user_id, amount):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO bank_deposit (user_id, amount)
        VALUES (%s, 0)
        ON CONFLICT (user_id)
        DO NOTHING
    """, (user_id,))
    cursor.execute("UPDATE bank_deposit SET amount = amount + %s WHERE user_id = %s", (amount, user_id))
    conn.commit()
    conn.close()

def get_deposit(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT amount FROM bank_deposit WHERE user_id = %s", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0

# Gestion des salaires
def assign_role_salary(role_id, salary, cooldown=3600):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO role_salaries (role_id, salary, cooldown)
        VALUES (%s, %s, %s)
        ON CONFLICT (role_id)
        DO UPDATE SET salary = EXCLUDED.salary, cooldown = EXCLUDED.cooldown
    """, (role_id, salary, cooldown))
    conn.commit()
    conn.close()

def get_role_salary(role_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT salary FROM role_salaries WHERE role_id = %s", (role_id,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0

def get_all_roles_salaries():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role_id, salary, cooldown FROM role_salaries")
    result = cursor.fetchall()
    conn.close()
    return result

# Gestion cooldowns salaire
def set_salary_cooldown(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO salary_cooldowns (user_id, last_collect)
        VALUES (%s, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET last_collect = EXCLUDED.last_collect
    """, (user_id,))
    conn.commit()
    conn.close()

def get_salary_cooldown(user_id, role_ids):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT last_collect FROM salary_cooldowns WHERE user_id = %s", (user_id,))
    result = cursor.fetchone()
    if not result:
        return 0
    last_collect = result[0]
    now = time.time()
    placeholders = ','.join(['%s'] * len(role_ids))
    cursor.execute(f"SELECT MIN(cooldown) FROM role_salaries WHERE role_id IN ({placeholders})", role_ids)
    cooldown = cursor.fetchone()[0] or 3600
    remaining = cooldown - (now - last_collect.timestamp())
    conn.close()
    return remaining if remaining > 0 else 0
    
def remove_role_salary(role_id):
    """Supprime complètement un rôle de la table role_salaries."""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM role_salaries WHERE role_id = %s", (role_id,))
    conn.commit()
    conn.close()
    
# Créer les tables si elles n'existent pas
create_tables()
