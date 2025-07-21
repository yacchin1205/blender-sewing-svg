import { scaleSVG, calculatePageLayout, createPagedSVG, addAlignmentMarks } from './svg-processor.js';

// Main PDF generation function
export async function generatePDF(svgElement, settings) {
    console.log('Starting PDF generation with settings:', settings);
    
    const { jsPDF } = window.jspdf;
    
    if (!jsPDF) {
        console.error('jsPDF not available');
        throw new Error('jsPDF library not loaded');
    }
    
    if (!window.svg2pdf || !window.svg2pdf.svg2pdf) {
        console.error('svg2pdf not available');
        throw new Error('svg2pdf.js library not loaded');
    }
    
    // Get the actual svg2pdf function from the module
    const svg2pdf = window.svg2pdf.svg2pdf;
    
    console.log('Libraries loaded successfully');
    
    // Clone SVG and apply scale correction
    const scaledSVG = svgElement.cloneNode(true);
    const originalViewBox = svgElement.viewBox?.baseVal;
    console.log('Original SVG viewBox:', {
        x: originalViewBox?.x,
        y: originalViewBox?.y, 
        width: originalViewBox?.width,
        height: originalViewBox?.height
    });
    console.log('Original SVG attributes:', {
        width: svgElement.getAttribute('width'),
        height: svgElement.getAttribute('height')
    });
    
    scaleSVG(scaledSVG, settings.scaleFactor || 0.001);
    
    const scaledViewBox = scaledSVG.viewBox?.baseVal;
    console.log('Scaled SVG viewBox:', {
        x: scaledViewBox?.x,
        y: scaledViewBox?.y,
        width: scaledViewBox?.width, 
        height: scaledViewBox?.height
    });
    console.log('Scaled SVG attributes:', {
        width: scaledSVG.getAttribute('width'),
        height: scaledSVG.getAttribute('height')
    });
    
    // Log path elements for debugging
    const paths = scaledSVG.querySelectorAll('path');
    const circles = scaledSVG.querySelectorAll('circle');
    const transforms = scaledSVG.querySelectorAll('g[transform]');
    
    console.log('Number of paths found:', paths.length);
    console.log('Number of circles found:', circles.length);
    console.log('Number of transform groups:', transforms.length);
    
    if (transforms.length > 0) {
        console.log('First transform:', transforms[0].getAttribute('transform'));
    }
    
    if (paths.length > 0) {
        console.log('First path sample:', paths[0].getAttribute('d').substring(0, 100) + '...');
        console.log('First path class:', paths[0].getAttribute('class'));
        console.log('First path stroke-width:', paths[0].style.strokeWidth || paths[0].getAttribute('stroke-width'));
        console.log('First path stroke:', paths[0].style.stroke || paths[0].getAttribute('stroke'));
        console.log('First path fill:', paths[0].style.fill || paths[0].getAttribute('fill'));
    }
    
    if (circles.length > 0) {
        console.log('First circle cx:', circles[0].getAttribute('cx'));
        console.log('First circle cy:', circles[0].getAttribute('cy'));
        console.log('First circle r:', circles[0].getAttribute('r'));
        console.log('First circle fill:', circles[0].getAttribute('fill'));
    }
    
    // Log the complete SVG structure being sent to PDF
    console.log('Complete SVG being sent to PDF (first 500 chars):', scaledSVG.outerHTML.substring(0, 500) + '...');
    
    if (settings.splitPages) {
        return await generateMultiPagePDF(scaledSVG, settings);
    } else {
        return await generateSinglePagePDF(scaledSVG, settings);
    }
}

// Generate single page PDF
async function generateSinglePagePDF(svgElement, settings) {
    console.log('Generating single page PDF');
    
    const { jsPDF } = window.jspdf;
    const gridStrategy = getGridStrategy(settings);
    
    console.log('Grid strategy:', gridStrategy);
    
    // Create PDF document
    const doc = new jsPDF({
        orientation: settings.orientation,
        unit: 'mm',
        format: settings.paperSize
    });
    
    console.log('PDF document created');
    
    // Prepare SVG for PDF conversion
    const svgClone = svgElement.cloneNode(true);
    
    // Ensure SVG has proper dimensions
    const viewBox = svgClone.viewBox?.baseVal;
    if (viewBox) {
        svgClone.setAttribute('width', viewBox.width + 'mm');
        svgClone.setAttribute('height', viewBox.height + 'mm');
    }
    
    // Temporarily add SVG to DOM to ensure CSS styles are applied
    svgClone.style.position = 'absolute';
    svgClone.style.top = '-9999px';
    svgClone.style.left = '-9999px';
    document.body.appendChild(svgClone);
    
    // Force style computation
    window.getComputedStyle(svgClone).display;
    
    console.log('SVG prepared for conversion:', {
        width: svgClone.getAttribute('width'),
        height: svgClone.getAttribute('height'),
        viewBox: svgClone.getAttribute('viewBox')
    });
    
    // Draw SVG to PDF
    try {
        console.log('Starting svg2pdf conversion...');
        
        await window.svg2pdf.svg2pdf(svgClone, doc, {
            x: gridStrategy.margin,
            y: gridStrategy.margin,
            width: gridStrategy.printableWidth,
            height: gridStrategy.printableHeight
        });
        
        console.log('SVG to PDF conversion completed');
        
        // Download PDF
        doc.save('sewing-pattern.pdf');
        console.log('PDF download initiated');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            svgElement: svgClone.outerHTML.substring(0, 200) + '...'
        });
        throw new Error('Failed to generate PDF: ' + error.message);
    } finally {
        // Remove temporary SVG from DOM
        if (svgClone.parentNode) {
            svgClone.parentNode.removeChild(svgClone);
        }
    }
}

