// Load SVG file
export async function loadSVGFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(e.target.result, 'image/svg+xml');
                
                // Check for parse errors
                const parseError = svgDoc.querySelector('parsererror');
                if (parseError) {
                    reject(new Error('Failed to parse SVG file'));
                    return;
                }
                
                const svgElement = svgDoc.querySelector('svg');
                if (!svgElement) {
                    reject(new Error('No valid SVG element found'));
                    return;
                }
                
                resolve(svgElement);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Setup file handlers
export function setupFileHandlers(uploadArea, fileInput, onFileSelect) {
    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) onFileSelect(file);
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
    });
    
    // Click to select file
    uploadArea.addEventListener('click', (e) => {
        if (e.target === uploadArea || e.target.closest('.upload-icon')) {
            fileInput.click();
        }
    });
}

// Apply scale correction to SVG
export function scaleSVG(svgElement, scaleFactor = 0.001) {
    console.log('scaleSVG called with scale factor:', scaleFactor);
    
    // If scale factor is 1, no scaling needed
    if (scaleFactor === 1) {
        console.log('Scale factor is 1, no scaling applied');
        return;
    }
    
    // Get current viewBox
    const viewBox = svgElement.viewBox.baseVal;
    console.log('Original viewBox:', {
        x: viewBox.x, y: viewBox.y, 
        width: viewBox.width, height: viewBox.height
    });
    
    // Scale viewBox
    svgElement.setAttribute('viewBox', `${viewBox.x * scaleFactor} ${viewBox.y * scaleFactor} ${viewBox.width * scaleFactor} ${viewBox.height * scaleFactor}`);
    
    // Scale width and height attributes if they exist and have units
    const widthAttr = svgElement.getAttribute('width');
    const heightAttr = svgElement.getAttribute('height');
    
    if (widthAttr && widthAttr.endsWith('mm')) {
        const width = parseFloat(widthAttr);
        svgElement.setAttribute('width', `${width * scaleFactor}mm`);
    }
    
    if (heightAttr && heightAttr.endsWith('mm')) {
        const height = parseFloat(heightAttr);
        svgElement.setAttribute('height', `${height * scaleFactor}mm`);
    }
    
    // Scale all coordinate-based attributes
    const elementsToScale = svgElement.querySelectorAll('*');
    elementsToScale.forEach(element => {
        // Scale stroke-width if present
        const strokeWidth = element.getAttribute('stroke-width');
        if (strokeWidth && !isNaN(parseFloat(strokeWidth))) {
            element.setAttribute('stroke-width', parseFloat(strokeWidth) * scaleFactor);
        }
        
        // Scale path d attributes
        if (element.tagName === 'path') {
            const dAttr = element.getAttribute('d');
            if (dAttr) {
                const scaledPath = scalePathData(dAttr, scaleFactor);
                element.setAttribute('d', scaledPath);
            }
        }
        
        // Scale circle attributes
        if (element.tagName === 'circle') {
            ['cx', 'cy', 'r'].forEach(attr => {
                const value = element.getAttribute(attr);
                if (value && !isNaN(parseFloat(value))) {
                    element.setAttribute(attr, parseFloat(value) * scaleFactor);
                }
            });
        }
        
        // Scale rect attributes
        if (element.tagName === 'rect') {
            ['x', 'y', 'width', 'height', 'rx', 'ry'].forEach(attr => {
                const value = element.getAttribute(attr);
                if (value && !isNaN(parseFloat(value))) {
                    element.setAttribute(attr, parseFloat(value) * scaleFactor);
                }
            });
        }
        
        // Scale line attributes
        if (element.tagName === 'line') {
            ['x1', 'y1', 'x2', 'y2'].forEach(attr => {
                const value = element.getAttribute(attr);
                if (value && !isNaN(parseFloat(value))) {
                    element.setAttribute(attr, parseFloat(value) * scaleFactor);
                }
            });
        }
        
        // Scale text position attributes
        if (element.tagName === 'text') {
            ['x', 'y', 'font-size'].forEach(attr => {
                const value = element.getAttribute(attr);
                if (value && !isNaN(parseFloat(value))) {
                    element.setAttribute(attr, parseFloat(value) * scaleFactor);
                }
            });
        }
        
        // Scale ellipse attributes
        if (element.tagName === 'ellipse') {
            ['cx', 'cy', 'rx', 'ry'].forEach(attr => {
                const value = element.getAttribute(attr);
                if (value && !isNaN(parseFloat(value))) {
                    element.setAttribute(attr, parseFloat(value) * scaleFactor);
                }
            });
        }
        
        // Scale polygon and polyline points
        if (element.tagName === 'polygon' || element.tagName === 'polyline') {
            const points = element.getAttribute('points');
            if (points) {
                const scaledPoints = scalePointsData(points, scaleFactor);
                element.setAttribute('points', scaledPoints);
            }
        }
    });
    
    console.log('SVG scaling completed with factor:', scaleFactor);
}

