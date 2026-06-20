import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

DB_NAME = "clipster.db"


def get_connection():
    return sqlite3.connect(DB_NAME)


# ================= INIT DB =================

def init_db():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        api_key TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        username TEXT,
        status TEXT,
        pages TEXT,
        limit_count INTEGER,
        created_at TEXT,
        cancelled INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        current_page TEXT
    )
    """)

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

def create_user(username, password):
    conn = get_connection()
    cur = conn.cursor()

    hashed = generate_password_hash(password)

    cur.execute("""
    INSERT INTO users(username,password)
    VALUES (?,?)
    """, (username, hashed))

    conn.commit()
    conn.close()


def get_user(username):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT username,password
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

    return check_password_hash(user[1], password)


# ================= TASKS =================

def save_task(task_id, username, status, pages, limit_count, created_at):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO tasks
    (task_id, username, status, pages, limit_count, created_at, cancelled, progress, current_page)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, '')
    """, (task_id, username, status, pages, limit_count, created_at))

    conn.commit()
    conn.close()


def update_task_status(task_id, status):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE tasks
    SET status=?
    WHERE task_id=?
    """, (status, task_id))

    conn.commit()
    conn.close()


def update_progress(task_id, progress, current_page=""):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE tasks
    SET progress=?, current_page=?
    WHERE task_id=?
    """, (progress, current_page, task_id))

    conn.commit()
    conn.close()


def cancel_task_flag(task_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE tasks
    SET cancelled=1, status='cancelled'
    WHERE task_id=?
    """, (task_id,))

    conn.commit()
    conn.close()


# ================= TASK FETCH =================

def get_all_tasks():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT task_id, username, status, pages, limit_count, created_at, cancelled, progress, current_page
    FROM tasks
    ORDER BY created_at DESC
    """)

    rows = cur.fetchall()
    conn.close()

    return [
        {
            "task_id": r[0],
            "username": r[1],
            "status": r[2],
            "pages": r[3],
            "limit": r[4],
            "created_at": r[5],
            "cancelled": r[6],
            "progress": r[7],
            "current_page": r[8]
        }
        for r in rows
    ]


def get_task_info(task_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT *
    FROM tasks
    WHERE task_id=?
    """, (task_id,))

    row = cur.fetchone()
    conn.close()
    return row


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
    ORDER BY duration DESC
    """)

    rows = cur.fetchall()
    conn.close()

    return [
        {"url": r[0], "duration": r[1]}
        for r in rows
    ]
