// Unit placement algorithm for multi-page PDF generation
// This module ensures pattern pieces (units) are not cut across pages

import { analyzeSVGUnits, getElementBoundingBox } from './svg-processor.js';

// Analyze units including seam allowance paths
function analyzeUnitsWithSeamAllowance(svgElement) {
    // First, check if the SVG has any seam-allowance paths at all
    const allSeamAllowancePaths = svgElement.querySelectorAll('path.seam-allowance');
    
    const units = analyzeSVGUnits(svgElement);
    
    // If there are seam allowance paths, we need to recalculate all unit bounds
    if (allSeamAllowancePaths.length > 0) {
        
        units.forEach(unit => {
            // For units with seam allowance, the bounding box needs to include the expanded area
            // The seam-allowance paths should be siblings of the seam paths within the unit
            const seamPaths = unit.element.querySelectorAll('path.seam');
            const seamAllowancePaths = unit.element.querySelectorAll('path.seam-allowance');
            
            
            if (seamAllowancePaths.length > 0) {
                // Recalculate bounding box to include all paths
                const newBBox = getElementBoundingBox(unit.element);
                
                if (newBBox && newBBox.width > 0 && newBBox.height > 0) {
                    const oldWidth = unit.width;
                    const oldHeight = unit.height;
                    const oldBBox = { ...unit.boundingBox };
                    
                    // Update all bounding box properties including position
                    unit.boundingBox = newBBox;
                    unit.width = newBBox.width;
                    unit.height = newBBox.height;
                    
                }
            }
        });
    }
    
    return units;
}

// Calculate optimal unit placement across pages
export function calculateUnitPlacement(svgElement, gridStrategy) {
    // Use the new function that considers seam allowance
    const units = analyzeUnitsWithSeamAllowance(svgElement);
    const pages = [];
    
    if (units.length === 0) {
        console.warn('No units found for placement');
        return { pages: [], unplacedUnits: [] };
    }
    
    
    // Sort units by area (larger first) for better packing
    const sortedUnits = [...units].sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        return areaB - areaA;
    });
    
    // Check if units overlap in their original positions and mark them
    const overlappingPairs = new Set();
    
    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            const unit1 = units[i];
            const unit2 = units[j];
            
            const rect1 = {
                x: unit1.boundingBox.x,
                y: unit1.boundingBox.y,
                width: unit1.width,
                height: unit1.height
            };
            
            const rect2 = {
                x: unit2.boundingBox.x,
                y: unit2.boundingBox.y,
                width: unit2.width,
                height: unit2.height
            };
            
            if (rectanglesOverlap(rect1, rect2)) {
                overlappingPairs.add(`${unit1.index}-${unit2.index}`);
                // Mark units as originally overlapping
                unit1.originallyOverlapping = true;
                unit2.originallyOverlapping = true;
            }
        }
    }
    
    const unplacedUnits = [];
    
    // Try to place each unit
    for (const unit of sortedUnits) {
        let placed = false;
        
        // Check if unit fits on any existing page
        for (const page of pages) {
            if (tryPlaceUnitOnPage(unit, page, gridStrategy, overlappingPairs)) {
                placed = true;
                break;
            }
        }
        
        // If not placed on existing pages, try to create a new page
        if (!placed) {
            const newPage = createNewPage(pages.length, gridStrategy);
            if (tryPlaceUnitOnPage(unit, newPage, gridStrategy, overlappingPairs)) {
                pages.push(newPage);
                placed = true;
            } else {
                // Unit is too large for any page
                console.warn(`Unit ${unit.index} (${unit.width}x${unit.height}mm) is too large for page`);
                unplacedUnits.push(unit);
            }
        }
    }
    
    
    return {
        pages,
        unplacedUnits,
        totalUnits: units.length,
        placedUnits: units.length - unplacedUnits.length
    };
}

// Create a new page structure
function createNewPage(pageIndex, gridStrategy) {
    return {
        index: pageIndex,
        units: [],
        occupiedAreas: [],
        width: gridStrategy.printableWidth,
        height: gridStrategy.printableHeight
    };
}