// Helper function to scale path data
function scalePathData(pathData, scaleFactor) {
    return pathData.replace(/(-?\d+(?:\.\d+)?)/g, (match) => {
        return (parseFloat(match) * scaleFactor).toString();
    });
}

// Helper function to scale points data
function scalePointsData(pointsData, scaleFactor) {
    return pointsData.replace(/(-?\d+(?:\.\d+)?)/g, (match) => {
        return (parseFloat(match) * scaleFactor).toString();
    });
}

// Analyze SVG units (g elements that represent individual pattern pieces)
export function analyzeSVGUnits(svgElement) {
    const units = [];
    const groups = svgElement.querySelectorAll('g');
    
    groups.forEach((group, index) => {
        // Skip groups that are children of other groups (to avoid nested groups)
        if (group.parentElement.tagName === 'g') return;
        
        const bbox = getElementBoundingBox(group);
        if (bbox && bbox.width > 0 && bbox.height > 0) {
            units.push({
                index: index,
                element: group,
                className: group.getAttribute('class') || '',
                id: group.getAttribute('id') || '',
                boundingBox: bbox,
                width: bbox.width,
                height: bbox.height
            });
        }
    });
    
    console.log(`Found ${units.length} g element units:`, units.map(u => ({
        index: u.index,
        class: u.className,
        id: u.id,
        size: `${u.width.toFixed(1)}×${u.height.toFixed(1)}`,
        bbox: u.boundingBox
    })));
    
    return units;
}

