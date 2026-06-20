import sqlite3

DB_NAME = "clipster.db"


def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        api_key TEXT
    )
    """)

    # TASKS (QUEUE SYSTEM)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        username TEXT,
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

    conn.commit()
    conn.close()


# ================= TASK HELPERS =================

def save_task(task_id, username, status, pages, limit_count, created_at):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)
    """, (task_id, username, status, pages, limit_count, created_at))

    conn.commit()
    conn.close()


def get_all_tasks():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT * FROM tasks ORDER BY created_at DESC
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
            "created_at": r[5]
        }
        for r in rows
    ]


def get_task_info(task_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM tasks WHERE task_id=?", (task_id,))
    row = cur.fetchone()

    conn.close()
    return row


def update_task_status(task_id, status):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE tasks SET status=? WHERE task_id=?
    """, (status, task_id))

    conn.commit()
    conn.close()


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

    return rows
