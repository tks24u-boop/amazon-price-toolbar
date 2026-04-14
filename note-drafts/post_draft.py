#!/usr/bin/env python3
"""
note.com に下書きを投稿するスクリプト。

【動作方式】
1. 環境変数 NOTE_SESSION_COOKIE にセッションクッキー(_note_session_v5)が
   設定されている場合は、それを使って直接 note API にアクセスする。
2. 設定されていない場合、Playwright + Google Chrome で自動ログインを試みる。
   ただし AWS IP からは note.com が 403 を返すため、
   NOTE_SESSION_COOKIE を手動設定することを推奨する。

【NOTE_SESSION_COOKIE の取得方法】
1. ブラウザで https://note.com にログイン
2. DevTools > Application > Cookies > https://note.com
3. `_note_session_v5` の値をコピー
4. Cursor Dashboard > Cloud Agents > Secrets に
   キー名 `NOTE_SESSION_COOKIE` として登録

【環境変数】
- NOTE_PASSWORD or note-secret : note.com のパスワード（自動ログイン用）
- NOTE_SESSION_COOKIE           : 手動取得したセッションクッキー（推奨）
"""
import os
import sys
import json
import time
import pathlib
import re
import requests

EMAIL = "amasuki16142@gmail.com"
PASSWORD = os.environ.get("NOTE_PASSWORD") or os.environ.get("note-secret", "")
SESSION_COOKIE = os.environ.get("NOTE_SESSION_COOKIE", "")
ARTICLE_PATH = pathlib.Path(__file__).parent / "2026-04-14-amazon-timesale-osusume.md"
TITLE = '【4/14】Amazonタイムセールで見つけた\u201c地味にすごい\u201dおすすめアイテム7選｜セール後こそ掘り出し物がある'

NOTE_API_BASE = "https://note.com"


def build_session(cookies: dict) -> requests.Session:
    """クッキーからrequestsセッションを構築する。"""
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ja,ja-JP;q=0.9",
        "Origin": "https://note.com",
        "Referer": "https://note.com/",
        "X-Requested-With": "XMLHttpRequest",
    })
    for name, value in cookies.items():
        s.cookies.set(name, value, domain=".note.com")
    return s


def login_with_playwright() -> dict:
    """Playwright + Google Chrome でログインしてクッキーを返す。
    AWS IP などでブロックされる場合は空dictを返す。"""
    try:
        from playwright.sync_api import sync_playwright
        from undetected_playwright import stealth_sync
    except ImportError:
        print("  Playwright not available.")
        return {}

    cookies = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/local/bin/google-chrome",
            headless=False,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--window-size=1280,800",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = browser.new_context(
            locale="ja-JP",
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        )
        context.add_init_script("""
            delete Object.getPrototypeOf(navigator).webdriver;
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            if (!window.chrome) window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US', 'en'] });
        """)
        page = context.new_page()

        sign_in_status = [None]
        sign_in_body = [None]

        def intercept(route):
            resp = route.fetch()
            if "sign_in" in route.request.url:
                sign_in_status[0] = resp.status
                sign_in_body[0] = resp.text()
            route.fulfill(response=resp)

        context.route("**/api/v1/sessions/sign_in", intercept)

        page.goto("https://note.com/login", wait_until="networkidle", timeout=30000)
        time.sleep(3)

        page.evaluate(f"""
            async () => {{
                const mainEl = document.querySelector('.o-login');
                if (!mainEl || !mainEl.__vue__) return;
                const vm = mainEl.__vue__.$children[0].$children[0];
                if (!vm) return;
                vm.email = {json.dumps(EMAIL)};
                vm.password = {json.dumps(PASSWORD)};
                vm.showRecaptchaV2 = false;
                vm.getRecaptchaTokenV3 = async () => '';
                await vm.loginWithEmail();
            }}
        """)
        time.sleep(5)

        if sign_in_status[0] == 200 and "login" not in page.url:
            print(f"  ✅ 自動ログイン成功: {page.url}")
            for c in context.cookies():
                cookies[c["name"]] = c["value"]
        else:
            print(f"  ❌ 自動ログイン失敗: HTTP {sign_in_status[0]}")
            if sign_in_body[0]:
                print(f"  レスポンス: {sign_in_body[0][:200]}")

        browser.close()
    return cookies


