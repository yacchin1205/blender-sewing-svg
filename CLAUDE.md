# Sewing SVG to PDF Converter

## プロジェクト概要

BlenderアドオンであるSeams to Sewing Patternプラグインが出力するSVGファイルを、印刷容易なPDFへと変換するWebアプリケーション。GitHub Pagesでホストし、すべての機能はブラウザのJavaScriptで動作する。

### 背景

Seams to Sewing PatternプラグインはBlenderの単位系を認識できず、出力されたモデルのスケールが誤った形で出力されてしまう。本ツールはこのスケール補正を行い、実用的な型紙PDFを生成する。

## 主要機能

### 1. スケール補正機能（最重要）

- **デフォルト補正**: 1/1000スケール（14.4m → 14.4mm）
- **カスタム補正**: 任意のスケール比率に対応（1/100、1/500など）
- **自動調整項目**:
  - SVGのviewBox属性
  - width/height属性
  - stroke-width（線の太さ）の比例補正

### 2. 印刷レイアウト機能

- **用紙サイズ**: A4、A3、B4、B5等から選択可能
- **分割印刷**: 大きな型紙を複数ページに自動分割
- **のりしろ**: 5-10mm程度の重なり部分を追加
- **印刷補助**:
  - ページ番号の自動付与
  - 位置合わせマーク（十字線など）
  - カットライン表示

### 3. その他の機能

- **一括ダウンロード**: 全ページをまとめたPDFファイル
- **ドラッグ&ドロップ**: SVGファイルの簡単な読み込み

## 技術仕様

### 使用技術

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **SVG操作**: ネイティブDOM API
- **PDF生成**: [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) + jsPDF
- **UI フレームワーク**: Vanilla JS（シンプルさを重視）
- **ホスティング**: GitHub Pages

### 必要なライブラリ

- svg2pdf.js - SVGからPDFへの変換
- jsPDF - PDF生成のベースライブラリ（svg2pdf.jsの依存）

### ブラウザ要件

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### SVGファイル仕様

