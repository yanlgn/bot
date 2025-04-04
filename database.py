import psycopg2
from psycopg2 import sql
import time
import os

# Récupérer les informations de connexion depuis les variables d'environnement
DATABASE_URL = os.getenv('DATABASE_URL')  # Exemple : "postgresql://user:password@host:port/database"

def connect_db():
    """Établit une connexion à la base de données."""
    return psycopg2.connect(DATABASE_URL)

def create_tables():
    """Crée les tables nécessaires si elles n'existent pas."""
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
    
    # Vérifier si l'item existe déjà dans ce shop
    cursor.execute("""
        SELECT item_id FROM items 
        WHERE shop_id = %s AND name = %s
    """, (shop_id, name))
    existing_item = cursor.fetchone()
    
    if existing_item:
        conn.close()
        raise ValueError(f"Un item avec le nom '{name}' existe déjà dans ce shop (ID: {existing_item[0]})")

    # Générer un nouvel ID unique en trouvant le maximum actuel +1
    cursor.execute("SELECT COALESCE(MAX(item_id), 0) + 1 FROM items")
    new_item_id = cursor.fetchone()[0]
    
    # Insérer le nouvel item avec l'ID généré
    cursor.execute("""
        INSERT INTO items (item_id, shop_id, name, price, description, stock, active)
        VALUES (%s, %s, %s, %s, %s, %s, 1)
        RETURNING item_id
    """, (new_item_id, shop_id, name, price, description, stock))
    
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
    """Récupère un item par son nom, même s'il est inactif."""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT item_id, name, price, description, stock, active
        FROM items
        WHERE name = %s
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
def transfer_money(from_user_id, to_user_id, amount):
    """Transfère de l'argent d'un utilisateur à un autre."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Vérifie que l'utilisateur source a suffisamment d'argent
        cursor.execute("SELECT balance FROM users WHERE user_id = %s", (from_user_id,))
        from_balance = cursor.fetchone()
        if not from_balance or from_balance[0] < amount:
            raise ValueError("Solde insuffisant pour effectuer le transfert.")

        # Débite l'utilisateur source
        cursor.execute("UPDATE users SET balance = balance - %s WHERE user_id = %s", (amount, from_user_id))

        # Crédite l'utilisateur cible (ou le crée s'il n'existe pas)
        cursor.execute("""
            INSERT INTO users (user_id, balance)
            VALUES (%s, 0)
            ON CONFLICT (user_id)
            DO NOTHING
        """, (to_user_id,))
        cursor.execute("UPDATE users SET balance = balance + %s WHERE user_id = %s", (amount, to_user_id))

        conn.commit()
        print(f"Transfert réussi : {amount} de {from_user_id} à {to_user_id}.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erreur lors du transfert d'argent : {e}")
        raise e
    finally:
        if conn:
            conn.close()

def add_money(user_id, amount):
    """Ajoute de l'argent à un utilisateur."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Crée l'utilisateur s'il n'existe pas
        cursor.execute("""
            INSERT INTO users (user_id, balance)
            VALUES (%s, 0)
            ON CONFLICT (user_id)
            DO NOTHING
        """, (user_id,))

        # Ajoute l'argent à l'utilisateur
        cursor.execute("UPDATE users SET balance = balance + %s WHERE user_id = %s", (amount, user_id))

        conn.commit()
        print(f"Argent ajouté avec succès : {amount} à {user_id}.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erreur lors de l'ajout d'argent : {e}")
        raise e
    finally:
        if conn:
            conn.close()

