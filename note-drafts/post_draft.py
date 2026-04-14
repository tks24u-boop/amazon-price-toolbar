#!/usr/bin/env python3
"""
Post a draft article to note.com.

Usage:
  1. Auto-login (requires reCAPTCHA v3 to work in the environment):
     python3 post_draft.py

  2. With pre-obtained session cookie:
     NOTE_SESSION_COOKIE="your_session_cookie_value" python3 post_draft.py

Environment variables:
  - note-secret: Password for note.com login
  - NOTE_SESSION_COOKIE: (optional) Pre-obtained _note_session_v5 cookie value

Note: note.com uses reCAPTCHA v3 for login. In cloud/headless environments
where Google blocks reCAPTCHA token generation, use the NOTE_SESSION_COOKIE
approach instead. You can obtain the cookie from a browser where you've
manually logged in to note.com (Developer Tools > Application > Cookies).
"""
import os
import sys
import time
import re
import json
import requests

ARTICLE_PATH = os.path.join(os.path.dirname(__file__), "2026-04-14-amazon-timesale-osusume.md")
EMAIL = "amasuki16142@gmail.com"
PASSWORD = os.environ.get("note-secret", "")
SESSION_COOKIE = os.environ.get("NOTE_SESSION_COOKIE", "")

TITLE = '【4/14】Amazonタイムセールで見つけた"地味にすごい"おすすめアイテム7選｜セール後こそ掘り出し物がある'

BASE_URL = "https://note.com"
CREATE_URL = f"{BASE_URL}/api/v1/text_notes"
DRAFT_SAVE_URL = f"{BASE_URL}/api/v1/text_notes/draft_save"

DEBUG_DIR = os.path.join(os.path.dirname(__file__), "debug")


def read_article():
    with open(ARTICLE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    lines = content.strip().split("\n")
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).strip()


def md_to_note_html(md_text):
    """Convert markdown body to HTML suitable for note.com's editor."""
    lines = md_text.split("\n")
    html_parts = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if stripped == "---":
            html_parts.append("<hr>")
        elif stripped.startswith("### "):
            html_parts.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith("## "):
            html_parts.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith("- "):
            items = []
            while i < len(lines) and lines[i].strip().startswith("- "):
                t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', lines[i].strip()[2:])
                items.append(f"<li>{t}</li>")
                i += 1
            html_parts.append(f"<ul>{''.join(items)}</ul>")
            continue
        elif re.match(r'^\d+\.\s', stripped):
            items = []
            while i < len(lines) and re.match(r'^\d+\.\s', lines[i].strip()):
                t = re.sub(r'^\d+\.\s', '', lines[i].strip())
                t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
                items.append(f"<li>{t}</li>")
                i += 1
            html_parts.append(f"<ol>{''.join(items)}</ol>")
            continue
        elif stripped.startswith("[") and "](" in stripped:
            m = re.match(r'\[(.+?)\]\((.+?)\)', stripped)
            if m:
                html_parts.append(f'<p><a href="{m.group(2)}">{m.group(1)}</a></p>')
            else:
                html_parts.append(f"<p>{stripped}</p>")
        elif stripped == "":
            pass
        else:
            html_parts.append(f"<p>{re.sub(r'[*][*](.+?)[*][*]', r'<b>\\1</b>', stripped)}</p>")
        i += 1
    return "\n".join(html_parts)


def create_session_with_cookie(cookie_value):
    """Create a requests session using a pre-obtained session cookie."""
    session = requests.Session()
    session.cookies.set("_note_session_v5", cookie_value, domain=".note.com", path="/")
    return session