入力として期待するSVGファイルの構造：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 [width] [height]" width="[width]mm" height="[height]mm">
  <defs>
    <style>
      .seam{stroke: #000; stroke-width:1px; fill:white}
      .sewinguide{stroke-width:1px;}
    </style>
  </defs>
  <g>
    <!-- seamクラスのパス群 -->
    <path class="seam" d="..."/>
  </g>
  <g>
    <!-- sewingguideクラスのパス群（色指定あり） -->
    <path class="sewinguide" stroke="#7e00ff" d="..."/>
    <path class="sewinguide" stroke="#9fff00" d="..."/>
  </g>
</svg>
```

## 実装計画

### フェーズ1: 基本機能
1. SVGファイルの読み込みとパース
2. スケール補正機能の実装
3. 単一ページPDF出力（svg2pdf.js使用）

### フェーズ2: 印刷機能
1. 分割印刷レイアウトエンジン
2. のりしろと位置合わせマーク
3. 複数ページPDF生成

## 開発環境

```bash
# 開発サーバーの起動
python -m http.server 8000

# ブラウザでアクセス
http://localhost:8000
```

## ディレクトリ構造

```
sewing-svg-to-pdf/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── svg-processor.js
│   ├── pdf-generator.js
│   └── ui-controller.js
├── resources/
│   └── example.svg
└── CLAUDE.md
```

svg2pdf等はCDNから読み込むため、特別なディレクトリは不要。参考: https://github.com/yWorks/svg2pdf.js

```
<script src="[node_modules|bower_components]/jspdf/dist/jspdf.umd.min.js"></script>
<script src="[node_modules|bower_components]/svg2pdf.js/dist/svg2pdf.umd.min.js"></script>
```

## 実装のポイント

### スケール補正の実装

```javascript
// SVG要素のスケール補正
function scaleSVG(svgElement, scaleFactor = 0.001) {
  // viewBoxの補正
  const viewBox = svgElement.viewBox.baseVal;
  viewBox.width *= scaleFactor;
  viewBox.height *= scaleFactor;
  
  // サイズ属性の補正
  svgElement.setAttribute('width', `${viewBox.width}mm`);
  svgElement.setAttribute('height', `${viewBox.height}mm`);
  
  // stroke-widthの補正
  const paths = svgElement.querySelectorAll('path');
  paths.forEach(path => {
    const currentWidth = parseFloat(path.style.strokeWidth || 1);
    path.style.strokeWidth = `${currentWidth * scaleFactor}px`;
  });
}
```

### SVG分割戦略

#### 1. グリッドベース分割方式

```javascript
// 用紙サイズに基づいてグリッドを作成
const gridStrategy = {
  pageWidth: 210,    // A4: 210mm
  pageHeight: 297,   // A4: 297mm
  margin: 10,        // 印刷余白
  overlap: 10,       // のりしろ
  
  // 実際の印刷可能領域
  printableWidth: 190,   // 210 - 20
  printableHeight: 277,  // 297 - 20
  
  // のりしろを考慮した有効領域
  effectiveWidth: 180,   // 190 - 10
  effectiveHeight: 267   // 277 - 10
};
```

#### 2. パス要素の分割処理

- **課題**: seamのパスは閉じた輪郭線なので、ページ境界で切断する必要がある
- **解決策**:
  - SVGのclipPathを使用してページごとにクリッピング
  - 切断点にマーカーを追加して位置合わせを容易にする
  - のりしろ部分では完全なパスを表示（切断しない）

```javascript
// SVGクリッピングを使用した分割
function createPagedSVG(originalSVG, pageX, pageY, gridStrategy) {
  const {printableWidth, printableHeight, effectiveWidth, effectiveHeight, overlap} = gridStrategy;
  
  // クリッピング領域の定義
  const clipPath = `
    <clipPath id="page-${pageX}-${pageY}">
      <rect 
        x="${pageX * effectiveWidth - overlap}" 
        y="${pageY * effectiveHeight - overlap}"
        width="${printableWidth}" 
        height="${printableHeight}"
      />
    </clipPath>
  `;
  
  // 各ページのSVGを生成
  const pagedSVG = originalSVG.cloneNode(true);
  // viewBoxを調整してページ位置に対応
  pagedSVG.setAttribute('viewBox', 
    `${pageX * effectiveWidth - overlap} ${pageY * effectiveHeight - overlap} ${printableWidth} ${printableHeight}`
  );
  
  // クリッピングを適用
  const defs = pagedSVG.querySelector('defs') || pagedSVG.insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'defs'), pagedSVG.firstChild);
  defs.insertAdjacentHTML('beforeend', clipPath);
  
  // すべてのパス要素にクリッピングを適用
  const mainGroup = pagedSVG.querySelector('g');
  mainGroup.setAttribute('clip-path', `url(#page-${pageX}-${pageY})`);
  
  return pagedSVG;
}
```

#### 3. 位置合わせ補助機能

```javascript
// ページに位置合わせマークを追加
function addAlignmentMarks(svgElement, pageX, pageY, gridStrategy) {
  const marks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  marks.setAttribute('class', 'alignment-marks');
  
  // 十字マーク（四隅）
  const crossSize = 5;
  const positions = [
    {x: 0, y: 0},
    {x: gridStrategy.printableWidth, y: 0},
    {x: 0, y: gridStrategy.printableHeight},
    {x: gridStrategy.printableWidth, y: gridStrategy.printableHeight}
  ];
  
  positions.forEach(pos => {
    marks.innerHTML += `
      <line x1="${pos.x - crossSize}" y1="${pos.y}" x2="${pos.x + crossSize}" y2="${pos.y}" stroke="black" stroke-width="0.5"/>
      <line x1="${pos.x}" y1="${pos.y - crossSize}" x2="${pos.x}" y2="${pos.y + crossSize}" stroke="black" stroke-width="0.5"/>
    `;
  });
  
  // ページ番号
  marks.innerHTML += `
    <text x="${gridStrategy.printableWidth / 2}" y="${gridStrategy.printableHeight - 5}" 
          text-anchor="middle" font-size="8" fill="black">
      Page ${pageX + 1}-${pageY + 1}
    </text>
  `;
  
  // のりしろガイド（点線）
  if (gridStrategy.overlap > 0) {
    marks.innerHTML += `
      <rect x="${gridStrategy.overlap}" y="${gridStrategy.overlap}" 
            width="${gridStrategy.effectiveWidth}" height="${gridStrategy.effectiveHeight}"
            fill="none" stroke="gray" stroke-width="0.5" stroke-dasharray="5,5"/>
    `;
  }
  
  svgElement.appendChild(marks);
}
```

#### 4. 最適化オプション

- **自動配置最適化**: 
  - 型紙を回転させて用紙の無駄を最小化
  - 小さなパーツをまとめて配置

- **スマート分割**:
  - 重要な線（seamなど）を絶対に切断しない
  - パーツの境界を優先的にページ境界に配置

### PDF生成の基本フロー

```javascript
// svg2pdf.jsを使用した複数ページPDF生成
async function generateMultiPagePDF(originalSVG, gridStrategy) {
  const { jsPDF } = window.jspdf;
  
  // スケール補正を適用
  const scaledSVG = originalSVG.cloneNode(true);
  scaleSVG(scaledSVG);
  
  // 必要なページ数を計算
  const svgWidth = scaledSVG.viewBox.baseVal.width;
  const svgHeight = scaledSVG.viewBox.baseVal.height;
  const pagesX = Math.ceil(svgWidth / gridStrategy.effectiveWidth);
  const pagesY = Math.ceil(svgHeight / gridStrategy.effectiveHeight);
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // 各ページを生成
  for (let y = 0; y < pagesY; y++) {
    for (let x = 0; x < pagesX; x++) {
      if (x > 0 || y > 0) {
        doc.addPage();
      }
      
      // ページ用のSVGを作成
      const pagedSVG = createPagedSVG(scaledSVG, x, y, gridStrategy);
      addAlignmentMarks(pagedSVG, x, y, gridStrategy);
      
      // PDFに描画
      await svg2pdf(pagedSVG, doc, {
        x: gridStrategy.margin,
        y: gridStrategy.margin,
        width: gridStrategy.printableWidth,
        height: gridStrategy.printableHeight
      });
    }
  }
  
  doc.save('sewing-pattern.pdf');
}
```

## テスト戦略

### テストフレームワーク

- **フレームワーク**: Vitest（高速でES6+対応）
- **DOM環境**: Happy DOM（軽量で高速）
- **アサーション**: Vitest内蔵のexpect

### ユニットテスト

```javascript
// test/svg-processor.test.js
import { describe, test, expect } from 'vitest';
import { scaleSVG, createPagedSVG, calculatePageLayout } from '../js/svg-processor.js';

