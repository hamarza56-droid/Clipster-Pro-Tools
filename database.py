import sqlite3

DB_NAME = "clipster.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # USERS TABLE (FIX FOR LOGIN CRASH)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        api_key TEXT
    )
    """)

    # TASKS TABLE (QUEUE + PROGRESS + CANCEL)
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

    # RESULTS TABLE
    cur.execute("""
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        reel_url TEXT,
        duration REAL
    )
    """)

    conn.commit()
    conn.close()


# ================= USERS =================

def create_user(username, password, api_key):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users(username, password, api_key)
        VALUES (?, ?, ?)
    """, (username, password, api_key))
    conn.commit()
    conn.close()


def get_user(username, password_hash):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT api_key FROM users
        WHERE username=? AND password=?
    """, (username, password_hash))

    user = cur.fetchone()
    conn.close()
    return user


# ================= TASKS =================

def save_task(task_id, username, status, pages, limit_count, created_at):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO tasks(task_id, username, status, pages, limit_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (task_id, username, status, pages, limit_count, created_at))

    conn.commit()
    conn.close()


def get_all_tasks():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_task_info(task_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM tasks WHERE task_id=?", (task_id,))
    row = cur.fetchone()

    conn.close()
    return dict(row) if row else None


def update_progress(task_id, progress, page_index, logs):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE tasks
    SET progress=?, current_page=?, logs=?
    WHERE task_id=?
    """, (progress, page_index, logs, task_id))

    conn.commit()
    conn.close()


def cancel_task(task_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE tasks SET cancelled=1, status='cancelled'
    WHERE task_id=?
    """, (task_id,))

    conn.commit()
    conn.close()


# ================= RESULTS =================

def save_result(task_id, reel_url, duration):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO results(task_id, reel_url, duration)
    VALUES (?, ?, ?)
    """, (task_id, reel_url, duration))

    conn.commit()
    conn.close()


def get_task_results(task_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT reel_url, duration
    FROM results
    WHERE task_id=?
    """, (task_id,))

    rows = cur.fetchall()
    conn.close()

    return [dict(row) for row in rows]
