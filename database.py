import sqlite3
import time

def connect_db():
    return sqlite3.connect('shop_and_salary_database.db')

def create_tables():
    connection = connect_db()
    cursor = connection.cursor()

    # Table shops
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shops (
        shop_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )
    """)

    # Table items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
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

    # Table user_items (objets possédés)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_items (
        user_id INTEGER,
        shop_id INTEGER,
        item_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id),
        FOREIGN KEY (item_id) REFERENCES items(item_id)
    )
    """)

    # Table bank_deposit (dépôts bancaires)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bank_deposit (
        user_id INTEGER PRIMARY KEY,
        amount INTEGER DEFAULT 0
    )
    """)

    # Table salaires des rôles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS role_salaries (
        role_id INTEGER PRIMARY KEY,
        salary INTEGER,
        cooldown INTEGER DEFAULT 3600
    )
    """)

    # Table cooldown des salaires pour chaque utilisateur
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
    cursor.execute("SELECT shop_id, name FROM shops")
    result = cursor.fetchall()
    conn.close()
    return result

def get_shop_items(shop_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price FROM items WHERE shop_id = ?", (shop_id,))
    result = cursor.fetchall()
    conn.close()
    return result

def create_shop(name):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO shops (name) VALUES (?)", (name,))
    conn.commit()
    shop_id = cursor.lastrowid
    conn.close()
    return shop_id

def delete_shop(shop_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM shops WHERE shop_id = ?", (shop_id,))
    conn.commit()
    conn.close()

def add_item_to_shop(shop_id, name, price):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO items (shop_id, name, price) VALUES (?, ?, ?)", (shop_id, name, price))
    conn.commit()
    item_id = cursor.lastrowid
    conn.close()
    return item_id

def remove_item_from_shop(shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM items WHERE shop_id = ? AND item_id = ?", (shop_id, item_id))
    conn.commit()
    conn.close()

def get_shop_item(shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, name, price FROM items WHERE shop_id = ? AND item_id = ?", (shop_id, item_id))
    result = cursor.fetchone()
    conn.close()
    return result

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

def add_user_item(user_id, shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO user_items (user_id, shop_id, item_id) VALUES (?, ?, ?)", (user_id, shop_id, item_id))
    conn.commit()
    conn.close()

def remove_user_item(user_id, shop_id, item_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_items WHERE user_id = ? AND shop_id = ? AND item_id = ?", (user_id, shop_id, item_id))
    conn.commit()
    conn.close()

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
    # On prend le cooldown le plus petit parmi les rôles du membre
    placeholders = ','.join('?' for _ in role_ids)
    cursor.execute(f"SELECT MIN(cooldown) FROM role_salaries WHERE role_id IN ({placeholders})", role_ids)
    cooldown = cursor.fetchone()[0] or 3600
    remaining = cooldown - (now - last_collect)
    conn.close()
    return remaining if remaining > 0 else 0

# Créer les tables si elles n'existent pas
create_tables()