describe('スケール補正機能', () => {
  test('viewBoxが正しく補正される', () => {
    const svg = createTestSVG(14433.48, 14433.48);
    scaleSVG(svg, 0.001);
    
    expect(svg.viewBox.baseVal.width).toBe(14.43348);
    expect(svg.viewBox.baseVal.height).toBe(14.43348);
  });
  
  test('サイズ属性が正しく補正される', () => {
    const svg = createTestSVG(1000, 1000);
    scaleSVG(svg, 0.001);
    
    expect(svg.getAttribute('width')).toBe('1mm');
    expect(svg.getAttribute('height')).toBe('1mm');
  });
  
  test('stroke-widthが比例して補正される', () => {
    const svg = createTestSVG();
    const path = svg.querySelector('path');
    path.style.strokeWidth = '10px';
    
    scaleSVG(svg, 0.1);
    
    expect(path.style.strokeWidth).toBe('1px');
  });
});

describe('ページ分割機能', () => {
  test('必要なページ数が正しく計算される', () => {
    const svg = createTestSVG(500, 800);
    const gridStrategy = {
      effectiveWidth: 180,
      effectiveHeight: 267
    };
    
    const layout = calculatePageLayout(svg, gridStrategy);
    
    expect(layout.pagesX).toBe(3); // Math.ceil(500 / 180) = 3
    expect(layout.pagesY).toBe(3); // Math.ceil(800 / 267) = 3
    expect(layout.totalPages).toBe(9);
  });
  
  test('単一ページのviewBoxが正しく設定される', () => {
    const svg = createTestSVG(1000, 1000);
    const gridStrategy = {
      printableWidth: 190,
      printableHeight: 277,
      effectiveWidth: 180,
      effectiveHeight: 267,
      overlap: 10
    };
    
    const pagedSVG = createPagedSVG(svg, 1, 1, gridStrategy);
    const viewBox = pagedSVG.getAttribute('viewBox');
    
    // pageX=1, pageY=1の場合: x=180-10=170, y=267-10=257
    expect(viewBox).toBe('170 257 190 277');
  });
  
  test('クリッピングパスが正しく適用される', () => {
    const svg = createTestSVG(500, 500);
    const gridStrategy = {
      printableWidth: 190,
      printableHeight: 277,
      effectiveWidth: 180,
      effectiveHeight: 267,
      overlap: 10
    };
    
    const pagedSVG = createPagedSVG(svg, 0, 0, gridStrategy);
    const clipPath = pagedSVG.querySelector('clipPath');
    const rect = clipPath.querySelector('rect');
    
    expect(clipPath.id).toBe('page-0-0');
    expect(rect.getAttribute('x')).toBe('-10'); // 0 * 180 - 10
    expect(rect.getAttribute('y')).toBe('-10'); // 0 * 267 - 10
    expect(rect.getAttribute('width')).toBe('190');
    expect(rect.getAttribute('height')).toBe('277');
  });
});

// テスト用のヘルパー関数
function createTestSVG(width = 100, height = 100) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', `${width}mm`);
  svg.setAttribute('height', `${height}mm`);
  
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'seam');
  path.setAttribute('d', `M 0,0 L ${width},0 L ${width},${height} L 0,${height} Z`);
  path.style.strokeWidth = '1px';
  
  g.appendChild(path);
  svg.appendChild(g);
  
  return svg;
}
```

### テスト実行設定

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.js'],
  },
});

// test/setup.js
import { beforeEach } from 'vitest';

beforeEach(() => {
  // 各テスト前にDOMをクリア
  document.body.innerHTML = '';
});

// package.json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui"
  },
  "devDependencies": {
    "vitest": "^0.34.0",
    "happy-dom": "^10.0.0"
  }
}
```

## 注意事項

- Blenderの単位系に関する問題は本ツールで吸収する
- PDF生成は完全にクライアントサイドで実行（サーバー不要）
- svg2pdf.jsはSVGの完全な仕様をサポートしていないため、複雑なSVGでは制限がある場合がある(Seams to Sewing Patternの出力は比較的シンプルなため問題は少ないと予想)
