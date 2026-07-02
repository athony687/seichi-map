# プロジェクト構成まとめ（最新版）

## システム全体像

```
ブラウザ（スマホ・PC）
  └── JavaScript (React + Vite)   ← 画面に見えるものはすべてこれ
        │
        │ fetch() で HTTP 通信
        ▼
サーバー（Render クラウド）
  └── Python (FastAPI)             ← AI 連携はここ
        │
        │ API 呼び出し
        ▼
Anthropic API（Claude Haiku）      ← 英語紹介文を生成する AI
```

| 場所 | 言語 | 役割 |
|---|---|---|
| フロント | JavaScript（React + Vite） | 地図・ピン・カード・デモ・LIVE の表示 |
| バックエンド | Python（FastAPI） | Claude を呼んで英語紹介文を生成・キャッシュ |
| データ | JSON | 聖地・観光スポットの座標やテキスト |

---

## デプロイ先

| 場所 | サービス | URL |
|---|---|---|
| フロント | Vercel | `https://seichi-map-rust.vercel.app` |
| バックエンド | Render | `https://seichi-map-backend.onrender.com` |

> ⚠️ Render の無料プランは 15 分放置するとスリープする。  
> デモ前に `https://seichi-map-backend.onrender.com/health` を開いて起こすこと。

---

## ファイル構成

```
seichi-map/
├── frontend/               ← フロント（JavaScript）
│   ├── src/
│   │   ├── App.jsx         ← ★ アプリ本体。コンポーネントがすべてここ
│   │   ├── main.jsx        ← エントリーポイント（起動ファイル）
│   │   └── index.css       ← 全体スタイル（スピナーアニメーション等）
│   ├── public/
│   │   ├── seichi_data.json    ← 聖地データ 35 件
│   │   │                          ※ generic_intro_en フィールド（空欄可）あり
│   │   ├── tourist_spots.json  ← 観光スポット 25 件（関西 10 + 関東 15）
│   │   ├── manifest.json       ← PWA 設定（ホーム画面追加用）
│   │   ├── icon-192.png        ← PWA アイコン
│   │   └── icon-512.png        ← PWA アイコン（大）
│   ├── index.html          ← <header> タグにロゴ・検索バーを共存させている
│   ├── style.css           ← header / loading-overlay のスタイル
│   ├── vite.config.js
│   ├── package.json
│   ├── .env               ← ローカル用 API キー（Git に上げない）
│   └── .env.production    ← Vercel ビルド時の本番 API キー
│
├── backend/
│   ├── main.py            ← ★ FastAPI サーバー本体
│   ├── requirements.txt
│   └── .env               ← Anthropic API キー（Git に上げない）
│
├── CLAUDE.md              ← プロジェクト仕様書（チームの共通認識）
├── STRUCTURE.md           ← このファイル
├── SETUP.md               ← ローカル起動手順
└── .gitignore
```

---

## App.jsx の構成

### 定数（ファイル先頭で変更できる）

| 定数 | 値 | 意味 |
|---|---|---|
| `PROXIMITY_METERS` | `100` | 何メートル以内に近づいたらカードを自動表示するか（デモモードのみ） |
| `DEMO_STEP` | `0.001°` | デモマーカーが 1 ティックで進む距離（≈ 110m） |
| `DEMO_TICK_MS` | `600` | デモマーカーの更新間隔（ミリ秒） |
| `ARRIVE_DEG` | `0.001°` | スポット「到着」判定の半径（≈ 110m） |
| `TOKYO` | 35.6762, 139.6503 | 地図のデフォルト中心（初期表示用） |
| `TOKYO_STATION` | 35.6812, 139.7671 | GPS 取得失敗時のフォールバック位置（東京駅） |
| `THEME` | `#7c3aed` | テーマカラー（紫） |
| `GENERIC_INTRO` | 汎用英語紹介文 | AI 生成失敗 かつ `generic_intro_en` も空のときの最終フォールバック |
| `SURVEY_KEY` | `'seichi_prefs'` | localStorage に好みを保存するときのキー名 |

---

### コンポーネント・関数 一覧

