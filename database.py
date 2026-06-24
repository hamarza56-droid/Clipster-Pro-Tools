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

    # TASKS (FIXED)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        username TEXT,
        status TEXT,
        pages TEXT,
        limit_count INTEGER,
        created_at TEXT,
        progress INTEGER DEFAULT 0,
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

    # HISTORY (NEW)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        username TEXT,
        created_at TEXT,
        total_reels INTEGER
    )
    """)

    conn.commit()
    conn.close()

# ================= USERS =================

def create_user(username, password, api_key, role="user"):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users(username, password, api_key, role) VALUES (?, ?, ?, ?)",
        (username, password, api_key, role)
    )
    conn.commit()
    conn.close()


def get_user(username, password_hash):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (username, password_hash)
    )
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

# ================= TASK SYSTEM =================

def create_task(task_id, username, pages, limit):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tasks(task_id, username, status, pages, limit_count, created_at, progress)
        VALUES (?, ?, ?, ?, ?, datetime('now'), 0)
    """, (task_id, username, "pending", str(pages), limit))
    conn.commit()
    conn.close()


def get_task(task_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tasks WHERE task_id=?", (task_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_tasks():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_progress(task_id, progress):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE tasks SET progress=? WHERE task_id=?", (progress, task_id))
    conn.commit()
    conn.close()


def push_result(task_id, reel_url, duration):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO results(task_id, reel_url, duration) VALUES (?, ?, ?)",
        (task_id, reel_url, duration)
    )
    conn.commit()
    conn.close()


def get_results(task_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM results WHERE task_id=?", (task_id,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_history(task_id, username, total):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO history(task_id, username, created_at, total_reels)
        VALUES (?, ?, datetime('now'), ?)
    """, (task_id, username, total))
    conn.commit()
    conn.close()


def get_history(username):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM history WHERE username=? ORDER BY created_at DESC", (username,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]
