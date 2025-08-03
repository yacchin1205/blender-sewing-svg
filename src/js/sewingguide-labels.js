/**
 * Sewingguide label management
 * Adds labels to sewingguide elements that appear in pairs
 */

/**
 * Find which pattern piece (with data-pattern-symbol) contains the given element
 * @param {Element} element - The sewingguide element
 * @returns {string|null} - The pattern symbol or null if not found
 */
function findContainingPatternSymbol(element) {
    let current = element.parentElement;
    while (current) {
        if (current.hasAttribute('data-pattern-symbol')) {
            return current.getAttribute('data-pattern-symbol');
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * Find the pattern piece element that contains the given element
 * @param {Element} element - The sewingguide element
 * @returns {Element|null} - The pattern element or null
 */
function findContainingPatternElement(element) {
    let current = element.parentElement;
    while (current) {
        if (current.hasAttribute('data-pattern-symbol')) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * Group sewingguide elements by their stroke color
 * @param {SVGElement} svg - The SVG element
 * @returns {Map<string, Element[]>} - Map of color to elements
 */
function groupSewingguidesByColor(svg) {
    const colorGroups = new Map();
    const sewingguides = svg.querySelectorAll('.sewinguide');
    
    sewingguides.forEach(element => {
        const stroke = element.getAttribute('stroke');
        if (stroke) {
            if (!colorGroups.has(stroke)) {
                colorGroups.set(stroke, []);
            }
            colorGroups.get(stroke).push(element);
        }
    });
    
    return colorGroups;
}

/**
 * Find the next available number for a symbol pair
 * @param {SVGElement} svg - The SVG element
 * @param {string} symbol1 - First symbol
 * @param {string} symbol2 - Second symbol
 * @returns {number} - Next available number
 */
function findNextAvailableNumber(svg, symbol1, symbol2) {
    // Normalize pair key for comparison
    const pairKey = [symbol1, symbol2].sort().join(':');
    
    // Get all existing labels
    const existingLabels = svg.querySelectorAll('[data-sewingguide-label]');
    const usedNumbers = new Set();
    
    existingLabels.forEach(element => {
        const label = element.getAttribute('data-sewingguide-label');
        const match = label.match(/^([A-Z]+):([A-Z]+):(\d+)$/);
        if (match) {
            const [_, s1, s2, num] = match;
            const existingKey = [s1, s2].sort().join(':');
            if (existingKey === pairKey) {
                usedNumbers.add(parseInt(num));
            }
        }
    });
    
    // Find smallest unused number
    let number = 1;
    while (usedNumbers.has(number)) {
        number++;
    }
    return number;
}

/**
 * Check if a position overlaps with existing labels
 * @param {SVGElement} svg - The SVG element containing labels
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} threshold - Distance threshold for overlap
 * @returns {boolean} - True if overlapping
 */
function isOverlapping(svg, x, y, threshold = 5) {
    const existingLabels = svg.querySelectorAll('.sewingguide-label');
    
    for (const label of existingLabels) {
        const labelX = parseFloat(label.getAttribute('x'));
        const labelY = parseFloat(label.getAttribute('y'));
        
        const distance = Math.sqrt(
            Math.pow(x - labelX, 2) + 
            Math.pow(y - labelY, 2)
        );
        
        if (distance < threshold) {
            return true;
        }
    }
    
    return false;
}

/**
 * Find adjusted position along path to avoid overlap
 * @param {SVGElement} svg - The SVG element containing labels
 * @param {SVGPathElement} pathElement - The path element
 * @param {Object} originalPoint - Original point {x, y}
 * @param {number} pathLength - Total path length
 * @returns {Object} - Adjusted point {x, y}
 */
function findNonOverlappingPosition(svg, pathElement, originalPoint, pathLength) {
    // Find the approximate position on path for the original point
    let bestLength = 0;
    let minDistance = Infinity;
    
    // Sample the path to find closest point
    for (let i = 0; i <= pathLength; i += pathLength / 20) {
        const point = pathElement.getPointAtLength(i);
        const distance = Math.sqrt(
            Math.pow(point.x - originalPoint.x, 2) + 
            Math.pow(point.y - originalPoint.y, 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            bestLength = i;
        }
    }
    
    // Check if original position has overlap
    if (!isOverlapping(svg, originalPoint.x, originalPoint.y)) {
        return originalPoint;
    }
    
    // Try positions along the path
    const offsets = [5, -5, 10, -10, 15, -15];
    for (const offset of offsets) {
        const newLength = Math.max(0, Math.min(pathLength, bestLength + offset));
        const newPoint = pathElement.getPointAtLength(newLength);
        
        if (!isOverlapping(svg, newPoint.x, newPoint.y)) {
            return newPoint;
        }
    }
    
    // If all positions overlap, return original
    return originalPoint;
}

/**
 * Add a text label near the sewingguide element
 * Position is determined by which endpoint is inside the seam polygon
 * @param {Element} element - The sewingguide element
 * @param {string} labelText - The label text
 */
function addLabelText(element, labelText) {
    if (element.tagName !== 'path') {
        console.warn('Sewingguide element is not a path, skipping label');
        return;
    }
    
    // Get pattern piece that contains this element
    const patternElement = findContainingPatternElement(element);
    if (!patternElement) {
        console.warn('Cannot find pattern piece for sewingguide element');
        return;
    }
    
    // Find the seam path within the pattern
    const seamPath = patternElement.querySelector('path.seam');
    if (!seamPath) {
        console.warn('Cannot find seam path in pattern piece');
        return;
    }
    
    // Get path endpoints
    const pathLength = element.getTotalLength();
    const startPoint = element.getPointAtLength(0);
    const endPoint = element.getPointAtLength(pathLength);
    
    let labelPoint;
    
    // Try to use isPointInFill if available
    if (seamPath.isPointInFill) {
        const svg = seamPath.ownerSVGElement;
        const testStartPoint = svg.createSVGPoint();
        testStartPoint.x = startPoint.x;
        testStartPoint.y = startPoint.y;
        
        const testEndPoint = svg.createSVGPoint();
        testEndPoint.x = endPoint.x;
        testEndPoint.y = endPoint.y;
        
        const startInside = seamPath.isPointInFill(testStartPoint);
        const endInside = seamPath.isPointInFill(testEndPoint);
        
        if (startInside && !endInside) {
            labelPoint = startPoint;
        } else if (!startInside && endInside) {
            labelPoint = endPoint;
        } else if (startInside && endInside) {
            // Both inside, use the start point
            labelPoint = startPoint;
        } else {
            // Neither inside, use the start point
            labelPoint = startPoint;
        }
    } else {
        // Fallback to pattern center distance logic
        console.warn('isPointInFill not available, using distance to pattern center');
        
        // Get pattern center
        const patternBBox = patternElement.getBBox();
        const patternCenter = {
            x: patternBBox.x + patternBBox.width / 2,
            y: patternBBox.y + patternBBox.height / 2
        };
        
        // Calculate distances to pattern center
        const startDistance = Math.sqrt(
            Math.pow(startPoint.x - patternCenter.x, 2) + 
            Math.pow(startPoint.y - patternCenter.y, 2)
        );
        const endDistance = Math.sqrt(
            Math.pow(endPoint.x - patternCenter.x, 2) + 
            Math.pow(endPoint.y - patternCenter.y, 2)
        );
        
        // Choose the point closer to pattern center
        labelPoint = startDistance < endDistance ? startPoint : endPoint;
    }
    
    // Get the SVG element containing this sewingguide
    const svg = element.ownerSVGElement || element.closest('svg') || document.querySelector('svg');
    
    // Adjust position if overlapping with existing labels
    const adjustedPoint = findNonOverlappingPosition(svg, element, labelPoint, pathLength);
    
    // Create text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', adjustedPoint.x);
    text.setAttribute('y', adjustedPoint.y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '3');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('fill', '#000000');
    text.setAttribute('class', 'sewingguide-label');
    text.textContent = labelText;
    
    // Append text to the pattern group to ensure it appears on top and follows transforms
    // SVG rendering order is based on DOM order - later elements are drawn on top
    patternElement.appendChild(text);
}

/**
 * Assign labels to sewingguide elements that appear in pairs
 * @param {SVGElement} svg - The SVG element to process
 */
export function assignSewingguideLabels(svg) {
    console.log('Assigning sewingguide labels...');
    
    // Group by color
    const colorGroups = groupSewingguidesByColor(svg);
    console.log(`Found ${colorGroups.size} unique sewingguide colors`);
    
    let pairCount = 0;
    let warningCount = 0;
    
    colorGroups.forEach((elements, color) => {
        if (elements.length === 2) {
            // Process pairs
            const symbol1 = findContainingPatternSymbol(elements[0]);
            const symbol2 = findContainingPatternSymbol(elements[1]);
            
            if (!symbol1 || !symbol2) {
                console.warn(`Sewingguide elements with color ${color} are not within pattern pieces`);
                return;
            }
            
            const number = findNextAvailableNumber(svg, symbol1, symbol2);
            
            // Sort symbols alphabetically for consistent display
            const [first, second] = [symbol1, symbol2].sort();
            const labelText = `${first}:${second}:${number}`;
            
            // Set attributes (store original order for reference)
            elements[0].setAttribute('data-sewingguide-label', labelText);
            elements[0].setAttribute('data-original-symbols', `${symbol1}:${symbol2}`);
            elements[1].setAttribute('data-sewingguide-label', labelText);
            elements[1].setAttribute('data-original-symbols', `${symbol2}:${symbol1}`);
            
            // Add visual labels (both show the same sorted label)
            addLabelText(elements[0], labelText);
            addLabelText(elements[1], labelText);
            
            pairCount++;
        } else if (elements.length > 2) {
            console.warn(`Sewingguide color ${color} appears ${elements.length} times (expected 2 for pair matching)`);
            warningCount++;
        }
    });
    
    console.log(`Assigned labels to ${pairCount} sewingguide pairs`);
    if (warningCount > 0) {
        console.log(`${warningCount} colors had more than 2 occurrences`);
    }
}

/**
 * Update all sewingguide labels in the SVG
 * Called after DOM modifications to ensure labels are visible
 * @param {SVGElement} svg - The SVG element
 */
export function updateAllSewingguideLabels(svg) {
    // Remove existing visual labels
    svg.querySelectorAll('.sewingguide-label').forEach(label => label.remove());
    
    // Re-add labels based on data attributes
    const labeledElements = svg.querySelectorAll('[data-sewingguide-label]');
    labeledElements.forEach(element => {
        const label = element.getAttribute('data-sewingguide-label');
        if (label) {
            addLabelText(element, label);
        }
    });
}