#### ユーティリティ関数

| 名前 | 役割 |
|---|---|
| `haversine(a, b)` | 2点間の距離をメートルで計算する（緯度経度 → メートル） |
| `formatDistance(meters)` | 距離を「About 1.2km」などの文字列にフォーマット |
| `isPlaceholder(text)` | `intro_short_en` が意味のある文字列かを判定する |
| `loadPrefs()` | localStorage から好みデータを読み込む |
| `savePrefs(p)` | localStorage に好みデータを書き込む |

---

#### コンポーネント（画面部品）

| コンポーネント | 役割 |
|---|---|
| `SelectedSpotMarker` | 選択中の聖地に表示するパルス（点滅）するマーカー。500ms ごとにサイズが変わる。他のマーカーとは分離してここだけアニメーションさせることで、全体の描画負荷を下げている |
| `ClusteredSpotMarkers` | 35件の聖地ピンを地図に表示する。ズームレベルに応じて近いものをまとめる「クラスタリング」機能付き。検索ヒット時は対象ピンを赤の縦長ピンで表示し、他をグレーに減光する |
| `DemoEngine` | **デモモード専用**。仮想マーカーを地図上で自動移動させるエンジン。開始地点から半径 40km 以内の聖地を順番に訪れる。各スポット到達後は 5 秒停止してから次へ。カメラはマーカーを常に追う |
| `LiveCamera` | **LIVEモード専用**。カメラ（地図の視点）を制御する。スポット選択時 → そのスポットへズーム。カード閉じたとき → 現在地へ戻らず **その場に留まる**（UX 改善済み）。GPS ボタン押下時 → 現在地へ移動 |
| `Card` | 聖地の情報カード。バックエンドを呼んで AI 生成の英語紹介文を取得・表示する。折りたたみ式（タップで展開）。距離も表示。**userPrefs（nickname 等）がある場合はキャッシュを使わず毎回パーソナライズ生成する** |
| `TouristPopup` | 観光スポット（通天閣・浅草寺など）をタップしたときに出るポップアップ |
| `GpsLocateButton` | **LIVEモード専用**のボタン（画面右下）。GPS の取得状況を色で表示し、タップすると現在地へカメラが移動する |
| `SettingsScreen` | ⚙️ ボタンから開く設定画面。nickname / 馴染み度 / 気分 / 旅スタイルを変更できる。保存するとクライアントキャッシュをクリアして次のカードから反映される |
| `OnboardingSurvey` | 初回起動時（localStorage に好みがない場合）に全画面で表示されるアンケート。4ステップ（nickname → 馴染み度 → 気分 → 旅スタイル）で入力後に localStorage へ保存 |

#### フック（状態を持つロジック）

| フック | 役割 |
|---|---|
| `useLiveGPS(enabled)` | GPS 位置情報を取得し続ける。`enabled=true` のとき `watchPosition` で常時監視。取得前は `null`、失敗時は東京駅の座標を返す |

#### 親コンポーネント

| コンポーネント | 役割 |
|---|---|
| `App` | アプリ全体の状態管理。モード切替・地図クリック・近接判定・カード表示・検索・設定・アンケートを制御する |

---

### App の状態（state）一覧

| 状態 | 意味 |
|---|---|
| `spots` | 聖地データ 35 件（JSON から読み込み済み） |
| `touristSpots` | 観光スポット 25 件 |
| `selected` | 現在カードに表示中のスポット（null = カードなし） |
| `selectedTourist` | タップされた観光スポット（null = ポップアップなし） |
| `demoMode` | `true` = DEMOモード、`false` = LIVEモード（デフォルト: LIVE） |
| `playing` | デモ再生中かどうか |
| `startPos` | デモの開始地点（地図タップで設定） |
| `startPosMode` | 開始地点を待ち受け中かどうか（タップで座標を受け取る） |
| `demoPos` | デモマーカーの現在座標（DemoEngine が毎 600ms 更新） |
| `locateTick` | GPS ボタンが押されるたびに +1。LiveCamera がこれを見て現在地へ移動 |
| `gpsReady` | GPS 取得が完了した（または断念した）かどうか。`false` の間は全画面ローディングを表示 |
| `userPrefs` | ユーザーの好み（nickname / familiarity / mood / travelStyle）。localStorage から初期化 |
| `showSurvey` | 初回アンケートを表示するかどうか（localStorage に好みがなければ true） |
| `showSettings` | 設定画面を表示するかどうか |
| `searchQuery` | 検索バーの入力文字列 |
| `searchAnime` | 検索でヒットしたアニメ作品名（ピンの強調表示に使用） |
| `showSuggestions` | 検索候補リストを表示するかどうか |
| `animateSearch` | 検索ヒット直後にピンをアニメーションさせるフラグ |

