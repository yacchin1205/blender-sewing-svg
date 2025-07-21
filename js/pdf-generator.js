import { scaleSVG } from './svg-processor.js';
import { calculateUnitPlacement, createPlacedUnitsSVG } from './unit-placement.js';

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
    
    // Use unit placement for single page as well
    const placement = calculateUnitPlacement(svgElement, gridStrategy);
    
    if (placement.pages.length === 0 && placement.unplacedUnits.length === 0) {
        throw new Error('パターンピースが検出されませんでした');
    }
    
    if (placement.unplacedUnits.length > 0) {
        console.warn(`${placement.unplacedUnits.length} units could not be placed on any page`);
    }
    
    // Use unit placement even for single page
    const page = placement.pages[0] || { units: [] };
    const pagedSVG = createPlacedUnitsSVG(svgElement, page, gridStrategy);
    
    // Temporarily add SVG to DOM to ensure CSS styles are applied
    pagedSVG.style.position = 'absolute';
    pagedSVG.style.top = '-9999px';
    pagedSVG.style.left = '-9999px';
    document.body.appendChild(pagedSVG);
    
    try {
        // Force style computation
        window.getComputedStyle(pagedSVG).display;
        
        // Draw SVG to PDF
        await window.svg2pdf.svg2pdf(pagedSVG, doc, {
            x: gridStrategy.margin,
            y: gridStrategy.margin,
            width: gridStrategy.printableWidth,
            height: gridStrategy.printableHeight
        });
        
        // Download PDF
        doc.save('sewing-pattern.pdf');
        
    } finally {
        // Remove temporary SVG from DOM
        if (pagedSVG.parentNode) {
            pagedSVG.parentNode.removeChild(pagedSVG);
        }
    }
}

// Generate multi-page PDF
async function generateMultiPagePDF(svgElement, settings) {
    const { jsPDF } = window.jspdf;
    const svg2pdf = window.svg2pdf.svg2pdf;
    const gridStrategy = getGridStrategy(settings);
    
    // Calculate unit placement to avoid cutting units across pages
    const placement = calculateUnitPlacement(svgElement, gridStrategy);
    
    if (placement.pages.length === 0 && placement.unplacedUnits.length === 0) {
        throw new Error('パターンピースが検出されませんでした');
    }
    
    // Warn about unplaced units
    if (placement.unplacedUnits.length > 0) {
        console.warn(`${placement.unplacedUnits.length} units could not be placed on any page`);
        // TODO: Show warning to user about unplaced units
    }
    
    // PDF文書を作成
    const doc = new jsPDF({
        orientation: settings.orientation,
        unit: 'mm',
        format: settings.paperSize
    });
    
    try {
        // Generate each page with placed units
        for (let i = 0; i < placement.pages.length; i++) {
            const page = placement.pages[i];
            
            // Add new page for all except first
            if (i > 0) {
                doc.addPage();
            }
            
            // Create SVG for this page with placed units
            const pagedSVG = createPlacedUnitsSVG(svgElement, page, gridStrategy);
            
            // Add alignment marks if requested
            if (settings.addMarks) {
                addPageMarks(pagedSVG, i, placement.pages.length, gridStrategy);
            }
            
            // Temporarily add SVG to DOM to ensure CSS styles are applied
            pagedSVG.style.position = 'absolute';
            pagedSVG.style.top = '-9999px';
            pagedSVG.style.left = '-9999px';
            document.body.appendChild(pagedSVG);
            
            try {
                // Force style computation
                window.getComputedStyle(pagedSVG).display;
                
                // Draw SVG to PDF
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
        
        // Download PDF
        const fileName = `sewing-pattern-${placement.pages.length}pages.pdf`;
        doc.save(fileName);
        
    } catch (error) {
        console.error('PDF生成エラー:', error);
        throw new Error('PDFの生成に失敗しました');
    }
}

// Add page marks (page number and alignment marks)
function addPageMarks(svgElement, pageIndex, totalPages, gridStrategy) {
    const marks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    marks.setAttribute('class', 'page-marks');
    
    // Add page number
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', gridStrategy.printableWidth / 2);
    text.setAttribute('y', gridStrategy.printableHeight - 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '8');
    text.setAttribute('fill', 'black');
    text.textContent = `Page ${pageIndex + 1} / ${totalPages}`;
    marks.appendChild(text);
    
    // Add corner marks
    const cornerSize = 5;
    const corners = [
        { x: 0, y: 0 },
        { x: gridStrategy.printableWidth, y: 0 },
        { x: 0, y: gridStrategy.printableHeight },
        { x: gridStrategy.printableWidth, y: gridStrategy.printableHeight }
    ];
    
    corners.forEach(corner => {
        // Horizontal line
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', corner.x - cornerSize);
        hLine.setAttribute('y1', corner.y);
        hLine.setAttribute('x2', corner.x + cornerSize);
        hLine.setAttribute('y2', corner.y);
        hLine.setAttribute('stroke', 'black');
        hLine.setAttribute('stroke-width', '0.5');
        marks.appendChild(hLine);
        
        // Vertical line
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', corner.x);
        vLine.setAttribute('y1', corner.y - cornerSize);
        vLine.setAttribute('x2', corner.x);
        vLine.setAttribute('y2', corner.y + cornerSize);
        vLine.setAttribute('stroke', 'black');
        vLine.setAttribute('stroke-width', '0.5');
        marks.appendChild(vLine);
    });
    
    svgElement.appendChild(marks);
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
        // スケール済みSVGでユニット配置を計算
        const tempSVG = svgElement.cloneNode(true);
        tempSVG.setAttribute('viewBox', `0 0 ${width} ${height}`);
        tempSVG.setAttribute('width', `${width}mm`);
        tempSVG.setAttribute('height', `${height}mm`);
        scaleSVG(tempSVG, scaleFactor);
        
        const placement = calculateUnitPlacement(tempSVG, gridStrategy);
        pageCount = placement.pages.length || 1;
    }
    
    return {
        width: width.toFixed(1),
        height: height.toFixed(1),
        pageCount
    };
}