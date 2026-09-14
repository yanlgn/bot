import logging
import os
import threading
import time

import psycopg2
from psycopg2 import pool

logger = logging.getLogger(__name__)

# Récupérer les informations de connexion depuis les variables d'environnement
DATABASE_URL = os.getenv('DATABASE_URL')  # Exemple : "postgresql://user:password@host:port/database"

_pool = None
_pool_lock = threading.Lock()


def _ensure_column(cursor, table, column, definition):
    """Ajoute une colonne si elle n'existe pas (migration idempotente)."""
    cursor.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
    """, (table, column))
    if cursor.fetchone() is None:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _get_pool():
    """Crée le pool de connexions au premier appel."""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = pool.SimpleConnectionPool(1, 10, DATABASE_URL, connect_timeout=10)
    return _pool


def connect_db():
    """Acquiert une connexion depuis le pool."""
    return _get_pool().getconn()


def release_conn(conn):
    """Retourne une connexion au pool (au lieu de la fermer)."""
    if conn is not None:
        _get_pool().putconn(conn)


def create_tables():
    """Crée les tables nécessaires si elles n'existent pas."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Table shops avec description
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shops (
                shop_id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                guild_id BIGINT
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

        # Journal des transactions (économiques)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                type TEXT NOT NULL,
                amount INTEGER DEFAULT 0,
                item_id INTEGER,
                shop_id INTEGER,
                item_name TEXT,
                quantity INTEGER,
                details TEXT DEFAULT '',
                guild_id BIGINT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Journal d'audit (actions admin, web ou Discord)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id BIGSERIAL PRIMARY KEY,
                admin_id BIGINT,
                action TEXT NOT NULL,
                target TEXT DEFAULT '',
                details TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Migrations : guild_id sur les tables existantes (compatibilité bases actuelles)
        _ensure_column(cursor, "shops", "guild_id", "BIGINT")
        _ensure_column(cursor, "transactions", "guild_id", "BIGINT")

        conn.commit()
        logger.info("Tables créées / vérifiées avec succès")
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors de la création des tables")
        raise
    finally:
        release_conn(conn)


# Gestion shops et items
def get_shops(guild_id=None):
    """
    Retourne les shops. Si guild_id est fourni : les shops de la guild
    plus les shops hérités sans guild (guild_id NULL = globaux).
    """
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        if guild_id is not None:
            cursor.execute("""
                SELECT shop_id, name, description FROM shops
                WHERE guild_id = %s OR guild_id IS NULL
            """, (guild_id,))
        else:
            cursor.execute("SELECT shop_id, name, description FROM shops")
        return cursor.fetchall()
    finally:
        release_conn(conn)


def create_shop(name, description="", guild_id=None):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO shops (name, description, guild_id)
            VALUES (%s, %s, %s)
            RETURNING shop_id
        """, (name, description, guild_id))
        shop_id = cursor.fetchone()[0]
        conn.commit()
        return shop_id
    finally:
        release_conn(conn)


def delete_shop(shop_id):
    """Supprime un shop et ses items. Retourne True si le shop existait."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        # Supprime d'abord les données liées (inventaire, puis items, puis shop)
        cursor.execute("DELETE FROM user_items WHERE shop_id = %s", (shop_id,))
        cursor.execute("DELETE FROM items WHERE shop_id = %s", (shop_id,))
        cursor.execute("DELETE FROM shops WHERE shop_id = %s", (shop_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors de la suppression du shop %s", shop_id)
        raise
    finally:
        release_conn(conn)


def add_item_to_shop(shop_id, name, price, description="", stock=-1):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Vérifier si l'item existe déjà dans ce shop
        cursor.execute("""
            SELECT item_id FROM items
            WHERE shop_id = %s AND name = %s
        """, (shop_id, name))
        existing_item = cursor.fetchone()

        if existing_item:
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
        return item_id
    finally:
        release_conn(conn)


def remove_item(item_id):
    """Désactive un item. Retourne True si l'item a été trouvé."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE items SET active = 0 WHERE item_id = %s RETURNING item_id", (item_id,))
        result = cursor.fetchone()
        conn.commit()
        return result is not None
    finally:
        release_conn(conn)


def get_shop_items(shop_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT item_id, name, price, description, stock FROM items WHERE shop_id = %s AND active = 1", (shop_id,))
        return cursor.fetchall()
    finally:
        release_conn(conn)


def get_shop_items_all(shop_id):
    """Tous les items d'un shop, y compris inactifs (pour l'admin)."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT item_id, name, price, description, stock, active
            FROM items WHERE shop_id = %s
        """, (shop_id,))
        return cursor.fetchall()
    finally:
        release_conn(conn)


def get_shop_item(shop_id, item_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT item_id, name, price, description, stock FROM items WHERE shop_id = %s AND item_id = %s AND active = 1", (shop_id, item_id))
        return cursor.fetchone()
    finally:
        release_conn(conn)


def decrement_item_stock(shop_id, item_id, quantity):
    """
    Décrémente le stock d'un item de la quantité spécifiée.
    Retourne True si le stock a bien été décrémenté.
    """
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE items
            SET stock = stock - %s
            WHERE shop_id = %s AND item_id = %s AND stock >= %s
        """, (quantity, shop_id, item_id, quantity))
        success = cursor.rowcount > 0
        conn.commit()

        if success:
            logger.info("Stock décrémenté de %s (shop_id=%s, item_id=%s)", quantity, shop_id, item_id)
        else:
            logger.warning("Stock insuffisant ou item introuvable (shop_id=%s, item_id=%s)", shop_id, item_id)
        return success
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors de la décrémentation du stock (shop_id=%s, item_id=%s)", shop_id, item_id)
        raise
    finally:
        release_conn(conn)


def get_all_items():
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT item_id, name, price, description, shop_id, stock, active FROM items")
        return cursor.fetchall()
    finally:
        release_conn(conn)


def get_guild_shop_ids(guild_id):
    """IDs des shops visibles pour une guild (les siens + les shops globaux hérités)."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT shop_id FROM shops WHERE guild_id = %s OR guild_id IS NULL", (guild_id,))
        return [r[0] for r in cursor.fetchall()]
    finally:
        release_conn(conn)


def get_items_for_guild(guild_id):
    """Tous les items des shops accessibles à une guild (avec l'info shop)."""
    shop_ids = get_guild_shop_ids(guild_id)
    if not shop_ids:
        return []
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        placeholders = ",".join(["%s"] * len(shop_ids))
        cursor.execute(f"""
            SELECT item_id, name, price, description, shop_id, stock, active
            FROM items
            WHERE shop_id IN ({placeholders})
        """, shop_ids)
        return cursor.fetchall()
    finally:
        release_conn(conn)


def shop_in_guild(shop_id, guild_id):
    """Vrai si le shop appartient à la guild (ou est global, guild_id NULL)."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT guild_id FROM shops WHERE shop_id = %s", (shop_id,))
        row = cursor.fetchone()
        if not row:
            return False
        return row[0] is None or row[0] == guild_id
    finally:
        release_conn(conn)


def get_item_by_name(name, shop_id=None):
    """
    Récupère un item par son nom, même s'il est inactif.
    Si shop_id est fourni, filtre sur ce shop uniquement.
    """
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        if shop_id is not None:
            cursor.execute("""
                SELECT item_id, name, price, description, stock, active
                FROM items
                WHERE name = %s AND shop_id = %s
                ORDER BY item_id
                LIMIT 1
            """, (name, shop_id))
        else:
            cursor.execute("""
                SELECT item_id, name, price, description, stock, active
                FROM items
                WHERE name = %s
                ORDER BY item_id
                LIMIT 1
            """, (name,))
        return cursor.fetchone()
    finally:
        release_conn(conn)


def get_item_by_id(item_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE item_id = %s", (item_id,))
        return cursor.fetchone()
    finally:
        release_conn(conn)


def reactivate_item(item_id, stock=None):
    """Réactive un item, avec un éventuel nouveau stock. Retourne True si trouvé."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        if stock is not None:
            cursor.execute("UPDATE items SET active = 1, stock = %s WHERE item_id = %s RETURNING item_id", (stock, item_id))
        else:
            cursor.execute("UPDATE items SET active = 1 WHERE item_id = %s RETURNING item_id", (item_id,))
        result = cursor.fetchone()
        conn.commit()
        return result is not None
    finally:
        release_conn(conn)


def buy_item(user_id, shop_id, item_id, quantity):
    """
    Achat transactionnel : vérifie et diminue le stock, débite l'utilisateur,
    puis ajoute l'item à l'inventaire. Tout est fait en une seule transaction.

    Retourne (total_cost, nouveau_solde).

    Lève ValueError("ITEM_NOT_FOUND" | "ITEM_INACTIVE" | "STOCK_INSUFFICIENT" | "INSUFFICIENT_FUNDS").
    """
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Verrouille la ligne de l'item pour éviter les achats simultanés
        cursor.execute("""
            SELECT price, stock, active, name FROM items
            WHERE shop_id = %s AND item_id = %s
            FOR UPDATE
        """, (shop_id, item_id))
        row = cursor.fetchone()
        if not row:
            raise ValueError("ITEM_NOT_FOUND")
        price, stock, active, item_name = row

        if active != 1:
            raise ValueError("ITEM_INACTIVE")
        if stock != -1 and stock < quantity:
            raise ValueError("STOCK_INSUFFICIENT")

        total_cost = price * quantity

        # Vérifie et débite le solde
        cursor.execute("SELECT balance FROM users WHERE user_id = %s FOR UPDATE", (user_id,))
        balance_row = cursor.fetchone()
        balance = balance_row[0] if balance_row else 0
        if balance < total_cost:
            raise ValueError("INSUFFICIENT_FUNDS")

        cursor.execute("""
            INSERT INTO users (user_id, balance)
            VALUES (%s, 0)
            ON CONFLICT (user_id) DO NOTHING
        """, (user_id,))
        cursor.execute("UPDATE users SET balance = balance - %s WHERE user_id = %s", (total_cost, user_id))

        if stock != -1:
            cursor.execute("""
                UPDATE items SET stock = stock - %s
                WHERE shop_id = %s AND item_id = %s
            """, (quantity, shop_id, item_id))

        cursor.execute("""
            INSERT INTO user_items (user_id, shop_id, item_id, quantity)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, shop_id, item_id)
            DO UPDATE SET quantity = user_items.quantity + EXCLUDED.quantity
        """, (user_id, shop_id, item_id, quantity))

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, item_id, shop_id, item_name, quantity, details)
            VALUES (%s, 'purchase', %s, %s, %s, %s, %s, %s)
        """, (user_id, total_cost, item_id, shop_id, item_name, quantity, f"Achat de {quantity}x {item_name}"))

        conn.commit()
        logger.info("Achat réussi : user_id=%s a acheté %sx item_id=%s (shop %s) pour %s", user_id, quantity, item_id, shop_id, total_cost)
        return total_cost, balance - total_cost
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        release_conn(conn)


def sell_item(user_id, shop_id, item_id, quantity, resale_ratio=0.8):
    """
    Vente transactionnelle : retire l'item de l'inventaire, crédite l'utilisateur
    au prix de revente (par défaut 80%), et réapprovisionne le stock si fini.

    Retourne le montant gagné.

    Lève ValueError("ITEM_NOT_FOUND" | "NOT_ENOUGH_ITEMS").
    """
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT price, stock, name FROM items
            WHERE shop_id = %s AND item_id = %s AND active = 1
        """, (shop_id, item_id))
        row = cursor.fetchone()
        if not row:
            raise ValueError("ITEM_NOT_FOUND")
        price, stock, item_name = row
        resale_price = int(price * resale_ratio)

        cursor.execute("""
            SELECT quantity FROM user_items
            WHERE user_id = %s AND shop_id = %s AND item_id = %s
            FOR UPDATE
        """, (user_id, shop_id, item_id))
        inv = cursor.fetchone()
        if not inv or inv[0] < quantity:
            raise ValueError("NOT_ENOUGH_ITEMS")

        if inv[0] == quantity:
            cursor.execute("""
                DELETE FROM user_items
                WHERE user_id = %s AND shop_id = %s AND item_id = %s
            """, (user_id, shop_id, item_id))
        else:
            cursor.execute("""
                UPDATE user_items SET quantity = quantity - %s
                WHERE user_id = %s AND shop_id = %s AND item_id = %s
            """, (quantity, user_id, shop_id, item_id))

        if stock != -1:
            cursor.execute("""
                UPDATE items SET stock = stock + %s
                WHERE shop_id = %s AND item_id = %s
            """, (quantity, shop_id, item_id))

        cursor.execute("""
            INSERT INTO users (user_id, balance)
            VALUES (%s, 0)
            ON CONFLICT (user_id) DO NOTHING
        """, (user_id,))
        cursor.execute("UPDATE users SET balance = balance + %s WHERE user_id = %s", (resale_price * quantity, user_id))

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, item_id, shop_id, item_name, quantity, details)
            VALUES (%s, 'sale', %s, %s, %s, %s, %s, %s)
        """, (user_id, resale_price * quantity, item_id, shop_id, item_name, quantity, f"Vente de {quantity}x {item_name}"))

        conn.commit()
        logger.info("Vente réussie : user_id=%s a vendu %sx item_id=%s (shop %s) pour %s", user_id, quantity, item_id, shop_id, resale_price * quantity)
        return resale_price * quantity
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        release_conn(conn)


# Gestion des utilisateurs et balances
def get_balance(user_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM users WHERE user_id = %s", (user_id,))
        result = cursor.fetchone()
        return result[0] if result else 0
    finally:
        release_conn(conn)


def set_balance(user_id, amount):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (user_id, balance)
            VALUES (%s, %s)
            ON CONFLICT (user_id)
            DO UPDATE SET balance = EXCLUDED.balance
        """, (user_id, amount))

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'set_balance', %s, %s)
        """, (user_id, amount, f"Solde fixé à {amount}"))

        conn.commit()
    finally:
        release_conn(conn)


def update_balance(user_id, amount):
    conn = None
    try:
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
    finally:
        release_conn(conn)


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

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'transfer_out', %s, %s)
        """, (from_user_id, amount, f"Transfert vers l'utilisateur {to_user_id}"))
        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'transfer_in', %s, %s)
        """, (to_user_id, amount, f"Transfert reçu de l'utilisateur {from_user_id}"))

        conn.commit()
        logger.info("Transfert réussi : %s de %s à %s", amount, from_user_id, to_user_id)
        return True
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors du transfert d'argent de %s vers %s", from_user_id, to_user_id)
        raise
    finally:
        release_conn(conn)


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

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'add_money', %s, %s)
        """, (user_id, amount, f"Ajout admin de {amount}"))

        conn.commit()
        logger.info("Argent ajouté : %s à %s", amount, user_id)
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors de l'ajout d'argent à %s", user_id)
        raise
    finally:
        release_conn(conn)


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

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'remove_money', %s, %s)
        """, (user_id, amount, f"Retrait admin de {amount}"))

        conn.commit()
        logger.info("Argent retiré : %s de %s", amount, user_id)
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors du retrait d'argent de %s", user_id)
        raise
    finally:
        release_conn(conn)


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
        logger.info("Item ajouté : user_id=%s, shop_id=%s, item_id=%s, quantity=%s", user_id, shop_id, item_id, quantity)
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors de l'ajout de l'item : user_id=%s, item_id=%s", user_id, item_id)
        raise  # Relancer l'exception pour la capturer dans inventory.py
    finally:
        release_conn(conn)


def remove_user_item(user_id, shop_id, item_id, quantity=1):
    """
    Retire un item de l'inventaire d'un utilisateur.
    Lève ValueError("NOT_ENOUGH_ITEMS") si l'utilisateur ne possède pas assez d'exemplaires.
    """
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

        if not result or result[0] < quantity:
            raise ValueError("NOT_ENOUGH_ITEMS")

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
        logger.info("Item retiré : user_id=%s, shop_id=%s, item_id=%s, quantity=%s", user_id, shop_id, item_id, quantity)
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors de la suppression de l'item : user_id=%s, item_id=%s", user_id, item_id)
        raise  # Relancer l'exception pour la capturer dans inventory.py
    finally:
        release_conn(conn)


def get_user_inventory(user_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.name, ui.quantity, s.name as shop_name
            FROM user_items ui
            JOIN items i ON ui.item_id = i.item_id AND ui.shop_id = i.shop_id
            JOIN shops s ON ui.shop_id = s.shop_id
            WHERE ui.user_id = %s
        """, (user_id,))
        return cursor.fetchall()
    finally:
        release_conn(conn)


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

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'deposit', %s, %s)
        """, (user_id, amount, f"Dépôt de {amount} à la banque"))

        conn.commit()
        logger.info("Dépôt réussi : %s dans la banque de %s", amount, user_id)
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors du dépôt de %s pour %s", amount, user_id)
        raise
    finally:
        release_conn(conn)


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

        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, details)
            VALUES (%s, 'withdraw', %s, %s)
        """, (user_id, amount, f"Retrait de {amount} de la banque"))

        conn.commit()
        logger.info("Retrait réussi : %s de la banque de %s", amount, user_id)
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Erreur lors du retrait de %s pour %s", amount, user_id)
        raise
    finally:
        release_conn(conn)


