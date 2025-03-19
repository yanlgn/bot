import sqlite3

# Connexion à la base de données
def connect_db():
    return sqlite3.connect('shop_and_salary_database.db')

def create_tables():
    """Créer les tables nécessaires dans la base de données."""
    connection = connect_db()
    cursor = connection.cursor()

    # Créer les tables pour les shops et les items
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

    # Créer la table pour les salaires des rôles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS role_salaries (
        role_id INTEGER PRIMARY KEY,
        salary INTEGER
    )
    """)

    connection.commit()
    connection.close()

# Appeler create_tables pour s'assurer que les tables sont créées
create_tables()

# Gestion des shops et items
def get_shops():
    """Récupérer tous les shops."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT shop_id, name FROM shops")
    shops = cursor.fetchall()
    connection.close()
    return shops

def get_shop_items(shop_id):
    """Récupérer tous les items d'un shop."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT item_id, name, price FROM items WHERE shop_id = ?", (shop_id,))
    items = cursor.fetchall()
    connection.close()
    return items

def create_shop(name):
    """Créer un shop."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT INTO shops (name) VALUES (?)", (name,))
    connection.commit()
    shop_id = cursor.lastrowid
    connection.close()
    return shop_id

def delete_shop(shop_id):
    """Supprimer un shop."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM shops WHERE shop_id = ?", (shop_id,))
    connection.commit()
    connection.close()

def add_item_to_shop(shop_id, name, price):
    """Ajouter un item à un shop."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT INTO items (shop_id, name, price) VALUES (?, ?, ?)", (shop_id, name, price))
    connection.commit()
    item_id = cursor.lastrowid
    connection.close()
    return item_id

def remove_item_from_shop(shop_id, item_id):
    """Supprimer un item d'un shop."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM items WHERE shop_id = ? AND item_id = ?", (shop_id, item_id))
    connection.commit()
    connection.close()
    return cursor.rowcount > 0

def get_shop_item(shop_id, item_id):
    """Récupérer un item spécifique d'un shop."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT item_id, name, price FROM items WHERE shop_id = ? AND item_id = ?", (shop_id, item_id))
    item = cursor.fetchone()
    connection.close()
    return item

# Gestion des utilisateurs
def get_balance(user_id):
    """Récupérer le solde d'un utilisateur."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    balance = cursor.fetchone()
    connection.close()
    return balance[0] if balance else 0

def update_balance(user_id, amount):
    """Mettre à jour le solde d'un utilisateur."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, user_id))
    connection.commit()
    connection.close()

def add_user_item(user_id, shop_id, item_id):
    """Ajouter un item à l'inventaire d'un utilisateur."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT INTO user_items (user_id, shop_id, item_id) VALUES (?, ?, ?)", (user_id, shop_id, item_id))
    connection.commit()
    connection.close()

def remove_user_item(user_id, shop_id, item_id):
    """Retirer un item de l'inventaire d'un utilisateur."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM user_items WHERE user_id = ? AND shop_id = ? AND item_id = ?", (user_id, shop_id, item_id))
    connection.commit()
    connection.close()

# Gestion des salaires des rôles
def assign_role_salary(role_id, salary):
    """Attribuer un salaire à un rôle."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("INSERT OR REPLACE INTO role_salaries (role_id, salary) VALUES (?, ?)", (role_id, salary))
    connection.commit()
    connection.close()

def get_role_salary(role_id):
    """Récupérer le salaire d'un rôle."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT salary FROM role_salaries WHERE role_id = ?", (role_id,))
    result = cursor.fetchone()
    connection.close()
    return result[0] if result else 0

def get_all_roles_salaries():
    """Récupérer tous les salaires des rôles."""
    connection = connect_db()
    cursor = connection.cursor()
    cursor.execute("SELECT role_id, salary FROM role_salaries")
    result = cursor.fetchall()
    connection.close()
    return result
