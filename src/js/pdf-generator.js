import { scaleSVG } from './svg-processor.js';
import { calculateUnitPlacement, createPlacedUnitsSVG } from './unit-placement.js';
import { applySeamAllowance } from './seam-allowance.js';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

// Prepare SVG for PDF export by reorganizing elements for texture display
async function prepareSVGForPDF(svgElement) {
    // Remove clip-path attributes since svg2pdf.js doesn't support them
    const textureImages = svgElement.querySelectorAll('.texture-image');
    textureImages.forEach(image => {
        image.removeAttribute('clip-path');
    });
    if (textureImages.length > 0) {
        console.log(`Removed clip-path from ${textureImages.length} texture images`);
    }
    
    // Make all seam and seam-allowance paths transparent
    const seamPaths = svgElement.querySelectorAll('.seam, .seam-allowance');
    seamPaths.forEach(path => {
        // Ensure fill is transparent to show textures
        path.style.fill = 'transparent';
        path.setAttribute('fill', 'transparent');
        // Keep stroke visible
        if (!path.style.stroke && !path.getAttribute('stroke')) {
            path.style.stroke = '#000';
        }
    });
    if (seamPaths.length > 0) {
        console.log(`Made ${seamPaths.length} seam paths transparent for PDF`);
    }
    
    // Try Canvas clipping approach
    try {
        await clipTexturesToPatternShapes(svgElement);
    } catch (error) {
        console.error('Canvas clipping failed, using fallback approach:', error);
        // Fallback: just ensure textures are visible
        reorganizeTexturesForPDF(svgElement);
    }
}

// Fallback approach: reorganize elements to show textures
function reorganizeTexturesForPDF(svgElement) {
    const groups = svgElement.querySelectorAll('g[id^="pattern-piece"], g.pattern-unit');
    
    groups.forEach(group => {
        const textureImage = group.querySelector('.texture-image');
        if (!textureImage) return;
        
        // Check if group is visible
        const bbox = group.getBBox();
        if (bbox.width <= 0 || bbox.height <= 0) {
            return;
        }
        
        // Ensure texture is below the paths
        const firstPath = group.querySelector('.seam, .seam-allowance');
        if (firstPath && textureImage.nextSibling !== firstPath) {
            group.insertBefore(textureImage, firstPath);
        }
        
    });
}

// Clip texture images to pattern shapes using Canvas API
async function clipTexturesToPatternShapes(svgElement) {
    const groups = svgElement.querySelectorAll('g[id^="pattern-piece"], g.pattern-unit');
    if (groups.length > 0) {
        console.log(`Processing ${groups.length} pattern piece groups for texture clipping`);
    }
    
    for (const group of groups) {
        const textureImage = group.querySelector('.texture-image');
        if (!textureImage) continue;
        
        // Find the clipping path (seam-allowance or seam)
        const clipPath = group.querySelector('.seam-allowance') || group.querySelector('.seam');
        if (!clipPath) continue;
        
        try {
            // Create clipped texture
            const clippedImageUrl = await clipTextureToShape(textureImage, clipPath, group);
            
            // Replace the original image with clipped version
            textureImage.setAttribute('href', clippedImageUrl);
        } catch (error) {
            console.error(`Failed to clip texture for ${group.id}:`, error);
            throw error; // Re-throw to propagate the error
        }
    }
}