def get_deposit(user_id):
    """Récupère le montant déposé à la banque par l'utilisateur."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT amount FROM bank_deposit WHERE user_id = %s", (user_id,))
        result = cursor.fetchone()
        return result[0] if result else 0
    except Exception:
        logger.exception("Erreur lors de la récupération du dépôt de %s", user_id)
        raise
    finally:
        release_conn(conn)


# Gestion des salaires
def assign_role_salary(role_id, salary, cooldown=3600):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO role_salaries (role_id, salary, cooldown)
            VALUES (%s, %s, %s)
            ON CONFLICT (role_id)
            DO UPDATE SET salary = EXCLUDED.salary, cooldown = EXCLUDED.cooldown
        """, (role_id, salary, cooldown))
        conn.commit()
    finally:
        release_conn(conn)


def get_role_salary(role_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT salary FROM role_salaries WHERE role_id = %s", (role_id,))
        result = cursor.fetchone()
        return result[0] if result else 0
    finally:
        release_conn(conn)


def get_all_roles_salaries():
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT role_id, salary, cooldown FROM role_salaries")
        return cursor.fetchall()
    finally:
        release_conn(conn)


# Gestion cooldowns salaire
def set_salary_cooldown(user_id):
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO salary_cooldowns (user_id, last_collect)
            VALUES (%s, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET last_collect = EXCLUDED.last_collect
        """, (user_id,))
        conn.commit()
    finally:
        release_conn(conn)


def get_salary_cooldown(user_id, role_ids):
    conn = None
    try:
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
        return remaining if remaining > 0 else 0
    finally:
        release_conn(conn)


def remove_role_salary(role_id):
    """Supprime complètement un rôle de la table role_salaries."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM role_salaries WHERE role_id = %s", (role_id,))
        conn.commit()
    finally:
        release_conn(conn)


# Créer les tables si elles n'existent pas (ne bloque pas le démarrage si la BDD est indisponible)
try:
    create_tables()
except Exception:
    logger.exception("Impossible d'initialiser les tables au démarrage, les commandes renverront une erreur tant que la BDD est inaccessible")


# ---------------------------------------------------------------
# Journalisation des transactions et aide pour l'administration web
# ---------------------------------------------------------------
def log_transaction(user_id, tx_type, amount=0, item_id=None, shop_id=None, item_name=None, quantity=None, details="", guild_id=None):
    """Insère une entrée dans le journal des transactions."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, item_id, shop_id, item_name, quantity, details, guild_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, tx_type, amount, item_id, shop_id, item_name, quantity, details, guild_id))
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        # Ne fait pas échouer l'action principale si la journalisation échoue
        logger.exception("Échec log_transaction (user=%s, type=%s)", user_id, tx_type)
    finally:
        release_conn(conn)


def get_transactions(limit=100, user_id=None, tx_type=None, guild_id=None):
    """
    Retourne les dernières transactions, filtrées optionnellement.
    Si guild_id est fourni : transactions de la guild + transactions globales (guild_id NULL).
    """
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        sql_query = """
            SELECT id, user_id, type, amount, item_id, shop_id, item_name,
                   quantity, details, created_at
            FROM transactions
        """
        conditions = []
        params = []
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        if tx_type:
            conditions.append("type = %s")
            params.append(tx_type)
        if guild_id is not None:
            conditions.append("(guild_id = %s OR guild_id IS NULL)")
            params.append(guild_id)
        if conditions:
            sql_query += " WHERE " + " AND ".join(conditions)
        sql_query += " ORDER BY id DESC LIMIT %s"
        params.append(limit)
        cursor.execute(sql_query, params)
        return cursor.fetchall()
    finally:
        release_conn(conn)


def add_audit_log(admin_id, action, target="", details=""):
    """Enregistre une action d'administration (audit)."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO audit_log (admin_id, action, target, details)
            VALUES (%s, %s, %s, %s)
        """, (admin_id, action, target, details))
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Échec add_audit_log (admin=%s, action=%s)", admin_id, action)
    finally:
        release_conn(conn)


def get_audit_logs(limit=100):
    """Retourne les dernières entrées du journal d'audit."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, admin_id, action, target, details, created_at
            FROM audit_log
            ORDER BY id DESC
            LIMIT %s
        """, (limit,))
        return cursor.fetchall()
    finally:
        release_conn(conn)


def list_users(query="", limit=50, offset=0):
    """Liste les utilisateurs (avec banque), triés par solde décroissant."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        if query:
            cursor.execute("""
                SELECT u.user_id, u.balance, COALESCE(b.amount, 0)
                FROM users u
                LEFT JOIN bank_deposit b ON u.user_id = b.user_id
                WHERE CAST(u.user_id AS TEXT) LIKE %s
                ORDER BY u.balance DESC
                LIMIT %s OFFSET %s
            """, (f"%{query}%", limit, offset))
        else:
            cursor.execute("""
                SELECT u.user_id, u.balance, COALESCE(b.amount, 0)
                FROM users u
                LEFT JOIN bank_deposit b ON u.user_id = b.user_id
                ORDER BY u.balance DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
        users = cursor.fetchall()

        cursor.execute("SELECT COUNT(*) FROM users")
        total = cursor.fetchone()[0]
        return users, total
    finally:
        release_conn(conn)


def get_stats():
    """Statistiques globales pour le dashboard."""
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]

        cursor.execute("SELECT COALESCE(SUM(balance), 0) FROM users")
        total_wallet = cursor.fetchone()[0]

        cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM bank_deposit")
        total_bank = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM transactions")
        tx_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM items WHERE active = 1")
        item_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM shops")
        shop_count = cursor.fetchone()[0]

        cursor.execute("""
            SELECT user_id, balance FROM users
            ORDER BY balance DESC
            LIMIT 5
        """)
        top_users = cursor.fetchall()

        return {
            "user_count": user_count,
            "total_wallet": total_wallet,
            "total_bank": total_bank,
            "total_balance": total_wallet + total_bank,
            "tx_count": tx_count,
            "item_count": item_count,
            "shop_count": shop_count,
            "top_users": [{"user_id": u[0], "balance": u[1]} for u in top_users],
        }
    finally:
        release_conn(conn)