// Calculate bounding box for an SVG element (g, path, etc.)
export function getElementBoundingBox(element) {
    try {
        // Ensure element is in DOM for bbox calculation
        let needsCleanup = false;
        let tempContainer = null;
        
        if (!element.ownerDocument || !element.isConnected) {
            // Element not in DOM, create temporary container
            tempContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            tempContainer.style.position = 'absolute';
            tempContainer.style.visibility = 'hidden';
            tempContainer.style.width = '10000px';
            tempContainer.style.height = '10000px';
            
            const clonedElement = element.cloneNode(true);
            tempContainer.appendChild(clonedElement);
            document.body.appendChild(tempContainer);
            element = clonedElement;
            needsCleanup = true;
        }
        
        // Get bounding box in local coordinates
        const bbox = element.getBBox();
        
        // Check if element has a transform
        const transform = element.getAttribute('transform');
        let offsetX = 0, offsetY = 0;
        
        if (transform) {
            // Parse translate transform
            const translateMatch = transform.match(/translate\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
            if (translateMatch) {
                offsetX = parseFloat(translateMatch[1]);
                offsetY = parseFloat(translateMatch[2]);
            }
        }
        
        // Apply transform offset to bounding box
        const result = {
            x: bbox.x + offsetX,
            y: bbox.y + offsetY,
            width: bbox.width,
            height: bbox.height,
            minX: bbox.x + offsetX,
            minY: bbox.y + offsetY,
            maxX: bbox.x + bbox.width + offsetX,
            maxY: bbox.y + bbox.height + offsetY
        };
        
        // Cleanup if needed
        if (needsCleanup && tempContainer) {
            document.body.removeChild(tempContainer);
        }
        
        return result;
    } catch (error) {
        console.error('Failed to calculate bounding box for element:', error);
        throw new Error(`Failed to calculate bounding box for element: ${error.message}`);
    }
}

// Calculate bounding box for a path's d attribute (kept for compatibility)
function getPathBoundingBox(pathData) {
    try {
        // Create a temporary SVG to calculate bounding box
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('d', pathData);
        tempSvg.appendChild(tempPath);
        
        // Temporarily add to DOM for measurement
        tempSvg.style.position = 'absolute';
        tempSvg.style.top = '-9999px';
        tempSvg.style.left = '-9999px';
        tempSvg.style.width = '1px';
        tempSvg.style.height = '1px';
        document.body.appendChild(tempSvg);
        
        const bbox = tempPath.getBBox();
        const result = {
            minX: bbox.x,
            minY: bbox.y,
            maxX: bbox.x + bbox.width,
            maxY: bbox.y + bbox.height
        };
        
        // Clean up
        document.body.removeChild(tempSvg);
        
        return result;
    } catch (error) {
        console.warn('Failed to calculate bounding box for path:', error);
        return null;
    }
}

// Check if all units fit within page constraints
export function checkUnitsPageConstraints(svgElement, settings) {
    console.log('checkUnitsPageConstraints called with settings:', settings);
    
    // SVG is already scaled when passed in, so don't scale again
    const scaledSVG = svgElement.cloneNode(true);
    
    const units = analyzeSVGUnits(scaledSVG);
    const gridStrategy = getGridStrategy(settings);
    
    console.log('Grid strategy:', gridStrategy);
    console.log('Found units:', units);
    
    const violations = [];
    
    units.forEach(unit => {
        const unitWidth = unit.width;
        const unitHeight = unit.height;
        
        console.log(`Checking unit ${unit.index}: ${unitWidth}x${unitHeight} vs page ${gridStrategy.printableWidth}x${gridStrategy.printableHeight}`);
        
        // Check if unit exceeds page printable area
        if (unitWidth > gridStrategy.printableWidth || unitHeight > gridStrategy.printableHeight) {
            const violation = {
                unitIndex: unit.index,
                unitClass: unit.className,
                unitId: unit.id,
                unitSize: {
                    width: unitWidth,
                    height: unitHeight
                },
                pageSize: {
                    width: gridStrategy.printableWidth,
                    height: gridStrategy.printableHeight
                },
                exceedsWidth: unitWidth > gridStrategy.printableWidth,
                exceedsHeight: unitHeight > gridStrategy.printableHeight
            };
            console.log('Found violation:', violation);
            violations.push(violation);
        }
    });
    
    const result = {
        isValid: violations.length === 0,
        violations: violations,
        totalUnits: units.length,
        pageConstraints: {
            printableWidth: gridStrategy.printableWidth,
            printableHeight: gridStrategy.printableHeight,
            paperSize: settings.paperSize,
            orientation: settings.orientation
        }
    };
    
    console.log('Constraint check result:', result);
    return result;
}

// Get grid strategy (moved from pdf-generator.js for reuse)
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

// Calculate page layout
export function calculatePageLayout(svgElement, gridStrategy) {
    // Use the scaled physical size (both viewBox and size attributes are now scaled)
    const widthAttr = svgElement.getAttribute('width');
    const heightAttr = svgElement.getAttribute('height');
    
    let svgWidth, svgHeight;
    
    if (widthAttr && widthAttr.endsWith('mm')) {
        svgWidth = parseFloat(widthAttr);
    } else {
        // Fallback to viewBox if no mm units (now also scaled)
        const viewBox = svgElement.viewBox.baseVal;
        svgWidth = viewBox.width;
    }
    
    if (heightAttr && heightAttr.endsWith('mm')) {
        svgHeight = parseFloat(heightAttr);
    } else {
        // Fallback to viewBox if no mm units (now also scaled)
        const viewBox = svgElement.viewBox.baseVal;
        svgHeight = viewBox.height;
    }
    
    const pagesX = Math.ceil(svgWidth / gridStrategy.effectiveWidth);
    const pagesY = Math.ceil(svgHeight / gridStrategy.effectiveHeight);
    const totalPages = pagesX * pagesY;
    
    return {
        pagesX,
        pagesY,
        totalPages,
        svgWidth,
        svgHeight
    };
}

// Create paged SVG
export function createPagedSVG(originalSVG, pageX, pageY, gridStrategy) {
    const { printableWidth, printableHeight, effectiveWidth, effectiveHeight, overlap } = gridStrategy;
    
    // Clone SVG
    const pagedSVG = originalSVG.cloneNode(true);
    
    // Clipping path ID
    const clipId = `page-${pageX}-${pageY}`;
    
    // Define clipping area
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', pageX * effectiveWidth - overlap);
    rect.setAttribute('y', pageY * effectiveHeight - overlap);
    rect.setAttribute('width', printableWidth);
    rect.setAttribute('height', printableHeight);
    
    clipPath.appendChild(rect);
    
    // Get or create defs element
    let defs = pagedSVG.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        pagedSVG.insertBefore(defs, pagedSVG.firstChild);
    }
    defs.appendChild(clipPath);
    
    // Adjust viewBox
    pagedSVG.setAttribute('viewBox', 
        `${pageX * effectiveWidth - overlap} ${pageY * effectiveHeight - overlap} ${printableWidth} ${printableHeight}`
    );
    
    // Set size
    pagedSVG.setAttribute('width', `${printableWidth}mm`);
    pagedSVG.setAttribute('height', `${printableHeight}mm`);
    
    // Apply clipping path
    const groups = pagedSVG.querySelectorAll('svg > g');
    groups.forEach(g => {
        g.setAttribute('clip-path', `url(#${clipId})`);
    });
    
    return pagedSVG;
}

