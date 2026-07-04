# プロジェクト構成まとめ（STRUCTURE.md）

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
| 外部 API | Open-Meteo | 現在地の天気を取得（無料・APIキー不要） |

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
│   │   ├── main.jsx        ← エントリーポイント（LINE IAB 自動リロード含む）
│   │   └── index.css       ← 全体スタイル（スピナーアニメーション等）
│   ├── public/
│   │   ├── seichi_data.json    ← 聖地データ 35 件
│   │   ├── tourist_spots.json  ← 観光スポット 25 件（関西 10 + 関東 15）
│   │   ├── manifest.json       ← PWA 設定（ホーム画面追加用）
│   │   ├── icon-192.png        ← PWA アイコン
│   │   └── icon-512.png        ← PWA アイコン（大）
│   ├── index.html
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
├── CLAUDE.md              ← プロジェクト仕様書
├── FUNCTIONS.md           ← ユーザー向け機能一覧
├── STRUCTURE.md           ← このファイル
├── PROGRESS.md            ← 開発進捗
├── SETUP.md               ← ローカル起動手順
└── .gitignore
```

---

## App.jsx の構成

### 定数（ファイル先頭）

| 定数 | 値 | 意味 |
|---|---|---|
| `PROXIMITY_METERS` | `100` | 何メートル以内に近づいたらカードを自動表示するか |
| `DEMO_STEP` | `0.001°` | デモマーカーが 1 ティックで進む距離（≈ 110m） |
| `DEMO_TICK_MS` | `600` | デモマーカーの更新間隔（ミリ秒） |
| `ARRIVE_DEG` | `0.001°` | スポット「到着」判定の半径（≈ 110m） |
| `TOKYO` | 35.6762, 139.6503 | 地図のデフォルト中心 |
| `TOKYO_STATION` | 35.6812, 139.7671 | GPS 取得失敗時のフォールバック位置 |
| `THEME` | `#7c3aed` | テーマカラー（紫） |
| `LOCATION_CONSENTED_KEY` | `'seichi_location_consented'` | GPS 同意を localStorage に保存するキー |

### localStorage キー一覧

| キー | 保存内容 | 型 |
|---|---|---|
| `seichi_prefs` | ユーザー設定（nickname / familiarity / mood / travelStyle） | JSON |
| `seichi_map_theme` | マップテーマ（`'light'` または `'dark'`） | string |
| `seichi_favorites` | お気に入り聖地 ID の配列 | JSON |
| `seichi_location_consented` | 位置情報への同意フラグ | string `'true'` |

### sessionStorage キー一覧

| キー | 保存内容 |
|---|---|
| `_lreload` | LINE IAB 自動リロード済みフラグ（無限ループ防止） |

---

### コンポーネント・関数 一覧

#### ユーティリティ関数

| 名前 | 役割 |
|---|---|
| `haversine(a, b)` | 2点間の距離をメートルで計算 |
| `formatDistance(meters)` | 距離を「About 1.2km」などの文字列にフォーマット |
| `getWeatherMessage(tags, weather)` | 天気・時間帯に応じた訪問メッセージを返す |
| `isPlaceholder(text)` | `intro_short_en` が意味のある文字列かを判定 |
| `loadPrefs()` / `savePrefs(p)` | localStorage からユーザー設定を読み書き |
| `loadMapTheme()` | localStorage からマップテーマを読み込む |
| `loadFavorites()` / `saveFavorites(f)` | localStorage からお気に入りを読み書き |

---

#### フック（状態を持つロジック）

| フック | 役割 |
|---|---|
| `useAutoWeather(pos, skip)` | Open-Meteo API で現在地の天気を自動取得。0.5° グリッド単位・20分キャッシュ。`skip=true` なら取得しない |
| `useDeviceHeading()` | `DeviceOrientationEvent` でスマホの向き（方位角）をリアルタイム取得。RAF ループで補間スムージング。iOS は `requestPermission()` が必要 |
| `useLiveGPS(enabled)` | GPS 位置情報を取得し続ける。`enabled=false` のとき停止。取得失敗時は東京駅の座標を返す |

---

#### コンポーネント（画面部品）

| コンポーネント | 役割 |
|---|---|
| `LocationPermissionCard` | LIVE モード起動時に毎回表示するボトムシート。Allow で GPS と iOS コンパスの許可を同時トリガー |
| `SelectedSpotMarker` | 選択中の聖地に表示するパルス（点滅）マーカー |
| `ClusteredSpotMarkers` | 35件の聖地ピンをクラスタリング付きで表示。検索ヒット時は赤ピン強調、他はグレー減光 |
| `DemoEngine` | デモモード専用。仮想マーカーを地図上で自動移動させるエンジン |
| `LiveCamera` | LIVE モード専用。スポット選択時・GPS ボタン押下時のカメラ制御 |
| `SearchCamera` | 検索ヒット時に該当聖地群へカメラをフィット |
| `Card` | 聖地の情報カード。AI 生成紹介文・天気メッセージ・距離・お気に入りを表示 |
| `TouristPopup` | 観光スポットタップ時のポップアップ |
| `GpsLocateButton` | LIVE モード専用。右下の GPS ボタン。取得状況を色で表示 |
| `SettingsScreen` | ⚙️ から開く設定画面。アコーディオン形式で設定項目を表示 |
| `OnboardingSurvey` | 初回起動時の全画面アンケート（4ステップ） |

