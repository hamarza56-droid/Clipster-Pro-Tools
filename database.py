import sqlite3

DB_NAME = "clipster.db"

def get_connection():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        api_key TEXT,
        role TEXT DEFAULT 'user',
        tools TEXT DEFAULT 'all'
    )
    """)

    conn.commit()
    conn.close()

# ================= USERS =================

def create_user(username, password, api_key, role="user"):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO users(username, password, api_key, role)
        VALUES (?, ?, ?, ?)
    """, (username, password, api_key, role))

    conn.commit()
    conn.close()

def get_user(username, password_hash):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM users
        WHERE username=? AND password=?
    """, (username, password_hash))

    row = cur.fetchone()
    conn.close()

    return dict(row) if row else None

def get_all_users():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, username, role, tools FROM users")
    rows = cur.fetchall()

    conn.close()
    return [dict(r) for r in rows]

def update_user_role(username, role):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("UPDATE users SET role=? WHERE username=?", (role, username))

    conn.commit()
    conn.close()

# ================= OPTIONAL DEBUG =================

def ensure_admin_exists():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE username='Kaelrix'")
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO users(username, password, api_key, role)
            VALUES (?, ?, ?, ?)
        """, ("Kaelrix", "", "ADMIN", "admin"))

    conn.commit()
    conn.close()