// Try to place a unit on a specific page
function tryPlaceUnitOnPage(unit, page, gridStrategy, overlappingPairs) {
    // Check if this unit originally overlapped with any unit already on this page
    if (unit.originallyOverlapping && overlappingPairs) {
        for (const placedUnit of page.units) {
            const pair1 = `${unit.index}-${placedUnit.index}`;
            const pair2 = `${placedUnit.index}-${unit.index}`;
            if (overlappingPairs.has(pair1) || overlappingPairs.has(pair2)) {
                return false;
            }
        }
    }
    
    // Calculate margin based on seam allowance
    // Since each unit has its own seam allowance, we need to consider both units' seam allowance
    // The total spacing needed between two units with seam allowance is at least:
    // seamAllowance (from first unit) + seamAllowance (from second unit) + small gap
    const hasSeamAllowance = unit.element.querySelector('path.seam-allowance') !== null;
    const seamAllowance = gridStrategy.seamAllowance || 0;
    // If units have seam allowance, we need double the seam allowance as margin
    // Plus a small gap (2mm) to ensure they don't touch
    const margin = hasSeamAllowance ? (seamAllowance * 2 + 2) : 2;
    
    // Check if unit fits within page dimensions
    if (unit.width > page.width || unit.height > page.height) {
        return false;
    }
    
    // Find a suitable position using a simple packing algorithm
    const position = findPositionForUnit(unit, page, margin);
    
    if (position) {
        // Add unit to page with calculated position
        page.units.push({
            ...unit,
            x: position.x,
            y: position.y
        });
        
        // Mark area as occupied
        page.occupiedAreas.push({
            x: position.x,
            y: position.y,
            width: unit.width + margin,
            height: unit.height + margin
        });
        
        return true;
    }
    
    return false;
}

// Find a suitable position for a unit on a page
function findPositionForUnit(unit, page, margin) {
    const unitWidth = unit.width + margin;
    const unitHeight = unit.height + margin;
    
    // Try positions in a grid pattern
    const stepX = 10; // Step size for position search
    const stepY = 10;
    
    for (let y = 0; y <= page.height - unitHeight; y += stepY) {
        for (let x = 0; x <= page.width - unitWidth; x += stepX) {
            if (canPlaceAt(x, y, unitWidth, unitHeight, page.occupiedAreas)) {
                return { x, y };
            }
        }
    }
    
    // Try more precise positioning if grid search fails
    for (let y = 0; y <= page.height - unitHeight; y += 1) {
        for (let x = 0; x <= page.width - unitWidth; x += 1) {
            if (canPlaceAt(x, y, unitWidth, unitHeight, page.occupiedAreas)) {
                return { x, y };
            }
        }
    }
    
    return null;
}

// Check if a rectangle can be placed at a specific position
function canPlaceAt(x, y, width, height, occupiedAreas) {
    const newRect = { x, y, width, height };
    
    // Check collision with all occupied areas
    for (const occupied of occupiedAreas) {
        if (rectanglesOverlap(newRect, occupied)) {
            return false;
        }
    }
    
    return true;
}

// Check if two rectangles overlap
function rectanglesOverlap(rect1, rect2) {
    return !(
        rect1.x + rect1.width <= rect2.x ||
        rect2.x + rect2.width <= rect1.x ||
        rect1.y + rect1.height <= rect2.y ||
        rect2.y + rect2.height <= rect1.y
    );
}

// Create SVG for a specific page with placed units
export function createPlacedUnitsSVG(originalSVG, page, gridStrategy) {
    // Clone the original SVG structure
    const pagedSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    // Copy attributes from original
    const viewBox = originalSVG.viewBox.baseVal;
    pagedSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    pagedSVG.setAttribute('viewBox', `0 0 ${gridStrategy.printableWidth} ${gridStrategy.printableHeight}`);
    pagedSVG.setAttribute('width', `${gridStrategy.printableWidth}mm`);
    pagedSVG.setAttribute('height', `${gridStrategy.printableHeight}mm`);
    
    // Copy defs if exists
    const originalDefs = originalSVG.querySelector('defs');
    if (originalDefs) {
        pagedSVG.appendChild(originalDefs.cloneNode(true));
    }
    
    // Add units to the page
    for (const placedUnit of page.units) {
        const unitGroup = placedUnit.element.cloneNode(true);
        
        // Apply translation to position the unit
        const currentTransform = unitGroup.getAttribute('transform') || '';
        const newTransform = `translate(${placedUnit.x - placedUnit.boundingBox.x}, ${placedUnit.y - placedUnit.boundingBox.y}) ${currentTransform}`;
        unitGroup.setAttribute('transform', newTransform.trim());
        
        pagedSVG.appendChild(unitGroup);
    }
    
    return pagedSVG;
}