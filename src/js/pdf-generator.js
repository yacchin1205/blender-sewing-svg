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
    
    // Apply Canvas clipping to textures
    await clipTexturesToPatternShapes(svgElement);
}


// Clip texture images to pattern shapes using Canvas API
async function clipTexturesToPatternShapes(svgElement) {
    const groups = svgElement.querySelectorAll('g[id^="pattern-piece"], g.pattern-unit');
    
    for (const group of groups) {
        const textureImage = group.querySelector('.texture-image');
        if (!textureImage) continue;
        
        // Find the actual clip path element from defs
        const clipPathId = textureImage.getAttribute('clip-path');
        let clipPathElement = null;
        let actualPath = null;
        
        if (clipPathId) {
            const match = clipPathId.match(/url\(#([^)]+)\)/);
            if (match) {
                clipPathElement = svgElement.querySelector(`#${match[1]}`);
                if (clipPathElement) {
                    actualPath = clipPathElement.querySelector('path');
                }
            }
        }
        
        // Fallback to seam paths if no clip path found
        if (!actualPath) {
            actualPath = group.querySelector('.seam-allowance') || group.querySelector('.seam');
            if (!actualPath) {
                throw new Error(`No clipping path available for texture in group ${group.id}. Group must contain clip-path reference or seam/seam-allowance paths.`);
            }
        }
        
        if (!actualPath) continue;
        
        try {
            // Create clipped texture
            const clippedImageUrl = await clipTextureToShape(textureImage, actualPath, group);
            
            // Replace the original image with clipped version
            textureImage.setAttribute('href', clippedImageUrl);
        } catch (error) {
            console.error(`Failed to clip texture for ${group.id}:`, error);
            throw error; // Re-throw to propagate the error
        }
    }
}

// Get bounding box from path data string
function getPathBBoxFromData(pathData) {
    if (!pathData) {
        throw new Error('Invalid path data: empty or null');
    }
    
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.style.position = 'absolute';
    tempSvg.style.visibility = 'hidden';
    document.body.appendChild(tempSvg);
    
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', pathData);
    tempSvg.appendChild(tempPath);
    
    const bbox = tempPath.getBBox();
    document.body.removeChild(tempSvg);
    
    return bbox;
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
                
                // Get dimensions from the pattern shape (not the entire group)
                let bbox;
                
                try {
                    // Get bbox from the pattern shape, not the entire group
                    const patternPath = group.querySelector('.seam-allowance') || group.querySelector('.seam');
                    if (patternPath && patternPath.getBBox) {
                        bbox = patternPath.getBBox();
                        
                        // If bbox is empty, try alternate method
                        if (bbox.width === 0 || bbox.height === 0) {
                            bbox = getPathBBoxFromData(clipPath.getAttribute('d'));
                        }
                    } else {
                        bbox = clipPath.getBBox();
                    }
                } catch (e) {
                    console.error('Failed to get bounding box:', e);
                    throw new Error(`Failed to calculate bounding box for texture clipping: ${e.message}`);
                }
                
                const imgX = parseFloat(textureImage.getAttribute('x') || 0);
                const imgY = parseFloat(textureImage.getAttribute('y') || 0);
                const imgWidth = parseFloat(textureImage.getAttribute('width'));
                const imgHeight = parseFloat(textureImage.getAttribute('height'));
                
                
                // Check if bbox is valid
                if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
                    throw new Error(`Invalid bounding box for pattern shape in group ${group.id}: ${bbox?.width || 'undefined'}x${bbox?.height || 'undefined'}. This indicates corrupted pattern geometry.`);
                }
                
                // Set canvas size to the group's bounding box
                canvas.width = Math.ceil(bbox.width);
                canvas.height = Math.ceil(bbox.height);
                
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
                
                // Check if the clip path has a transform (inverse rotation)
                const clipTransform = clipPath.getAttribute('transform');
                
                ctx.save();
                
                // If clip path has transform, apply it before creating the path
                if (clipTransform) {
                    const rotateMatch = clipTransform.match(/rotate\(([^)]+)\)/);
                    if (rotateMatch) {
                        const [angle, cx, cy] = rotateMatch[1].split(/\s+/).map(Number);
                        ctx.translate(cx, cy);
                        ctx.rotate(angle * Math.PI / 180);
                        ctx.translate(-cx, -cy);
                    }
                }
                
                const path2D = new Path2D(pathData);
                ctx.clip(path2D);
                
                // Reset transform for image drawing
                if (clipTransform) {
                    ctx.restore();
                    ctx.save();
                }
                
                // Apply image transform if present
                const imgTransform = textureImage.getAttribute('transform');
                if (imgTransform) {
                    // Parse rotation from transform (e.g., "rotate(45 150 150)")
                    const rotateMatch = imgTransform.match(/rotate\(([^)]+)\)/);
                    if (rotateMatch) {
                        const [angle, cx, cy] = rotateMatch[1].split(/\s+/).map(Number);
                        // Apply rotation around the specified center
                        ctx.translate(cx, cy);
                        ctx.rotate(angle * Math.PI / 180);
                        ctx.translate(-cx, -cy);
                    }
                }
                
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
                
                // Remove transform since the image is now pre-rotated in the canvas
                textureImage.removeAttribute('transform');
                
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
    
    // Use the provided SVG which already has seam allowance applied from main.js
    let processedSVG = svgElement.cloneNode(true);
    
    // The SVG is already scaled and has seam allowance applied from main.js
    // No need to scale again
    const scaledSVG = processedSVG;
    
    // Prepare SVG for PDF: clip textures and make seam paths transparent
    await prepareSVGForPDF(scaledSVG);
    
    
    // Adjust stroke-width for seam-allowance paths to be scale-independent
    const seamAllowancePaths = scaledSVG.querySelectorAll('path.seam-allowance');
    seamAllowancePaths.forEach(path => {
        // Set stroke-width to a fixed value that looks good regardless of scale
        path.setAttribute('stroke-width', '2');
    });
    
    
    
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
    
    // Check for unplaced units and throw error with detailed information
    if (placement.unplacedUnits.length > 0) {
        const unplacedDetails = placement.unplacedUnits.map(unit => {
            const id = unit.id || `パターンピース ${unit.index + 1}`;
            return `- ${id}: ${unit.width.toFixed(1)}mm × ${unit.height.toFixed(1)}mm`;
        }).join('\n');
        
        const pageSize = `${gridStrategy.printableWidth}mm × ${gridStrategy.printableHeight}mm`;
        
        throw new Error(
            `PDF生成エラー: 型紙が用紙に配置できません\n\n` +
            `問題の型紙:\n${unplacedDetails}\n` +
            `用紙サイズ: ${pageSize}\n\n` +
            `テクスチャ画像を含む型紙のサイズ計算で内部エラーが発生しました。`
        );
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
    
    const gridStrategy = getGridStrategy(settings);
    // 既にスケール済みのSVGを使用
    const placement = calculateUnitPlacement(svgElement, gridStrategy);
    const pageCount = placement.pages.length || 1;
    
    return {
        width: width.toFixed(1),
        height: height.toFixed(1),
        pageCount
    };
}