# Design Shift AI

画像またはテキストを入力し、希望するデザイン方向性に沿った改善案・新規イメージを3案または5案生成する日本語Webアプリです。

## 主な機能

- PNG / JPG / JPEG / WebP画像のドラッグ＆ドロップ、プレビュー、削除、差し替え
- 日本語・英語の文字検出とデザイン分析
- OCR結果の生成前確認・修正
- テキスト、見出し、本文、CTAからの新規画像生成
- ミニマル、高級感、親しみやすさ、ビジネス、自由入力の方向性指定
- 3案または5案の実画像生成、要約表示、ダウンロード
- APIキー未設定・非対応形式・サイズ超過・APIエラーの画面表示

## 起動手順

必要環境は Node.js 22.13以降です。

```bash
npm install
copy .env.example .env.local
npm run dev:next
```

表示されたローカルURLをブラウザで開いてください。Windows以外では `copy` の代わりに `cp` を使用します。

`npm run dev` はCloudflare Workers互換のローカル環境での確認用です。Windows環境でWorkersランタイムが起動しない場合も、`npm run dev:next` で画面とAPIルートをローカル確認できます。

本番相当のビルド確認：

```bash
npm run build
npm run start
```

## 環境変数

`.env.example` を `.env.local` にコピーし、サーバー側だけで使用するOpenAI APIキーを設定します。`.env.local` はコミットしないでください。

```dotenv
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_VISION_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
OPENAI_EDIT_MODEL=gpt-image-2.5-sunburst
```

- `OPENAI_API_KEY`：必須。ブラウザには送信されません。
- `OPENAI_VISION_MODEL`：OCR・画像内容理解に使用します。
- `OPENAI_IMAGE_MODEL`：テキストからの新規画像生成に使用します。
- `OPENAI_EDIT_MODEL`：入力画像を参照した改善案生成に使用します。

## OCR・画像生成APIの注意

- 画像解析はOpenAI Responses APIの画像入力を使用し、文字・目的・主要メッセージ・レイアウト・配色・情報の優先順位をJSONで取得します。
- 画像改善はOpenAI Images APIの編集エンドポイント、新規作成は生成エンドポイントを使用します。ダミー画像へのフォールバックはありません。
- API利用料、組織の利用上限、対象モデルへのアクセス権が必要です。レート制限や利用上限に達した場合は画面にエラーが表示されます。
- アップロード上限は10MBです。許可形式はPNG、JPG、JPEG、WebPです。
- 公開環境では `OPENAI_API_KEY` をホスティング側のサーバー秘密情報として設定してください。フロントエンドの環境変数やソースコードへ直接記載しないでください。

## 画像内の文字の正確性

OCR結果は生成前に画面で確認・修正できます。不鮮明な画像や装飾書体では誤認識が起こる可能性があります。また、画像生成モデルは日本語・英語の文字を完全に再現できない場合があり、誤字や文字化けが発生することがあります。文字の完全な正確性が必要な成果物では、生成画像をレイアウトのたたき台として使用し、最終的な文字入れをFigma、Illustrator、Canvaなどのデザインツールで行ってください。

## 技術構成

- Next.js互換のVinext + React + TypeScript
- Tailwind CSS / Shadcn UI primitives
- OpenAI Responses API（画像理解・OCR）
- OpenAI Images API（新規生成・参照画像からの編集）
- Cloudflare Workers互換のサーバールート
