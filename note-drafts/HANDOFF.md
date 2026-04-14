# Cloud Agent 引き継ぎドキュメント

## タスク概要
Amazonタイムセール（2026/4/14）のリサーチ → note下書き記事作成 → **noteに下書き投稿**

## 現在の状態
- [x] タイムセールのリサーチ完了
- [x] amasukiアカウントの直近3記事を分析してトンマナ完全一致で記事作成
- [x] Amazonリンク（ASIN）を全て検証・修正済み
- [ ] **noteへの下書き投稿（未完了）** ← ここをやる

## noteアカウント情報
- URL: https://note.com/amasuki
- アカウント名: amazon大好きさん
- メールアドレス: amasuki16142@gmail.com
- パスワード: 環境変数 `NOTE_PASSWORD` から取得すること

## 投稿する記事
`/workspace/note-drafts/2026-04-14-amazon-timesale-osusume.md` の内容をそのまま投稿する

## noteへの下書き投稿方法（Selenium + Chrome）

### 環境
- Google Chrome 147 インストール済み (`/usr/local/bin/google-chrome`)
- Selenium インストール済み (`pip install selenium` 済み)
- DISPLAY=:1 設定済み

### 投稿手順
1. Seleniumでheadless Chromeを起動
2. https://note.com/login にアクセス
3. メールアドレス `amasuki16142@gmail.com` + 環境変数 `NOTE_PASSWORD` でログイン
4. https://note.com/notes/new にアクセス（テキスト記事作成）
5. タイトル入力：「【4/14】Amazonタイムセールで見つけた"地味にすごい"おすすめアイテム7選｜セール後こそ掘り出し物がある」
6. 本文を貼り付け
7. 下書き保存

### 注意事項
- noteのログインはGoogleログインではなくメール+パスワードのダイレクトログインを使う
- noteのエディタはcontenteditable divなので、JavaScriptで innerHTMLを設定する方法が確実
- 下書き保存は自動保存される場合もあるが、明示的に保存ボタンを押すのが安全

## 記事のトンマナ（重要）
以下のスタイルで記事は既に完成している。**変更不要**。

- 一人称「私」/ 女性会社員の視点
- Galaxy S26 Ultra / Z Fold7 / Galaxy Buds Pro 4 ユーザー
- 各商品：「ここが良い:」「ここが惜しい:」「💡 わたしのイチオシ！」「こんな人におすすめ:」
- 冒頭に「選ぶ3つのコツ」
- 商品は価格が高い順
- 末尾に「最後に、少しだけおしゃべりしませんか」
- Amazonアソシエイトタグ: `tks24u-22`
- ハッシュタグ末尾配置

## Gitブランチ
- ブランチ: `cursor/note-amazon-timesale-draft-9a4a`
- ベース: `main`

## 検証済みAmazonリンク（ASIN）
| 商品 | ASIN | 状態 |
|---|---|---|
| LG ディスプレイ 24MS530B-B | B0DJBQ76S5 | ✅ |
| Soundcore Liberty 4 Pro | B0D7ZLPSJG | ✅ |
| Anker Nano Power Bank | B0F6LBT3ZX | ✅ |
| UGREEN FineTrack Smart Finder | B0FBWR6YL6 | ✅ |
| HARIO ガラスのレンジご飯釜 | B08XMNVVTG | ✅ |
| 花王 マジックリンEX POWER | B0DJNT7YN3 | ✅ |
| タイムセールページ | /gp/goldbox | ✅ |