def verify_session(session: requests.Session) -> bool:
    """セッションが有効かどうかを確認する。"""
    r = session.get(f"{NOTE_API_BASE}/api/v1/stats/pv?context=top")
    if r.status_code == 200:
        return True
    # ユーザー情報を取得して確認
    r2 = session.get(f"{NOTE_API_BASE}/api/v2/users/amasuki")
    return r2.status_code == 200


def create_draft(session: requests.Session, title: str, body: str) -> dict:
    """note API で下書き記事を作成する。"""
    # まず新規テキスト記事のエンドポイントを探す
    # note の記事作成 API エンドポイント候補
    endpoints = [
        f"{NOTE_API_BASE}/api/v1/text_notes",
        f"{NOTE_API_BASE}/api/v2/text_notes",
        f"{NOTE_API_BASE}/api/v3/notes",
    ]

    payload_v1 = {
        "draft": True,
        "name": title,
        "body": body,
        "can_read_stats": True,
        "is_limited_for_member": False,
        "price": 0,
        "notice_premium_status": False,
        "status": "draft",
    }

    for endpoint in endpoints:
        r = session.post(
            endpoint,
            json=payload_v1,
            headers={"Content-Type": "application/json"},
        )
        print(f"  POST {endpoint}: HTTP {r.status_code}")
        if r.status_code in (200, 201):
            return r.json()
        elif r.status_code not in (404, 405):
            print(f"    Response: {r.text[:300]}")

    return {}


def main():
    article_md = ARTICLE_PATH.read_text(encoding="utf-8")
    lines = article_md.splitlines()
    body_lines = lines[1:] if lines[0].startswith("# ") else lines
    body_text = "\n".join(body_lines).strip()

    print(f"記事ファイル: {ARTICLE_PATH}")
    print(f"タイトル: {TITLE}")
    print(f"本文文字数: {len(body_text)}")
    print()

    # セッションクッキーの取得
    cookies = {}

    if SESSION_COOKIE:
        print("ステップ1: 環境変数 NOTE_SESSION_COOKIE からセッションを復元...")
        cookies["_note_session_v5"] = SESSION_COOKIE
    elif PASSWORD:
        print("ステップ1: Playwright で自動ログイン...")
        cookies = login_with_playwright()
    else:
        print("ERROR: NOTE_SESSION_COOKIE か NOTE_PASSWORD / note-secret を設定してください。")
        print()
        print("【推奨】NOTE_SESSION_COOKIE の取得方法:")
        print("  1. ブラウザで https://note.com にログイン")
        print("  2. DevTools > Application > Cookies > https://note.com")
        print("  3. `_note_session_v5` の値をコピー")
        print("  4. Cursor Dashboard > Cloud Agents > Secrets に")
        print("     キー名 `NOTE_SESSION_COOKIE` として登録")
        sys.exit(1)

    if not cookies:
        print()
        print("=" * 60)
        print("ログインに失敗しました。")
        print()
        print("note.com は AWS IP からのログインリクエストを 403 でブロックしています。")
        print()
        print("【対処方法】")
        print("  ブラウザで https://note.com/amasuki にログインしてから、")
        print("  DevTools > Application > Cookies > https://note.com で")
        print("  `_note_session_v5` の値を取得し、")
        print("  Cursor Dashboard > Cloud Agents > Secrets に")
        print("  キー名 `NOTE_SESSION_COOKIE` として登録してください。")
        print("=" * 60)
        sys.exit(1)

    session = build_session(cookies)

    # セッション確認
    print("ステップ2: セッション確認...")
    if not verify_session(session):
        print("  ⚠️  セッションが無効か期限切れの可能性があります。続行します...")
    else:
        print("  ✅ セッション有効")

    # 下書き作成
    print("ステップ3: 下書き記事を作成...")
    result = create_draft(session, TITLE, body_text)

    if result:
        note_id = result.get("data", {}).get("id") or result.get("id")
        print(f"\n✅ 下書き投稿成功！")
        print(f"   note記事ID: {note_id}")
        print(f"   確認URL: https://note.com/amasuki")
        print(f"   レスポンス: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}")
    else:
        print("\n❌ 下書き作成に失敗しました。")
        print("   NOTE_SESSION_COOKIE が正しく設定されているか確認してください。")
        sys.exit(1)


if __name__ == "__main__":
    main()
