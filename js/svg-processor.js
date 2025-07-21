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