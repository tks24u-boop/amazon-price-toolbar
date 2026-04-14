#!/usr/bin/env python3
"""
note.com draft posting using Cookie-based authentication.

Usage:
  1. Log in to note.com in your browser
  2. Open DevTools (F12) → Application → Cookies → note.com
  3. Copy the value of '_note_session_v5' cookie
  4. Set it as environment variable: export NOTE_SESSION_COOKIE="your_cookie_value"
  5. Run: python3 post_with_cookie.py

The script will:
  - Create a new text note (POST /api/v1/text_notes)
  - Save it as draft (POST /api/v1/text_notes/draft_save)
"""
import os
import sys
import re
import json
import requests

SESSION_COOKIE = os.environ.get("NOTE_SESSION_COOKIE", "")
if not SESSION_COOKIE:
    print("ERROR: NOTE_SESSION_COOKIE environment variable is not set")
    print("Please log in to note.com in your browser and copy the '_note_session_v5' cookie value.")
    sys.exit(1)

TITLE = '【4/14】Amazonタイムセールで見つけた"地味にすごい"おすすめアイテム7選｜セール後こそ掘り出し物がある'
ARTICLE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "2026-04-14-amazon-timesale-osusume.md")
HASHTAGS = [
    "Amazon", "タイムセール", "おすすめ", "買ってよかった", "ガジェット",
    "モニター", "モバイルバッテリー", "ワイヤレスイヤホン", "GW", "ゴールデンウィーク",
    "QOL", "生活改善", "暮らし", "一人暮らし", "Amazon購入品"
]

BASE_URL = "https://note.com/api"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=utf-8",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
}


def get_session():
    session = requests.Session()
    session.cookies.set("_note_session_v5", SESSION_COOKIE, domain="note.com", path="/")
    session.headers.update(HEADERS)
    return session


def check_auth(session):
    resp = session.get(f"{BASE_URL}/v1/current_user", params={"additionals": "true"})
    if resp.status_code == 200:
        data = resp.json()
        if "data" in data:
            user = data["data"]
            print(f"Logged in as: {user.get('nickname', '?')} (@{user.get('urlname', '?')})")
            return True
    print(f"Auth check failed: {resp.status_code} {resp.text[:200]}")
    return False


def load_article():
    with open(ARTICLE_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
    body_lines = lines[1:]
    while body_lines and body_lines[0].strip() == "":
        body_lines = body_lines[1:]
    return "".join(body_lines)


def markdown_to_note_body(md_text):
    """Convert markdown to note.com's body format (simplified HTML)."""
    lines = md_text.strip().split("\n")
    body_parts = []

    content_lines = []
    for line in lines:
        s = line.strip()
        if s.startswith("#") and not s.startswith("##"):
            words = s.split()
            if all(w.startswith("#") and len(w) > 1 for w in words):
                continue
        content_lines.append(line)

    for line in content_lines:
        s = line.strip()
        if not s:
            body_parts.append({"type": "p", "text": ""})
        elif s.startswith("### "):
            body_parts.append({"type": "h3", "text": s[4:]})
        elif s.startswith("## "):
            body_parts.append({"type": "h2", "text": s[3:]})
        elif s.startswith("---"):
            body_parts.append({"type": "hr"})
        elif s.startswith("- "):
            body_parts.append({"type": "p", "text": "・" + format_inline(s[2:])})
        elif re.match(r'^\d+\.\s', s):
            body_parts.append({"type": "p", "text": format_inline(s)})
        elif s.startswith("[") and "](" in s:
            m = re.match(r'\[([^\]]+)\]\(([^)]+)\)', s)
            if m:
                body_parts.append({"type": "embed", "url": m.group(2), "text": m.group(1)})
            else:
                body_parts.append({"type": "p", "text": format_inline(s)})
        else:
            body_parts.append({"type": "p", "text": format_inline(s)})

    return body_parts


def format_inline(text):
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', text)
    return text


def create_note(session, title, body_text):
    """Step 1: Create a new text note entry."""
    data = {
        "name": title,
        "body": body_text[:200],
    }
    resp = session.post(f"{BASE_URL}/v1/text_notes", json=data)
    print(f"Create note: {resp.status_code}")
    if resp.status_code in (200, 201):
        result = resp.json()
        note_id = result.get("data", {}).get("id")
        print(f"Note ID: {note_id}")
        return note_id
    else:
        print(f"Error: {resp.text[:500]}")
        return None


def save_draft(session, note_id, title, body_text):
    """Step 2: Save the note as draft with full content."""
    data = {
        "name": title,
        "body": body_text,
        "body_length": len(body_text),
        "index": False,
        "is_lead_form": False,
    }
    resp = session.post(
        f"{BASE_URL}/v1/text_notes/draft_save",
        params={"id": note_id, "is_temp_saved": "true"},
        json=data
    )
    print(f"Draft save: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        note_key = result.get("data", {}).get("key", "")
        print(f"Draft saved! Key: {note_key}")
        if note_key:
            print(f"Draft URL: https://note.com/notes/{note_key}/edit")
        return True
    else:
        print(f"Error: {resp.text[:500]}")
        return False


def main():
    print("=" * 60)
    print("note.com Draft Posting (Cookie-based)")
    print("=" * 60)

    session = get_session()

    print("\n[1] Checking authentication...")
    if not check_auth(session):
        print("FAILED: Not authenticated. Please check your cookie.")
        sys.exit(1)

    print("\n[2] Loading article...")
    body_text = load_article()
    print(f"Article loaded: {len(body_text)} chars")

    print("\n[3] Creating new note...")
    note_id = create_note(session, TITLE, body_text)
    if not note_id:
        print("FAILED: Could not create note")
        sys.exit(1)

    print("\n[4] Saving as draft...")
    if save_draft(session, note_id, TITLE, body_text):
        print("\n" + "=" * 60)
        print("DONE! Draft saved successfully.")
        print("=" * 60)
    else:
        print("FAILED: Could not save draft")
        sys.exit(1)


if __name__ == "__main__":
    main()
