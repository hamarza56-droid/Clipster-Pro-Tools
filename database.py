import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

DB_NAME = "clipster.db"

def get_connection():
    return sqlite3.connect(DB_NAME)

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # TASKS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        status TEXT,
        pages TEXT,
        limit_count INTEGER,
        created_at TEXT
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

    # USERS (NEW)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
    """)

    conn.commit()
    conn.close()


# ================= USERS =================

def create_user(username, password):
    conn = get_connection()
    cur = conn.cursor()

    hashed = generate_password_hash(password)

    cur.execute("""
    INSERT INTO users (username, password)
    VALUES (?,?)
    """, (username, hashed))

    conn.commit()
    conn.close()


def get_user(username):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT id, username, password
    FROM users
    WHERE username=?
    """, (username,))

    user = cur.fetchone()
    conn.close()
    return user


def verify_user(username, password):
    user = get_user(username)
    if not user:
        return False

    return check_password_hash(user[2], password)