#### 親コンポーネント

| コンポーネント | 役割 |
|---|---|
| `App` | アプリ全体の状態管理。モード切替・地図クリック・近接判定・カード表示・検索・設定・アンケートを制御 |

---

### App の状態（state）一覧

| 状態 | 意味 |
|---|---|
| `spots` | 聖地データ 35 件 |
| `touristSpots` | 観光スポット 25 件 |
| `selected` | 現在カードに表示中のスポット（null = カードなし） |
| `selectedTourist` | タップされた観光スポット（null = ポップアップなし） |
| `demoMode` | `true` = DEMO モード、`false` = LIVE モード（デフォルト: LIVE） |
| `playing` | デモ再生中かどうか |
| `startPos` | デモの開始地点 |
| `startPosMode` | 開始地点を待ち受け中かどうか |
| `demoPos` | デモマーカーの現在座標 |
| `locateTick` | GPS ボタン押下カウンタ。LiveCamera がこれを見て現在地へ移動 |
| `locationPermissionAsked` | 許可カードを表示済みか（セッション限定・localStorage 非保存） |
| `gpsConsented` | ユーザーが位置情報を許可したか（localStorage 永続化） |
| `gpsReady` | GPS 取得が完了した（または断念した）かどうか |
| `heading` | スマホの向き（方位角 0〜359°）。`useDeviceHeading` から取得 |
| `userPrefs` | ユーザーの好み（nickname / familiarity / mood / travelStyle） |
| `showSurvey` | 初回アンケートを表示するかどうか |
| `showSettings` | 設定画面を表示するかどうか |
| `mapTheme` | マップテーマ（`'light'` または `'dark'`） |
| `weatherOverride` | 手動設定の天気（null = 自動取得） |
| `favorites` | お気に入り聖地 ID の Set |
| `searchQuery` | 検索バーの入力文字列 |
| `searchAnime` | 検索でヒットしたアニメ作品名 |
| `showSuggestions` | 検索候補リストを表示するかどうか |
| `animateSearch` | 検索ヒット直後のピンアニメーションフラグ |

---

### モードの違い

| | DEMO モード | LIVE モード |
|---|---|---|
| 現在地マーカー | 仮想マーカー（デモエンジンが移動） | GPS マーカー（実際の位置） |
| コンパス扇形 | 非表示 | 表示（heading が取得できている場合） |
| カードの表示条件 | マーカーが 100m 以内に自動表示 | ピンタップ or 100m 以内で自動表示 |
| カードの閉じ条件 | マーカーが 100m 以上離れたら自動クローズ | ✕ ボタンまたは地図タップ |
| カメラ | DemoEngine が追跡 | LiveCamera が制御 |
| GPS ボタン | 非表示 | 右下に表示 |
| 天気取得位置 | `startPos`（開始地点）| `livePos`（現在地） |

---

### キャッシュの仕組み

| キャッシュ | 場所 | リセットタイミング |
|---|---|---|
| `introCache`（クライアント） | `App.jsx` のモジュール変数 | 設定保存・リセット時 |
| `_intro_cache`（サーバー） | `main.py` のメモリ変数 | サーバー再起動時 |
| `_wxCache`（天気） | `App.jsx` のモジュール変数 | 20分経過後（TTL） |

---

## backend/ の API

| メソッド | URL | 何をするか |
|---|---|---|
| GET | `/health` | サーバーが生きているか確認 |
| POST | `/generate-intro-stream` | SSE ストリーミングで紹介文を生成 |
| POST | `/generate-intro` | 紹介文を生成して返す |
| POST | `/prefetch-intros` | 起動時に全聖地の紹介文をまとめてサーバーキャッシュに格納 |

---

## データファイルの構造

### seichi_data.json（聖地データ）

| フィールド | 例 | 意味 |
|---|---|---|
| `id` | `uji-eupho-01` | 一意な ID |
| `spot_name_en` | `Uji Bridge` | 聖地名（英語） |
| `anime_title_en` | `Sound! Euphonium` | アニメ作品名 |
| `lat` / `lng` | `34.8915` / `135.8075` | 座標 |
| `scene_description` | 主人公たちが渡る橋… | AI 紹介文生成の素材テキスト |
| `intro_short_en` | `A historic bridge...` | デフォルト紹介文 |
| `generic_intro_en` | （空欄可） | AI 生成失敗時のフォールバック |
| `area` | `Uji, Kyoto` | エリア名 |
| `verified` | `true` | 座標・事実を人間が確認済みか |

### tourist_spots.json（観光スポット）

| フィールド | 例 |
|---|---|
| `id` | `t-sensoji` |
| `name` | `浅草寺` |
| `nameEn` | `Sensoji Temple` |
| `lat` / `lng` | 座標 |
