# セットアップ手順

## 前提条件

- Node.js 20 LTS 以上が入っていること → https://nodejs.org

## 手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/Ruaku1352/seichi-map.git
cd seichi-map/frontend

# 2. 依存パッケージを入れる
npm install

# 3. APIキーを設定（.envファイルを作る）
(Mac/Linux)
echo "VITE_GOOGLE_MAPS_API_KEY=(APIキーをここに貼る)" > .env
(windows)
"VITE_GOOGLE_MAPS_API_KEY=(APIキーをここに貼る)" | Out-File -Encoding utf8 .env

# 4. 起動
npm run dev
```

ブラウザで http://localhost:5173 を開くと地図が表示される。

終了は `Ctrl+C`。

## APIキーについて

`.env` ファイルは Git に含まれていないため、各自で作成する必要がある。  
キーは統括（PM）から受け取ること。