def login_with_playwright():
    """Login using Playwright with mocked reCAPTCHA. Returns cookies or None."""
    from playwright.sync_api import sync_playwright

    MOCK_JS = """
    window.grecaptcha = {
        ready: function(cb) { setTimeout(cb, 10); },
        execute: function() { return Promise.resolve('mock_' + Date.now()); },
        render: function() { return 0; },
        reset: function() {},
        getResponse: function() { return 'mock'; },
        enterprise: {
            ready: function(cb) { setTimeout(cb, 10); },
            execute: function() { return Promise.resolve('mock_' + Date.now()); }
        }
    };
    """

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/local/bin/google-chrome",
            headless=False,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--lang=ja-JP"]
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.55 Safari/537.36",
            locale="ja-JP",
        )
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
        context.route("**/www.google.com/recaptcha/**",
                       lambda route: route.fulfill(status=200, content_type="application/javascript", body=MOCK_JS))
        context.route("**/www.gstatic.com/recaptcha/**",
                       lambda route: route.fulfill(status=200, content_type="application/javascript", body=MOCK_JS))

        page = context.new_page()

        login_success = False
        def on_response(response):
            nonlocal login_success
            if 'sign_in' in response.url:
                try:
                    body = response.json()
                    if response.status in (200, 201) and 'error' not in body:
                        login_success = True
                except Exception:
                    pass

        page.on("response", on_response)

        try:
            page.goto("https://note.com/login", wait_until="networkidle")
            time.sleep(5)

            email_field = page.locator("input[placeholder*='example.com'], input[placeholder*='note ID']")
            email_field.click()
            time.sleep(0.5)
            page.keyboard.type(EMAIL, delay=50)
            time.sleep(1)

            pw_field = page.locator("input[type='password']")
            pw_field.click()
            time.sleep(0.5)
            page.keyboard.type(PASSWORD, delay=60)
            time.sleep(3)

            login_btn = page.locator("button:has-text('ログイン')").last
            login_btn.click(force=True)
            time.sleep(15)

            if login_success:
                cookies = context.cookies()
                return cookies
            else:
                return None
        finally:
            browser.close()


def post_draft_via_api(session, title, body_html):
    """Create a note and save as draft via API."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": "https://note.com/notes/new",
        "Origin": "https://note.com",
    }

    print(f"  Creating note ({len(body_html)} chars)...")
    resp = session.post(CREATE_URL, json={"name": title, "body": body_html}, headers=headers)
    print(f"  Status: {resp.status_code}")
    print(f"  Response: {resp.text[:500]}")

    if resp.status_code not in (200, 201):
        return None, None

    data = resp.json()
    if "error" in data:
        print(f"  Error: {data['error']}")
        return None, None

    nd = data.get("data", data)
    note_id = nd.get("id")
    note_key = nd.get("key", "")

    if not note_id:
        print("  No note ID in response")
        return None, None

    print(f"  Note created: id={note_id}, key={note_key}")

    print(f"  Saving draft...")
    resp2 = session.post(
        f"{DRAFT_SAVE_URL}?id={note_id}&is_temp_saved=true",
        json={
            "body": body_html,
            "body_length": len(body_html),
            "name": title,
            "index": False,
            "is_lead_form": False,
        },
        headers=headers
    )
    print(f"  Draft save status: {resp2.status_code}")

    if resp2.status_code in (200, 201, 204):
        return note_id, note_key
    else:
        print(f"  Draft save response: {resp2.text[:300]}")
        return note_id, note_key


def main():
    if not PASSWORD and not SESSION_COOKIE:
        print("ERROR: Either note-secret or NOTE_SESSION_COOKIE must be set!")
        sys.exit(1)

    os.makedirs(DEBUG_DIR, exist_ok=True)
    print(f"Email: {EMAIL}")
    print(f"Password set: {'yes' if PASSWORD else 'no'}")
    print(f"Session cookie set: {'yes' if SESSION_COOKIE else 'no'}")
    print()

    session = None

    if SESSION_COOKIE:
        print("[AUTH] Using pre-obtained session cookie...")
        session = create_session_with_cookie(SESSION_COOKIE)
    elif PASSWORD:
        print("[AUTH] Attempting Playwright login...")
        cookies = login_with_playwright()
        if cookies:
            session = requests.Session()
            for c in cookies:
                session.cookies.set(c['name'], c['value'],
                                    domain=c.get('domain', '.note.com'),
                                    path=c.get('path', '/'))
            print("[AUTH] Login successful!")
        else:
            print("[AUTH] Login failed (reCAPTCHA v3 blocked in this environment).")
            print("[AUTH] To proceed, set NOTE_SESSION_COOKIE environment variable.")
            print("[AUTH] Get it from your browser: DevTools > Application > Cookies > _note_session_v5")
            sys.exit(1)

    body_md = read_article()
    body_html = md_to_note_html(body_md)

    print(f"\nTitle: {TITLE}")
    print(f"Body: {len(body_html)} chars")
    print()

    note_id, note_key = post_draft_via_api(session, TITLE, body_html)

    if note_id:
        print(f"\n=== SUCCESS: Draft posted to note.com! ===")
        if note_key:
            print(f"URL: https://note.com/amasuki/n/{note_key}")
        print(f"Note ID: {note_id}")
    else:
        print("\n=== FAILED to post draft ===")
        sys.exit(1)


if __name__ == "__main__":
    main()
