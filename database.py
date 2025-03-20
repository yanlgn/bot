import sqlite3

# Connexion à la base de données SQLite
def get_db_connection():
    conn = sqlite3.connect('economy.db')  # Remplace 'economy.db' par le nom de ta base de données
    conn.row_factory = sqlite3.Row
    return conn

# Créer les tables nécessaires
def create_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Créer une table pour les utilisateurs (solde)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        balance INTEGER DEFAULT 0
    )
    ''')

    # Créer une table pour les salaires des rôles
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS role_salaries (
        role_id INTEGER PRIMARY KEY,
        salary INTEGER
    )
    ''')

    conn.commit()
    conn.close()

# Fonction pour récupérer le solde d'un utilisateur
def get_balance(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result['balance'] if result else 0

# Fonction pour mettre à jour le solde d'un utilisateur
def update_balance(user_id, amount):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()

    if result:
        new_balance = result['balance'] + amount
        cursor.execute('UPDATE users SET balance = ? WHERE user_id = ?', (new_balance, user_id))
    else:
        cursor.execute('INSERT INTO users (user_id, balance) VALUES (?, ?)', (user_id, amount))

    conn.commit()
    conn.close()

# Fonction pour attribuer un salaire à un rôle
def assign_role_salary(role_id, salary):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO role_salaries (role_id, salary) VALUES (?, ?)', (role_id, salary))
    conn.commit()
    conn.close()

# Fonction pour obtenir le salaire d'un rôle
def get_role_salary(role_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT salary FROM role_salaries WHERE role_id = ?', (role_id,))
    result = cursor.fetchone()
    conn.close()
    return result['salary'] if result else 0

# Fonction pour récupérer tous les salaires des rôles
def get_all_roles_salaries():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT role_id, salary FROM role_salaries')
    result = cursor.fetchall()
    conn.close()
    return result