// Canvas-based texture clipping
async function clipTextureToShape(textureImage, clipPath, group) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            try {
                // Create canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Get dimensions
                let bbox;
                try {
                    bbox = group.getBBox();
                } catch (e) {
                    console.warn(`Failed to get bounding box for ${group.id}:`, e);
                    // Try to get bbox from the clip path instead
                    bbox = clipPath.getBBox();
                }
                
                const imgX = parseFloat(textureImage.getAttribute('x') || 0);
                const imgY = parseFloat(textureImage.getAttribute('y') || 0);
                const imgWidth = parseFloat(textureImage.getAttribute('width'));
                const imgHeight = parseFloat(textureImage.getAttribute('height'));
                
                
                // Check if bbox is valid
                if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
                    console.warn(`Invalid bounding box for ${group.id}, using image dimensions`);
                    // Use image dimensions as fallback
                    canvas.width = Math.ceil(imgWidth || 100);
                    canvas.height = Math.ceil(imgHeight || 100);
                    bbox = { x: imgX, y: imgY, width: imgWidth, height: imgHeight };
                } else {
                    // Set canvas size to the group's bounding box
                    canvas.width = Math.ceil(bbox.width);
                    canvas.height = Math.ceil(bbox.height);
                }
                
                // Final check for canvas size
                if (canvas.width <= 0 || canvas.height <= 0) {
                    throw new Error(`Invalid canvas size: ${canvas.width}x${canvas.height} for group ${group.id}`);
                }
                
                
                // Fill with white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Translate to group's coordinate system
                ctx.translate(-bbox.x, -bbox.y);
                
                // Create clipping path
                const pathData = clipPath.getAttribute('d');
                const path2D = new Path2D(pathData);
                
                // Apply transform if the path has one
                const transform = clipPath.getAttribute('transform');
                if (transform) {
                    // Parse and apply transform (simplified - may need more complex parsing)
                    const matrix = new DOMMatrix(transform);
                    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
                }
                
                // Set clipping path
                ctx.save();
                ctx.clip(path2D);
                
                // Draw the image at its position
                ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
                
                ctx.restore();
                
                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/png');
                
                // Validate data URL - a valid empty canvas will produce a short data URL
                if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
                    throw new Error(`Invalid data URL generated: ${dataUrl}`);
                }
                
                // Update image position to match canvas
                textureImage.setAttribute('x', bbox.x);
                textureImage.setAttribute('y', bbox.y);
                textureImage.setAttribute('width', bbox.width);
                textureImage.setAttribute('height', bbox.height);
                
                // Set both href and xlink:href for maximum compatibility
                textureImage.setAttribute('href', dataUrl);
                if (textureImage.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) {
                    textureImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);
                }
                
                
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = (e) => {
            const src = textureImage.getAttribute('href') || textureImage.getAttribute('xlink:href');
            reject(new Error(`Failed to load texture image: ${src?.substring(0, 50)}...`));
        };
        
        // Load the image
        const imageSrc = textureImage.getAttribute('href') || textureImage.getAttribute('xlink:href');
        if (!imageSrc) {
            reject(new Error('No image source found'));
            return;
        }
        
        // Handle cross-origin for data URLs
        if (imageSrc.startsWith('data:')) {
            img.src = imageSrc;
        } else {
            img.crossOrigin = 'anonymous';
            img.src = imageSrc;
        }
    });
}

// Main PDF generation function
export async function generatePDF(svgElement, settings) {
    console.log('Starting PDF generation with settings:', settings);
    
    console.log('Libraries loaded successfully');
    
    // Use the provided SVG which already has seam allowance applied from main.js
    let processedSVG = svgElement.cloneNode(true);
    
    // The SVG is already scaled and has seam allowance applied from main.js
    // No need to scale again
    const scaledSVG = processedSVG;
    
    // Prepare SVG for PDF: clip textures and make seam paths transparent
    await prepareSVGForPDF(scaledSVG);
    
    const originalViewBox = processedSVG.viewBox?.baseVal;
    console.log('SVG viewBox:', {
        x: originalViewBox?.x,
        y: originalViewBox?.y, 
        width: originalViewBox?.width,
        height: originalViewBox?.height
    });
    console.log('SVG attributes:', {
        width: processedSVG.getAttribute('width'),
        height: processedSVG.getAttribute('height')
    });
    
    // Adjust stroke-width for seam-allowance paths to be scale-independent
    const seamAllowancePaths = scaledSVG.querySelectorAll('path.seam-allowance');
    seamAllowancePaths.forEach(path => {
        // Set stroke-width to a fixed value that looks good regardless of scale
        path.setAttribute('stroke-width', '2');
    });
    
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
    
    // Always use multi-page generation (even for single page)
    return await generateMultiPagePDF(scaledSVG, settings);
}


// Generate multi-page PDF
async function generateMultiPagePDF(svgElement, settings) {
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
            
            // Prepare this page's SVG for PDF
            await prepareSVGForPDF(pagedSVG);
            
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
export function getGridStrategy(settings) {
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
        effectiveHeight: pageHeight - margin * 2 - overlap,
        seamAllowance: settings.seamAllowance || 0
    };
}

// プレビュー用のページ情報計算
export function calculatePageInfo(svgElement, settings) {
    if (!svgElement) return null;
    
    // svgElementは既にスケール済みなので、現在のサイズを使用
    const viewBox = svgElement.viewBox.baseVal;
    const width = viewBox.width;
    const height = viewBox.height;
    
    let pageCount = 1;
    if (settings.splitPages) {
        const gridStrategy = getGridStrategy(settings);
        // 既にスケール済みのSVGを使用
        const placement = calculateUnitPlacement(svgElement, gridStrategy);
        pageCount = placement.pages.length || 1;
    }
    
    return {
        width: width.toFixed(1),
        height: height.toFixed(1),
        pageCount
    };
}