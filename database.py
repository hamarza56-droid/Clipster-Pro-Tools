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

    # TASKS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        username TEXT,
        status TEXT,
        pages TEXT,
        limit_count INTEGER,
        created_at TEXT,
        progress INTEGER DEFAULT 0,
        current_page INTEGER DEFAULT 0,
        logs TEXT DEFAULT '',
        cancelled INTEGER DEFAULT 0
    )
    """)

    # RESULTS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        reel_url TEXT,
        duration REAL
    )
    """)

    # CAMPAIGNS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        reward REAL,
        platform TEXT,
        description TEXT,
        active INTEGER DEFAULT 1
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


# ================= CAMPAIGNS =================

def get_campaigns():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM campaigns ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_campaign(name, reward, platform, description):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO campaigns(name, reward, platform, description)
        VALUES (?, ?, ?, ?)
    """, (name, reward, platform, description))
    conn.commit()
    conn.close()
