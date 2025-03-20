import sqlite3

def connect_db():
    return sqlite3.connect('shop_and_salary_database.db')

def create_tables():
    connection = connect_db()
    cursor = connection.cursor()

    # Shops et Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shops (
        shop_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
    )
    """)

    # Utilisateurs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        balance INTEGER DEFAULT 0
    )
    """)

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

    # Dépôt bancaire
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bank_deposit (
        user_id INTEGER PRIMARY KEY,
        amount INTEGER DEFAULT 0
    )
    """)

    # Salaires des rôles avec cooldown
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS role_salaries (
        role_id INTEGER PRIMARY KEY,
        salary INTEGER,
        cooldown INTEGER DEFAULT 3600
    )
    """)

    # Cooldown de salaire par utilisateur
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS salary_cooldowns (
        user_id INTEGER PRIMARY KEY,
        last_collect TIMESTAMP
    )
    """)

    connection.commit()
    connection.close()

create_tables()

# Gestion shops/items (inchangée)
def get_shops():
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT shop_id, name FROM shops")
    shops = cursor.fetchall()
    connection.close()
    return shops

def get_shop_items(shop_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT item_id, name, price FROM items WHERE shop_id = ?", (shop_id,))
    items = cursor.fetchall()
    connection.close()
    return items

def create_shop(name):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT INTO shops (name) VALUES (?)", (name,))
    connection.commit()
    shop_id = cursor.lastrowid
    connection.close()
    return shop_id

def delete_shop(shop_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM shops WHERE shop_id = ?", (shop_id,))
    connection.commit()
    connection.close()

def add_item_to_shop(shop_id, name, price):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT INTO items (shop_id, name, price) VALUES (?, ?, ?)", (shop_id, name, price))
    connection.commit()
    item_id = cursor.lastrowid
    connection.close()
    return item_id

def remove_item_from_shop(shop_id, item_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM items WHERE shop_id = ? AND item_id = ?", (shop_id, item_id))
    connection.commit()
    connection.close()
    return cursor.rowcount > 0

def get_shop_item(shop_id, item_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT item_id, name, price FROM items WHERE shop_id = ? AND item_id = ?", (shop_id, item_id))
    item = cursor.fetchone()
    connection.close()
    return item

# Gestion utilisateurs
def get_balance(user_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    balance = cursor.fetchone()
    connection.close()
    return balance[0] if balance else 0

def set_balance(user_id, amount):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT OR REPLACE INTO users (user_id, balance) VALUES (?, ?)", (user_id, amount))
    connection.commit()
    connection.close()

def update_balance(user_id, amount):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 0)", (user_id,))
    cursor.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, user_id))
    connection.commit()
    connection.close()

def add_user_item(user_id, shop_id, item_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT INTO user_items (user_id, shop_id, item_id) VALUES (?, ?, ?)", (user_id, shop_id, item_id))
    connection.commit()
    connection.close()

def remove_user_item(user_id, shop_id, item_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM user_items WHERE user_id = ? AND shop_id = ? AND item_id = ?", (user_id, shop_id, item_id))
    connection.commit()
    connection.close()

# Gestion dépôts/retraits
def deposit(user_id, amount):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT OR IGNORE INTO bank_deposit (user_id, amount) VALUES (?, 0)", (user_id,))
    cursor.execute("UPDATE bank_deposit SET amount = amount + ? WHERE user_id = ?", (amount, user_id))
    connection.commit()
    connection.close()

def get_deposit(user_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT amount FROM bank_deposit WHERE user_id = ?", (user_id,))
    deposit = cursor.fetchone()
    connection.close()
    return deposit[0] if deposit else 0

# Gestion des salaires des rôles avec cooldown
def assign_role_salary(role_id, salary, cooldown=3600):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT OR REPLACE INTO role_salaries (role_id, salary, cooldown) VALUES (?, ?, ?)", (role_id, salary, cooldown))
    connection.commit()
    connection.close()

def get_role_salary(role_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT salary FROM role_salaries WHERE role_id = ?", (role_id,))
    result = cursor.fetchone()
    connection.close()
    return result[0] if result else 0

def get_all_roles_salaries():
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT role_id, salary, cooldown FROM role_salaries")
    result = cursor.fetchall()
    connection.close()
    return result

# Cooldown collecte salaire
import time

def set_salary_cooldown(user_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT OR REPLACE INTO salary_cooldowns (user_id, last_collect) VALUES (?, ?)", (user_id, int(time.time())))
    connection.commit()
    connection.close()

def get_salary_cooldown(user_id):
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT last_collect FROM salary_cooldowns WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    if result is None:
        return 0
    last_time = result[0]
    now = int(time.time())
    # Trouver le cooldown applicable à l'utilisateur
    cursor.execute("""
        SELECT MIN(cooldown) FROM role_salaries 
        WHERE role_id IN (
            SELECT role_id FROM role_salaries
        )
    """)  # (optionnel : peut être ajusté pour filtrer par les rôles du membre)
    cooldown = cursor.fetchone()[0] or 3600
    remaining = cooldown - (now - last_time)
    connection.close()
    return remaining if remaining > 0 else 0
