/**
 * Pattern Symbols Module
 * Handles assigning and rendering A-Z, AA-AZ... symbols to pattern pieces
 */

/**
 * Convert zero-based index to Excel-like column name (A, B, C...Z, AA, AB...)
 * @param {number} index - Zero-based index
 * @returns {string} Excel-like column name
 */
export function indexToSymbol(index) {
    if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
        throw new Error(`Invalid index: ${index}. Must be a non-negative integer.`);
    }
    
    let symbol = '';
    let num = index;
    
    while (num >= 0) {
        symbol = String.fromCharCode(65 + (num % 26)) + symbol;
        num = Math.floor(num / 26) - 1;
    }
    
    return symbol;
}

/**
 * Assign symbols to pattern pieces in an SVG element
 * @param {SVGElement} svgElement - The SVG element containing pattern pieces
 */
export function assignPatternPieceSymbols(svgElement) {
    if (!svgElement || !(svgElement instanceof SVGElement)) {
        throw new Error('Invalid SVG element provided to assignPatternPieceSymbols');
    }
    
    // Find all g elements that are direct children of svg or nested g elements
    const pieces = svgElement.querySelectorAll('svg > g, g > g');
    
    // Filter out groups that only contain other groups (container groups)
    const patternPieces = Array.from(pieces).filter(g => {
        // Check if the group contains actual path elements (not just other groups)
        return g.querySelector('path.seam') !== null;
    });
    
    if (patternPieces.length === 0) {
        console.warn('No pattern pieces found in SVG');
        return;
    }
    
    patternPieces.forEach((piece, index) => {
        if (!piece.hasAttribute('data-pattern-symbol')) {
            const symbol = indexToSymbol(index);
            piece.setAttribute('data-pattern-symbol', symbol);
        }
    });
}

/**
 * Add symbol text to a pattern piece
 * @param {SVGElement} pieceElement - The pattern piece element
 */
export function addSymbolToPattern(pieceElement) {
    if (!pieceElement || !(pieceElement instanceof SVGElement)) {
        throw new Error('Invalid pattern piece element');
    }
    
    const symbol = pieceElement.getAttribute('data-pattern-symbol');
    if (!symbol) {
        throw new Error(`Pattern piece ${pieceElement.id || 'unknown'} has no symbol assigned`);
    }
    
    // Remove any existing symbol
    const existingSymbol = pieceElement.querySelector('.pattern-symbol');
    if (existingSymbol) {
        existingSymbol.remove();
    }
    
    // Get bounding box
    const bbox = pieceElement.getBBox();
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
        throw new Error(`Invalid bounding box for pattern piece ${pieceElement.id || 'unknown'}: width=${bbox?.width}, height=${bbox?.height}`);
    }
    
    // Calculate font size based on pattern size
    const fontSize = Math.min(bbox.width, bbox.height) * 0.15; // 15% of smallest dimension
    const minFontSize = 10; // Minimum readable size
    const maxFontSize = 50; // Maximum size to avoid being too large
    const finalFontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));
    
    // Create symbol text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'pattern-symbol');
    text.setAttribute('x', bbox.x + bbox.width / 2);
    text.setAttribute('y', bbox.y + bbox.height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', finalFontSize);
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', '#000000');
    text.setAttribute('stroke', '#000000');
    text.setAttribute('stroke-width', '0.5');
    text.textContent = symbol;
    
    pieceElement.appendChild(text);
}

/**
 * Remove all symbol texts from pattern pieces
 * @param {SVGElement} svgElement - The SVG element containing pattern pieces
 */
export function removeAllSymbols(svgElement) {
    if (!svgElement || !(svgElement instanceof SVGElement)) {
        throw new Error('Invalid SVG element provided to removeAllSymbols');
    }
    
    const symbols = svgElement.querySelectorAll('.pattern-symbol');
    symbols.forEach(symbol => symbol.remove());
}

/**
 * Update symbols for all pattern pieces in an SVG
 * @param {SVGElement} svgElement - The SVG element containing pattern pieces
 */
export function updateAllSymbols(svgElement) {
    if (!svgElement || !(svgElement instanceof SVGElement)) {
        throw new Error('Invalid SVG element provided to updateAllSymbols');
    }
    
    const pieces = svgElement.querySelectorAll('[data-pattern-symbol]');
    if (pieces.length === 0) {
        console.warn('No pattern pieces with symbols found');
        return;
    }
    pieces.forEach(piece => {
        addSymbolToPattern(piece);
    });
}