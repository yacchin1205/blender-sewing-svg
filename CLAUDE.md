# Sewing SVG to PDF Converter

## 重要な開発ポリシー

### エラーハンドリングの原則

**絶対にエラーを握りつぶさない。** 不適切なフォールバック処理は問題の根本原因を隠蔽し、デバッグを困難にする。

#### 禁止事項
- `try-catch`で捕捉したエラーを無視して別のロジックに落とすこと
- エラー時にデフォルト値を返して処理を継続すること
- 具体的なエラーメッセージを汎用的なメッセージで置き換えること

#### 推奨事項
- エラーは適切に`throw`して上位に伝播させる
- ユーザーに分かりやすいエラーメッセージを表示する
- エラーの詳細情報をコンソールに出力する

### 実例
```javascript
// ❌ 悪い例
try {
    const bbox = element.getBBox();
    return bbox;
} catch (error) {
    console.error('Failed to get bbox:', error);
    return { x: 0, y: 0, width: 190, height: 277 }; // 謎のフォールバック
}

// ✅ 良い例
const bbox = element.getBBox();
if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
    throw new Error(`Invalid bounding box for element: ${element.id || 'unknown'}`);
}
return bbox;
```

## プロジェクト概要

BlenderアドオンであるSeams to Sewing Patternプラグインが出力するSVGファイルを、印刷容易なPDFへと変換するWebアプリケーション。

### 主な機能
- **スケール補正**: Blenderの単位系問題を解決（デフォルト1/1000スケール）
- **縫いしろ追加**: 0-50mmの範囲で設定可能
- **マルチページ印刷**: 大きな型紙を複数ページに自動分割
- **テクスチャマッピング**: 型紙に画像テクスチャを適用可能

## 技術スタック

- **フロントエンド**: Vanilla JavaScript (ES6+)
- **ビルドツール**: Vite
- **PDF生成**: svg2pdf.js + jsPDF
- **SVG操作**: ネイティブDOM API + Clipper.js（縫いしろ用）
- **テスト**: Vitest（ユニットテスト）、Playwright（E2Eテスト）

## 開発環境

```bash
# 開発サーバー起動
npm run dev

# テスト実行
npm run test        # ユニットテスト
npm run test:e2e    # E2Eテスト

# ビルド
npm run build
```

## コード品質の維持

### テスト実行の重要性
すべてのコード変更後は必ずテストを実行し、全てのテストが通過することを確認する。

### コミット前のチェックリスト
1. `npm run test` - すべてのユニットテストが通過
2. `npm run test:e2e` - すべてのE2Eテストが通過
3. エラーハンドリングが適切に実装されている
4. 不適切なフォールバック処理が含まれていない

## 実装上の注意点

### ユニット配置アルゴリズム
- 型紙ユニットがページをまたがないよう配置
- 縫いしろを含めたサイズで重なりをチェック
- 配置できないユニットは明確にエラーとして報告

### SVGからPDFへの変換
- テクスチャ画像はCanvas APIでクリッピング
- 変換エラーは具体的なメッセージと共に上位に伝播
- PDF生成失敗時はユーザーに分かりやすいエラーメッセージを表示

## プロジェクト構造

```
src/
├── js/
│   ├── main.js              # メインエントリーポイント
│   ├── svg-processor.js     # SVG処理
│   ├── pdf-generator.js     # PDF生成
│   ├── unit-placement.js    # ユニット配置アルゴリズム
│   ├── seam-allowance.js    # 縫いしろ処理
│   ├── texture-mapping.js   # テクスチャマッピング
│   └── ui-controller.js     # UI制御
├── css/
│   └── style.css
└── index.html
```