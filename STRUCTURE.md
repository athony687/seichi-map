# プロジェクト構成まとめ

## ルート直下

| ファイル/フォルダ | 役割 |
|---|---|
| `CLAUDE.md` | プロジェクト仕様書。スタック・役割分担・MVPの定義 |
| `STRUCTURE.md` | このファイル。構成の説明 |
| `PROGRESS.md` | 開発進捗メモ |
| `SETUP.md` | ローカル起動手順 |
| `seichi_data.json` | マスターデータ（聖地一覧）。フロントの `public/` にもコピーがある |
| `.gitignore` | Git 管理外ファイルの設定（`.env`・`node_modules`・`dist` など） |
| `frontend/` | React フロントエンド（Vercel にデプロイ） |
| `backend/` | Python バックエンド（Render にデプロイ） |

---

## frontend/

| ファイル/フォルダ | 役割 |
|---|---|
| `src/App.jsx` | アプリ本体。地図・ピン・ルート・カード・デモ再生の全ロジック |
| `src/main.jsx` | エントリーポイント。`App.jsx` を HTML に差し込む |
| `src/index.css` | グローバルスタイル（最小限） |
| `src/App.css` | App コンポーネント用スタイル（ほぼ未使用） |
| `src/assets/` | 静的アセット（SVG など） |
| `public/seichi_data.json` | 聖地データ。ビルド後もそのまま配信される |
| `index.html` | HTML テンプレート。Vite がここに JS を注入する |
| `vite.config.js` | Vite の設定（React プラグインのみ） |
| `package.json` | npm パッケージ定義・スクリプト定義 |
| `.env` | ローカル用環境変数（Git 管理外） |
| `.env.production` | 本番用環境変数（Vercel ビルド時に使用・Git 管理内） |

### src/App.jsx の主なコンポーネント・関数

| 名前 | 種別 | 役割 |
|---|---|---|
| `haversine` | 関数 | 2点間の距離をメートルで計算 |
| `interpolatePath` | 関数 | ルートパス上の任意の位置（0〜1）を返す |
| `Route` | コンポーネント | Google Maps Directions API でルートを描画し、パスを親へ渡す |
| `Card` | コンポーネント | 聖地情報カードを表示。バックエンドを呼んでAI生成文を取得 |
| `DemoControls` | コンポーネント | 再生/一時停止/リセット/DEMO・LIVEトグルのUI |
| `App` | コンポーネント | 全体の状態管理。デモ再生ループ・近接判定・カード自動表示 |

### 定数

| 定数 | 値 | 意味 |
|---|---|---|
| `PROXIMITY_METERS` | 120 | この距離（m）以内に近づくとカードが自動表示 |
| `DEMO_DURATION_MS` | 30000 | デモ再生の全体時間（ミリ秒）。30秒 |
| `BACKEND_URL` | 環境変数 | バックエンドの URL |

---

## backend/

| ファイル | 役割 |
|---|---|
| `main.py` | FastAPI アプリ本体。エンドポイントを定義 |
| `requirements.txt` | Python パッケージ一覧 |
| `.env` | Anthropic API キー（Git 管理外・Render の環境変数で代替） |

### エンドポイント

| メソッド | パス | 役割 |
|---|---|---|
| `GET` | `/health` | 死活確認。`{"status":"ok"}` を返す |
| `POST` | `/generate-intro` | 聖地情報を受け取り Anthropic API で英語紹介文を生成して返す |

---

## デプロイ先

| 場所 | サービス | URL |
|---|---|---|
| フロント | Vercel | `https://seichi-map-rust.vercel.app` |
| バックエンド | Render | `https://seichi-map-backend.onrender.com` |

> Render の無料プランは15分放置するとスリープする。デモ前に `/health` を開いて起こすこと。