// Generate multi-page PDF
async function generateMultiPagePDF(svgElement, settings) {
    const { jsPDF } = window.jspdf;
    const svg2pdf = window.svg2pdf.svg2pdf;
    const gridStrategy = getGridStrategy(settings);
    
    // ページレイアウトを計算
    const layout = calculatePageLayout(svgElement, gridStrategy);
    
    if (layout.totalPages === 0) {
        throw new Error('有効なページが生成できませんでした');
    }
    
    // PDF文書を作成
    const doc = new jsPDF({
        orientation: settings.orientation,
        unit: 'mm',
        format: settings.paperSize
    });
    
    try {
        // 各ページを生成
        for (let y = 0; y < layout.pagesY; y++) {
            for (let x = 0; x < layout.pagesX; x++) {
                // 最初のページ以外は新しいページを追加
                if (x > 0 || y > 0) {
                    doc.addPage();
                }
                
                // ページ用のSVGを作成
                const pagedSVG = createPagedSVG(svgElement, x, y, gridStrategy);
                
                // 位置合わせマークを追加
                if (settings.addMarks) {
                    addAlignmentMarks(pagedSVG, x, y, gridStrategy);
                }
                
                // Temporarily add SVG to DOM to ensure CSS styles are applied
                pagedSVG.style.position = 'absolute';
                pagedSVG.style.top = '-9999px';
                pagedSVG.style.left = '-9999px';
                document.body.appendChild(pagedSVG);
                
                try {
                    // Force style computation
                    window.getComputedStyle(pagedSVG).display;
                    
                    // SVGをPDFに描画
                    await svg2pdf(pagedSVG, doc, {
                        x: gridStrategy.margin,
                        y: gridStrategy.margin,
                        width: gridStrategy.printableWidth,
                        height: gridStrategy.printableHeight
                    });
                } finally {
                    // Remove temporary SVG from DOM
                    if (pagedSVG.parentNode) {
                        pagedSVG.parentNode.removeChild(pagedSVG);
                    }
                }
            }
        }
        
        // PDFをダウンロード
        const fileName = `sewing-pattern-${layout.pagesX}x${layout.pagesY}.pdf`;
        doc.save(fileName);
        
    } catch (error) {
        console.error('PDF生成エラー:', error);
        throw new Error('PDFの生成に失敗しました');
    }
}

// 用紙設定に基づくグリッド戦略の取得
function getGridStrategy(settings) {
    const paperSizes = {
        a4: { width: 210, height: 297 },
        a3: { width: 297, height: 420 },
        b4: { width: 257, height: 364 },
        b5: { width: 182, height: 257 }
    };
    
    const size = paperSizes[settings.paperSize] || paperSizes.a4;
    const isLandscape = settings.orientation === 'landscape';
    
    const pageWidth = isLandscape ? size.height : size.width;
    const pageHeight = isLandscape ? size.width : size.height;
    const margin = 10;
    const overlap = settings.overlap || 0;
    
    return {
        pageWidth,
        pageHeight,
        margin,
        overlap,
        printableWidth: pageWidth - margin * 2,
        printableHeight: pageHeight - margin * 2,
        effectiveWidth: pageWidth - margin * 2 - overlap,
        effectiveHeight: pageHeight - margin * 2 - overlap
    };
}

// プレビュー用のページ情報計算
export function calculatePageInfo(svgElement, settings) {
    if (!svgElement) return null;
    
    const viewBox = svgElement.viewBox.baseVal;
    const scaleFactor = settings.scaleFactor || 0.001;
    const width = viewBox.width * scaleFactor;
    const height = viewBox.height * scaleFactor;
    
    let pageCount = 1;
    if (settings.splitPages) {
        const gridStrategy = getGridStrategy(settings);
        // スケール済みSVGでページレイアウトを計算するため、一時的にSVGをスケール
        const tempSVG = svgElement.cloneNode(true);
        // svg-processor.jsからscaleSVGをインポートして使用
        // 注意: この関数は同期的なので、import()は使えない
        // 代わりに、scaledSVGを直接渡すように変更する必要がある
        
        // 一時的な解決策: スケールされたサイズでページレイアウトを計算
        tempSVG.setAttribute('viewBox', `0 0 ${width} ${height}`);
        tempSVG.setAttribute('width', `${width}mm`);
        tempSVG.setAttribute('height', `${height}mm`);
        
        const layout = calculatePageLayout(tempSVG, gridStrategy);
        pageCount = layout.totalPages;
    }
    
    return {
        width: width.toFixed(1),
        height: height.toFixed(1),
        pageCount
    };
}