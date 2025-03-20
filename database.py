import sqlite3
import time

def connect_db():
    return sqlite3.connect('shop_and_salary_database.db')

def create_tables():
    connection = connect_db()
    cursor = connection.cursor()

    # Table shops avec description
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shops (
        shop_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT ''
    )
    """)

    # Table items avec description et stock
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT DEFAULT '',
        stock INTEGER DEFAULT -1,
        active INTEGER DEFAULT 1,
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
    )
    """)

    # Table utilisateurs (balance)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        balance INTEGER DEFAULT 0
    )
    """)

    # Inventaire avec quantité
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_items (
        user_id INTEGER,
        shop_id INTEGER,
        item_id INTEGER,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id),
        FOREIGN KEY (item_id) REFERENCES items(item_id),
        PRIMARY KEY (user_id, shop_id, item_id)
    )
    """)

    # Dépôts bancaires
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bank_deposit (
        user_id INTEGER PRIMARY KEY,
        amount INTEGER DEFAULT 0
    )
    """)

    # Salaires des rôles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS role_salaries (
        role_id INTEGER PRIMARY KEY,
        salary INTEGER,
        cooldown INTEGER DEFAULT 3600
    )
    """)

    # Cooldown salaires utilisateurs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS salary_cooldowns (
        user_id INTEGER PRIMARY KEY,
        last_collect TIMESTAMP
    )
    """)

    connection.commit()
    connection.close()

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
    cursor.execute("INSERT INTO shops (name, description) VALUES (?, ?)", (name, description))
    conn.commit()
    shop_id = cursor.lastrowid
    conn.close()
    return shop_id

def delete_shop(shop_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM shops WHERE shop_id = ?", (shop_id,))
    cursor.execute("DELETE FROM items WHERE shop_id = ?", (shop_id,))
    conn.commit()
    conn.close()

def add_item_to_shop(shop_id, name, price, description="", stock=-1):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO items (shop_id, name, price, description, stock, active) VALUES (?, ?, ?, ?, ?, 1)", (shop_id, name, price, description, stock))
    conn.commit()
    item_id = cursor.lastrowid
    conn.close()
    return item_id

def remove_item(item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE items SET active = 0 WHERE item_id = ?", (item_id,))
    conn.commit()
    conn.close()

def get_shop_items(shop_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price, description, stock FROM items WHERE shop_id = ? AND active = 1", (shop_id,))
    result = cursor.fetchall()
    conn.close()
    return result

def get_shop_item(shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price, description, stock FROM items WHERE shop_id = ? AND item_id = ? AND active = 1", (shop_id, item_id))
    result = cursor.fetchone()
    conn.close()
    return result

def decrement_item_stock(shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE items
        SET stock = stock - 1
        WHERE shop_id = ? AND item_id = ? AND stock > 0
    """, (shop_id, item_id))
    conn.commit()
    conn.close()

def get_all_items():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price, description, shop_id, stock, active FROM items")
    result = cursor.fetchall()
    conn.close()
    return result

def get_item_by_name(name):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM items WHERE name = ? ORDER BY active DESC LIMIT 1", (name,))
    result = cursor.fetchone()
    conn.close()
    return result

def get_item_by_id(item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM items WHERE item_id = ?", (item_id,))
    result = cursor.fetchone()
    conn.close()
    return result

def reactivate_item(item_id, stock=None):
    conn = connect_db()
    cursor = conn.cursor()
    if stock is not None:
        cursor.execute("UPDATE items SET active = 1, stock = ? WHERE item_id = ?", (stock, item_id))
    else:
        cursor.execute("UPDATE items SET active = 1 WHERE item_id = ?", (item_id,))
    conn.commit()
    conn.close()

# Gestion des utilisateurs et balances
def get_balance(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0

def set_balance(user_id, amount):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO users (user_id, balance) VALUES (?, ?)", (user_id, amount))
    conn.commit()
    conn.close()

def update_balance(user_id, amount):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 0)", (user_id,))
    cursor.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, user_id))
    conn.commit()
    conn.close()

# Gestion inventaire avec quantités
def add_user_item(user_id, shop_id, item_id, quantity=1):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_items (user_id, shop_id, item_id, quantity)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, shop_id, item_id)
        DO UPDATE SET quantity = quantity + excluded.quantity
    """, (user_id, shop_id, item_id, quantity))
    conn.commit()
    conn.close()

def remove_user_item(user_id, shop_id, item_id, quantity=1):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT quantity FROM user_items WHERE user_id = ? AND shop_id = ? AND item_id = ?", (user_id, shop_id, item_id))
    result = cursor.fetchone()
    if result:
        current_quantity = result[0]
        if current_quantity > quantity:
            cursor.execute("UPDATE user_items SET quantity = quantity - ? WHERE user_id = ? AND shop_id = ? AND item_id = ?", (quantity, user_id, shop_id, item_id))
        else:
            cursor.execute("DELETE FROM user_items WHERE user_id = ? AND shop_id = ? AND item_id = ?", (user_id, shop_id, item_id))
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
        WHERE ui.user_id = ?
    """, (user_id,))
    result = cursor.fetchall()
    conn.close()
    return result


# Dépôts bancaires
def deposit(user_id, amount):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO bank_deposit (user_id, amount) VALUES (?, 0)", (user_id,))
    cursor.execute("UPDATE bank_deposit SET amount = amount + ? WHERE user_id = ?", (amount, user_id))
    conn.commit()
    conn.close()

def get_deposit(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT amount FROM bank_deposit WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0

# Gestion des salaires
def assign_role_salary(role_id, salary, cooldown=3600):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO role_salaries (role_id, salary, cooldown) VALUES (?, ?, ?)", (role_id, salary, cooldown))
    conn.commit()
    conn.close()

def get_role_salary(role_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT salary FROM role_salaries WHERE role_id = ?", (role_id,))
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
    cursor.execute("INSERT OR REPLACE INTO salary_cooldowns (user_id, last_collect) VALUES (?, ?)", (user_id, int(time.time())))
    conn.commit()
    conn.close()

def get_salary_cooldown(user_id, role_ids):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT last_collect FROM salary_cooldowns WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    if not result:
        return 0
    last_collect = result[0]
    now = int(time.time())
    placeholders = ','.join('?' for _ in role_ids)
    cursor.execute(f"SELECT MIN(cooldown) FROM role_salaries WHERE role_id IN ({placeholders})", role_ids)
    cooldown = cursor.fetchone()[0] or 3600
    remaining = cooldown - (now - last_collect)
    conn.close()
    return remaining if remaining > 0 else 0



# Créer les tables si elles n'existent pas
create_tables()
