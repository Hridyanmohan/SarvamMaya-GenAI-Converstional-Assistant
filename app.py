from flask import Flask, request, jsonify, render_template
from model import groq_response
import sqlite3
import time
import uuid

app = Flask(__name__)

DATABASE = "chat_history.db"


# =========================================================
# DATABASE
# =========================================================

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY (thread_id)
                REFERENCES threads(id)
                ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


init_db()


# =========================================================
# SYSTEM PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are Sarvam Maya, a helpful, intelligent, accurate, and adaptive AI assistant.

Your response style should depend on the user's request.

1. SIMPLE QUESTIONS
For greetings, simple facts, definitions, or yes/no questions:
Give a short and direct answer.

2. NORMAL QUESTIONS
For conceptual questions, explanations, how-to questions, and summaries:
Give a clear answer with useful structure and moderate detail.

3. COMPLEX QUESTIONS
For programming, troubleshooting, detailed guides, comparisons,
technical explanations, or requests for comprehensive information:
Give a detailed and well-structured answer.

Use Markdown when it improves readability.

For programming questions:
- Explain important parts clearly.
- Use proper code blocks.
- Provide practical, copy-paste-ready solutions.
- Do not unnecessarily shorten code.

Avoid unnecessary conversational filler.

Always answer the user's actual question directly.
"""


# =========================================================
# HOME PAGE
# =========================================================

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


# =========================================================
# THREADS
# =========================================================

@app.route("/threads", methods=["GET"])
def get_threads():

    conn = get_db()

    threads = conn.execute("""
        SELECT id, title
        FROM threads
        ORDER BY timestamp DESC
    """).fetchall()

    conn.close()

    return jsonify([
        {
            "id": thread["id"],
            "title": thread["title"]
        }
        for thread in threads
    ])


# =========================================================
# GET THREAD MESSAGES
# =========================================================

@app.route("/threads/<thread_id>/messages", methods=["GET"])
def get_messages(thread_id):

    conn = get_db()

    messages = conn.execute("""
        SELECT role, content
        FROM messages
        WHERE thread_id = ?
        ORDER BY id ASC
    """, (thread_id,)).fetchall()

    conn.close()

    return jsonify([
        {
            "role": message["role"],
            "content": message["content"]
        }
        for message in messages
    ])


# =========================================================
# DELETE THREAD
# =========================================================

@app.route("/threads/<thread_id>", methods=["DELETE"])
def delete_thread(thread_id):

    conn = get_db()

    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM messages
        WHERE thread_id = ?
    """, (thread_id,))

    cursor.execute("""
        DELETE FROM threads
        WHERE id = ?
    """, (thread_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "status": "success"
    })


# =========================================================
# GENERATE AI RESPONSE
# =========================================================

@app.route("/generate", methods=["POST"])
def generate():

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "error": "Invalid JSON request."
        }), 400

    user_message = data.get("message", "").strip()
    thread_id = data.get("thread_id")

    if not user_message:
        return jsonify({
            "error": "Message cannot be empty."
        }), 400

    conn = get_db()

    cursor = conn.cursor()

    try:

        # =================================================
        # CREATE OR VALIDATE THREAD
        # =================================================

        if not thread_id:

            thread_id = str(uuid.uuid4())

            title = (
                user_message[:40] + "..."
                if len(user_message) > 40
                else user_message
            )

            cursor.execute("""
                INSERT INTO threads (
                    id,
                    title
                )
                VALUES (?, ?)
            """, (
                thread_id,
                title
            ))

        else:

            existing_thread = cursor.execute("""
                SELECT id
                FROM threads
                WHERE id = ?
            """, (thread_id,)).fetchone()

            if not existing_thread:

                conn.close()

                return jsonify({
                    "error": "Conversation thread not found."
                }), 404


        # =================================================
        # GET PREVIOUS CONVERSATION
        # =================================================

        past_turns = cursor.execute("""
            SELECT role, content
            FROM messages
            WHERE thread_id = ?
            ORDER BY id ASC
        """, (thread_id,)).fetchall()


        conversation = []

        # Keep latest 12 messages
        for message in past_turns[-12:]:

            conversation.append({
                "role": message["role"],
                "content": message["content"]
            })


        # Add current user message
        conversation.append({
            "role": "user",
            "content": user_message
        })


        # =================================================
        # SAVE USER MESSAGE
        # =================================================

        cursor.execute("""
            INSERT INTO messages (
                thread_id,
                role,
                content
            )
            VALUES (?, ?, ?)
        """, (
            thread_id,
            "user",
            user_message
        ))


        # =================================================
        # CALL LLAMA
        # =================================================

        start_time = time.time()

        result = groq_response(
            SYSTEM_PROMPT,
            conversation
        )

        ai_response_text = result["response_text"].strip()

        duration = round(
            time.time() - start_time,
            3
        )


        if not ai_response_text:

            raise RuntimeError(
                "The model returned an empty response."
            )


        # =================================================
        # SAVE ASSISTANT MESSAGE
        # =================================================

        cursor.execute("""
            INSERT INTO messages (
                thread_id,
                role,
                content
            )
            VALUES (?, ?, ?)
        """, (
            thread_id,
            "assistant",
            ai_response_text
        ))


        # =================================================
        # UPDATE THREAD TIMESTAMP
        # =================================================

        cursor.execute("""
            UPDATE threads
            SET timestamp = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (thread_id,))


        conn.commit()


        return jsonify({
            "response_text": ai_response_text,
            "thread_id": thread_id,
            "duration": duration
        })


    except Exception as e:

        conn.rollback()

        print("ERROR:", repr(e))

        return jsonify({
            "error": str(e)
        }), 500


    finally:

        conn.close()


# =========================================================
# RUN APPLICATION
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True,
        host="0.0.0.0",
        port=5000
    )