---

### モードの違い

| | DEMOモード | LIVEモード |
|---|---|---|
| 現在地マーカー | 仮想マーカー（デモエンジンが移動） | GPS マーカー（実際の位置） |
| カードの表示条件 | マーカーが 100m 以内に近づいたら自動表示 | スポットのピンをタップで手動表示 |
| カードの閉じ条件 | マーカーが 100m 以上離れたら自動クローズ | ✕ ボタンまたは地図タップで閉じる |
| カメラ | DemoEngine が追跡 | LiveCamera が制御（カード閉じてもその場に留まる） |
| GPS ボタン | 非表示 | 右下に表示 |
| デフォルト | — | ✅ デフォルトはこちら |

---

### キャッシュの仕組み

| キャッシュ | 場所 | リセットタイミング |
|---|---|---|
| `introCache`（クライアント） | `App.jsx` のモジュール変数 | 設定保存・設定リセット時 |
| `_intro_cache`（サーバー） | `main.py` のメモリ変数 | サーバー再起動時（Render スリープ後も） |

**ポイント**: `userPrefs` に nickname 等が設定されている場合、クライアントキャッシュ・サーバーキャッシュの両方をバイパスして毎回パーソナライズ生成する。

---

## backend/ の API

| メソッド | URL | 何をするか |
|---|---|---|
| GET | `/health` | サーバーが生きているか確認（`{"status":"ok"}` を返す） |
| POST | `/generate-intro` | 聖地情報と userPrefs を受け取り Claude で英語紹介文を生成して返す |
| POST | `/prefetch-intros` | 起動時に全聖地の紹介文（prefs なし）をまとめて生成してサーバーキャッシュに格納 |

### UserPrefs モデル（バックエンド）

| フィールド | 型 | 意味 |
|---|---|---|
| `nickname` | str | ユーザーのニックネーム。設定されていれば紹介文の冒頭で呼びかける |
| `familiarity` | str | `Newcomer` / `Casual fan` / `Big fan` |
| `mood` | str | `Emotional` / `Exciting` / `Heartwarming` / `Romance` |
| `travelStyle` | str | `Taking photos` / `Relaxed walking` / `Visiting many spots` |

---

## データファイルの構造

### seichi_data.json（聖地データ）
聖地 1 件 = 1 オブジェクト。データ担当がここを編集する。

| フィールド | 例 | 意味 |
|---|---|---|
| `id` | `uji-eupho-01` | 一意な ID |
| `spot_name_en` | `Uji Bridge` | 聖地名（英語） |
| `anime_title_en` | `Sound! Euphonium` | アニメ作品名 |
| `lat` / `lng` | `34.8915` / `135.8075` | 座標（必ず実在の座標を入れる） |
| `scene_description` | 主人公たちが渡る橋… | AI 紹介文生成の素材テキスト |
| `intro_short_en` | `A historic bridge...` | AI 生成前のデフォルト文 |
| `generic_intro_en` | （空欄可） | カード別の汎用紹介文。AI 生成失敗時のフォールバックとして使用 |
| `area` | `Uji, Kyoto` | エリア名（カードに表示） |
| `verified` | `true` | 座標・事実を人間が確認済みか |

### tourist_spots.json（観光スポット）
| フィールド | 例 |
|---|---|
| `id` | `t-sensoji` |
| `name` | `浅草寺` |
| `nameEn` | `Sensoji Temple` |
| `lat` / `lng` | 座標 |
