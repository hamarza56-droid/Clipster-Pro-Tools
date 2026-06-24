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
        role TEXT DEFAULT 'user'
    )
    """)

    # TASKS (BACKGROUND CHANGER)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        username TEXT,
        status TEXT,
        progress INTEGER DEFAULT 0,
        created_at TEXT,
        background TEXT
    )
    """)

    # RESULTS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        output_zip TEXT
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
        SELECT * FROM users WHERE username=? AND password=?
    """, (username, password_hash))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def update_progress(task_id, progress):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE tasks SET progress=? WHERE task_id=?
    """, (progress, task_id))
    conn.commit()
    conn.close()


def save_task(task_id, username, background, created_at):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tasks(task_id, username, status, progress, created_at, background)
        VALUES (?, ?, 'queued', 0, ?, ?)
    """, (task_id, username, created_at, background))
    conn.commit()
    conn.close()


def update_task_status(task_id, status):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE tasks SET status=? WHERE task_id=?
    """, (status, task_id))
    conn.commit()
    conn.close()


def save_result(task_id, zip_path):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO results(task_id, output_zip)
        VALUES (?, ?)
    """, (task_id, zip_path))
    conn.commit()
    conn.close()


def get_history(username):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM tasks WHERE username=? ORDER BY created_at DESC
    """, (username,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]
