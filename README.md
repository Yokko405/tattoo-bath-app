# 刺青OK 入浴施設検索アプリ 🛁

刺青OKの入浴施設を探せるWebアプリケーションです。

## 🌐 アプリURL

**アプリにアクセス:** [https://yokko405.github.io/tattoo-bath-app/](https://yokko405.github.io/tattoo-bath-app/)

## 機能

- 施設検索（施設名、住所、エリア、タグで検索）
- 都道府県フィルター
- 刺青OKフィルター
- 地図表示（Google Maps API）
- 施設詳細表示

## セットアップ

### 1. Google Maps APIキーの取得

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成
3. Maps JavaScript APIを有効化
4. APIキーを作成

### 2. Cloudflare Workersのデプロイ

APIキーを安全に管理するため、Cloudflare Workersを使用します。

#### 必要なツール

```bash
npm install -g wrangler
```

または

```bash
npm install wrangler --save-dev
```

#### デプロイ手順

1. Cloudflareにログイン
   ```bash
   wrangler login
   ```

2. APIキーを環境変数として設定（2つのAPIキーが必要）
   
   **フロントエンド用APIキー（HTTPリファラー制限あり）:**
   ```bash
   wrangler secret put GOOGLE_MAPS_API_KEY
   ```
   プロンプトが表示されたら、フロントエンド用のGoogle Maps APIキーを入力
   
   **サーバーサイド用APIキー（制限なし）:**
   ```bash
   wrangler secret put GOOGLE_MAPS_SERVER_API_KEY
   ```
   プロンプトが表示されたら、サーバーサイド用のGoogle Maps APIキーを入力
   
   **注意:** サーバーサイド用APIキーは、Places APIとGeocoding APIを有効化し、アプリケーションの制限を「キーを制限しない」または「IPアドレス」に設定してください。

3. Workersをデプロイ
   ```bash
   wrangler deploy
   ```

4. デプロイ後、表示されるURLをコピー
   例: `https://tattoo-bath-maps-proxy.your-username.workers.dev`

### 3. HTMLファイルの設定

`index.html`の`YOUR_WORKER_URL`を、デプロイしたCloudflare WorkersのURLに置き換えてください。

```javascript
const workerUrl = 'https://tattoo-bath-maps-proxy.your-username.workers.dev';
```

### 4. GitHub Pagesへのデプロイ

1. 変更をコミット
   ```bash
   git add .
   git commit -m "Update Cloudflare Workers URL"
   git push
   ```

2. GitHub Pagesの設定
   - リポジトリのSettings > Pages
   - Source: `main`ブランチ、`/ (root)`フォルダ

## セキュリティ

- Google Maps APIキーはCloudflare Workersの環境変数として管理
- APIキーはクライアント側に公開されない
- Cloudflare Workers経由でAPIリクエストをプロキシ

## ファイル構成

```
tattoo-bath/
├── index.html          # メインアプリケーション
├── tattoo-bath.html    # バックアップファイル
├── worker.js          # Cloudflare Workersプロキシ
├── wrangler.toml      # Cloudflare Workers設定
└── README.md          # このファイル
```

## ライセンス

MIT


