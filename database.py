import sqlite3

DB_NAME = "clipster.db"


def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)


def init_db():
    conn = get_connection()
    cur = conn.cursor()

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

    return [
        {
            "task_id": r[0],
            "username": r[1],
            "status": r[2],
            "pages": r[3],
            "limit": r[4],
            "created_at": r[5],
            "progress": r[6],
            "current_page": r[7],
            "logs": r[8],
            "cancelled": r[9]
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
    """)

    rows = cur.fetchall()
    conn.close()

    return rows