def remove_money(user_id, amount):
    """Retire de l'argent à un utilisateur."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Vérifie que l'utilisateur a suffisamment d'argent
        cursor.execute("SELECT balance FROM users WHERE user_id = %s", (user_id,))
        balance = cursor.fetchone()
        if not balance or balance[0] < amount:
            raise ValueError("Solde insuffisant pour effectuer le retrait.")

        # Retire l'argent de l'utilisateur
        cursor.execute("UPDATE users SET balance = balance - %s WHERE user_id = %s", (amount, user_id))

        conn.commit()
        print(f"Argent retiré avec succès : {amount} de {user_id}.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erreur lors du retrait d'argent : {e}")
        raise e
    finally:
        if conn:
            conn.close()


# Gestion inventaire avec quantités
def add_user_item(user_id, shop_id, item_id, quantity=1):
    """Ajoute un item à l'inventaire d'un utilisateur."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_items (user_id, shop_id, item_id, quantity)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, shop_id, item_id)
            DO UPDATE SET quantity = user_items.quantity + EXCLUDED.quantity
        """, (user_id, shop_id, item_id, quantity))
        conn.commit()
        print(f"Item ajouté avec succès : user_id={user_id}, shop_id={shop_id}, item_id={item_id}, quantity={quantity}")
    except Exception as e:
        print(f"Erreur lors de l'ajout de l'item : {e}")
        raise e  # Relancer l'exception pour la capturer dans inventory.py
    finally:
        if conn:
            conn.close()

def remove_user_item(user_id, shop_id, item_id, quantity=1):
    """Retire un item de l'inventaire d'un utilisateur."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Récupérer la quantité actuelle
        cursor.execute("""
            SELECT quantity FROM user_items
            WHERE user_id = %s AND shop_id = %s AND item_id = %s
        """, (user_id, shop_id, item_id))
        result = cursor.fetchone()

        if result:
            current_quantity = result[0]

            # Si la quantité après retrait est <= 0, supprimer l'item
            if current_quantity <= quantity:
                cursor.execute("""
                    DELETE FROM user_items
                    WHERE user_id = %s AND shop_id = %s AND item_id = %s
                """, (user_id, shop_id, item_id))
            else:
                # Sinon, décrémenter la quantité
                cursor.execute("""
                    UPDATE user_items
                    SET quantity = quantity - %s
                    WHERE user_id = %s AND shop_id = %s AND item_id = %s
                """, (quantity, user_id, shop_id, item_id))

            conn.commit()
            print(f"Item retiré avec succès : user_id={user_id}, shop_id={shop_id}, item_id={item_id}, quantity={quantity}")
    except Exception as e:
        print(f"Erreur lors de la suppression de l'item : {e}")
        raise e  # Relancer l'exception pour la capturer dans inventory.py
    finally:
        if conn:
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
    """Dépose de l'argent dans la banque et le retire du portefeuille."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Vérifie que l'utilisateur a suffisamment d'argent dans le portefeuille
        cursor.execute("SELECT balance FROM users WHERE user_id = %s", (user_id,))
        balance = cursor.fetchone()
        if not balance or balance[0] < amount:
            raise ValueError("Solde insuffisant dans le portefeuille.")

        # Retire l'argent du portefeuille
        cursor.execute("UPDATE users SET balance = balance - %s WHERE user_id = %s", (amount, user_id))

        # Ajoute l'argent à la banque
        cursor.execute("""
            INSERT INTO bank_deposit (user_id, amount)
            VALUES (%s, 0)
            ON CONFLICT (user_id)
            DO NOTHING
        """, (user_id,))
        cursor.execute("UPDATE bank_deposit SET amount = amount + %s WHERE user_id = %s", (amount, user_id))

        conn.commit()
        print(f"Dépôt réussi : {amount} dans la banque de {user_id}.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erreur lors du dépôt : {e}")
        raise e
    finally:
        if conn:
            conn.close()

def withdraw(user_id, amount):
    """Retire de l'argent de la banque et l'ajoute au portefeuille."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Vérifie que l'utilisateur a suffisamment d'argent à la banque
        cursor.execute("SELECT amount FROM bank_deposit WHERE user_id = %s", (user_id,))
        deposit = cursor.fetchone()
        if not deposit or deposit[0] < amount:
            raise ValueError("Solde insuffisant à la banque.")

        # Retire l'argent de la banque
        cursor.execute("UPDATE bank_deposit SET amount = amount - %s WHERE user_id = %s", (amount, user_id))

        # Ajoute l'argent au portefeuille
        cursor.execute("""
            INSERT INTO users (user_id, balance)
            VALUES (%s, 0)
            ON CONFLICT (user_id)
            DO NOTHING
        """, (user_id,))
        cursor.execute("UPDATE users SET balance = balance + %s WHERE user_id = %s", (amount, user_id))

        conn.commit()
        print(f"Retrait réussi : {amount} de la banque de {user_id}.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Erreur lors du retrait : {e}")
        raise e
    finally:
        if conn:
            conn.close()

def get_deposit(user_id):
    """Récupère le montant déposé à la banque par l'utilisateur."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT amount FROM bank_deposit WHERE user_id = %s", (user_id,))
        result = cursor.fetchone()
        return result[0] if result else 0
    except Exception as e:
        print(f"Erreur lors de la récupération du dépôt : {e}")
        raise e
    finally:
        if conn:
            conn.close()

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