// Add alignment marks
export function addAlignmentMarks(svgElement, pageX, pageY, gridStrategy) {
    const marks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    marks.setAttribute('class', 'alignment-marks');
    
    const { printableWidth, printableHeight, effectiveWidth, effectiveHeight, overlap } = gridStrategy;
    
    // Calculate viewBox offset
    const offsetX = pageX * effectiveWidth - overlap;
    const offsetY = pageY * effectiveHeight - overlap;
    
    // Cross marks (four corners)
    const crossSize = 5;
    const positions = [
        { x: offsetX, y: offsetY },
        { x: offsetX + printableWidth, y: offsetY },
        { x: offsetX, y: offsetY + printableHeight },
        { x: offsetX + printableWidth, y: offsetY + printableHeight }
    ];
    
    positions.forEach(pos => {
        // Horizontal line
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', pos.x - crossSize);
        hLine.setAttribute('y1', pos.y);
        hLine.setAttribute('x2', pos.x + crossSize);
        hLine.setAttribute('y2', pos.y);
        hLine.setAttribute('stroke', 'black');
        hLine.setAttribute('stroke-width', '0.5');
        marks.appendChild(hLine);
        
        // Vertical line
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', pos.x);
        vLine.setAttribute('y1', pos.y - crossSize);
        vLine.setAttribute('x2', pos.x);
        vLine.setAttribute('y2', pos.y + crossSize);
        vLine.setAttribute('stroke', 'black');
        vLine.setAttribute('stroke-width', '0.5');
        marks.appendChild(vLine);
    });
    
    // Page number
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', offsetX + printableWidth / 2);
    text.setAttribute('y', offsetY + printableHeight - 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '8');
    text.setAttribute('fill', 'black');
    text.textContent = `Page ${pageX + 1}-${pageY + 1}`;
    marks.appendChild(text);
    
    // Overlap guide (dashed line)
    if (overlap > 0) {
        const guideRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        guideRect.setAttribute('x', offsetX + overlap);
        guideRect.setAttribute('y', offsetY + overlap);
        guideRect.setAttribute('width', effectiveWidth);
        guideRect.setAttribute('height', effectiveHeight);
        guideRect.setAttribute('fill', 'none');
        guideRect.setAttribute('stroke', 'gray');
        guideRect.setAttribute('stroke-width', '0.5');
        guideRect.setAttribute('stroke-dasharray', '5,5');
        marks.appendChild(guideRect);
    }
    
    svgElement.appendChild(marks);
}