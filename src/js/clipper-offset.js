/**
 * Seam allowance implementation using clipper-lib
 * This provides robust polygon offsetting for complex paths
 */

import ClipperLib from 'clipper-lib';

/**
 * Parse SVG path data into an array of points
 * @param {string} pathData - SVG path data string
 * @returns {Array} Array of {X, Y} coordinates (note: Clipper uses uppercase X,Y)
 */
function parseSVGPath(pathData) {
    const points = [];
    const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz]|[\-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][\-+]?\d+)?/g);
    
    if (!commands) return points;
    
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    let i = 0;
    let lastCommand = '';
    
    while (i < commands.length) {
        const cmd = commands[i];
        const isCommand = /[MmLlHhVvCcSsQqTtAaZz]/.test(cmd);
        
        if (isCommand) {
            lastCommand = cmd;
            i++;
        }
        
        switch (lastCommand.toUpperCase()) {
            case 'M':
                currentX = parseFloat(commands[i]);
                currentY = parseFloat(commands[i + 1]);
                startX = currentX;
                startY = currentY;
                points.push({ X: currentX, Y: currentY });
                i += 2;
                lastCommand = 'L'; // Implicit line commands after M
                break;
                
            case 'L':
                if (!isCommand && i < commands.length - 1) {
                    currentX = parseFloat(commands[i]);
                    currentY = parseFloat(commands[i + 1]);
                    points.push({ X: currentX, Y: currentY });
                    i += 2;
                }
                break;
                
            case 'H':
                if (i < commands.length) {
                    currentX = parseFloat(commands[i]);
                    points.push({ X: currentX, Y: currentY });
                    i++;
                }
                break;
                
            case 'V':
                if (i < commands.length) {
                    currentY = parseFloat(commands[i]);
                    points.push({ X: currentX, Y: currentY });
                    i++;
                }
                break;
                
            case 'Z':
                // Path is closed, Clipper handles this automatically
                break;
                
            // For curves, add end point only (simplified)
            case 'C':
                i += 4;
                if (i < commands.length - 1) {
                    currentX = parseFloat(commands[i]);
                    currentY = parseFloat(commands[i + 1]);
                    points.push({ X: currentX, Y: currentY });
                    i += 2;
                }
                break;
                
            case 'S':
            case 'Q':
                i += 2;
                if (i < commands.length - 1) {
                    currentX = parseFloat(commands[i]);
                    currentY = parseFloat(commands[i + 1]);
                    points.push({ X: currentX, Y: currentY });
                    i += 2;
                }
                break;
                
            case 'T':
                if (i < commands.length - 1) {
                    currentX = parseFloat(commands[i]);
                    currentY = parseFloat(commands[i + 1]);
                    points.push({ X: currentX, Y: currentY });
                    i += 2;
                }
                break;
                
            case 'A':
                i += 5;
                if (i < commands.length - 1) {
                    currentX = parseFloat(commands[i]);
                    currentY = parseFloat(commands[i + 1]);
                    points.push({ X: currentX, Y: currentY });
                    i += 2;
                }
                break;
                
            default:
                if (!isCommand && i < commands.length - 1) {
                    const x = parseFloat(commands[i]);
                    const y = parseFloat(commands[i + 1]);
                    if (!isNaN(x) && !isNaN(y)) {
                        currentX = x;
                        currentY = y;
                        points.push({ X: currentX, Y: currentY });
                        i += 2;
                    } else {
                        i++;
                    }
                } else {
                    i++;
                }
                break;
        }
    }
    
    return points;
}

/**
 * Convert Clipper points to SVG path string
 * @param {Array} points - Array of {X, Y} coordinates
 * @returns {string} SVG path data
 */
function pointsToSVGPath(points) {
    if (!points || points.length === 0) return '';
    
    let path = `M ${points[0].X},${points[0].Y}`;
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].X},${points[i].Y}`;
    }
    path += ' Z';
    
    return path;
}

/**
 * Expand a path by the given offset using clipper-lib
 * @param {string} pathData - SVG path data
 * @param {number} offsetDistance - Offset amount in SVG units
 * @returns {string} - Expanded path data
 */
export function expandPathWithClipper(pathData, offsetDistance) {
    if (!pathData || typeof pathData !== 'string' || offsetDistance <= 0) {
        return pathData;
    }
    
    try {
        // Parse SVG path to points
        const points = parseSVGPath(pathData);
        
        if (points.length < 3) {
            throw new Error(`Path has too few points for offset: ${points.length}`);
        }
        
        // Scale up for integer precision (Clipper uses integers)
        const scale = 1000;
        const scaledPoints = points.map(p => ({
            X: Math.round(p.X * scale),
            Y: Math.round(p.Y * scale)
        }));
        
        // Create ClipperOffset
        const co = new ClipperLib.ClipperOffset(2, 0.25);
        
        // Add path
        co.AddPath(scaledPoints, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
        
        // Execute offset
        const solution = new ClipperLib.Paths();
        co.Execute(solution, offsetDistance * scale);
        
        if (solution.length > 0) {
            // Take the first solution and scale back down
            const offsetPoints = solution[0].map(p => ({
                X: p.X / scale,
                Y: p.Y / scale
            }));
            
            return pointsToSVGPath(offsetPoints);
        }
        
        return pathData;
    } catch (error) {
        console.error('Clipper offset error:', error);
        throw error;
    }
}

/**
 * Apply seam allowance to SVG using clipper-lib
 * @param {SVGElement} svgElement - The SVG element to process
 * @param {number} seamAllowance - The seam allowance in mm
 * @returns {Object} - Object with svg and errors array
 */
export function applySeamAllowanceWithClipper(svgElement, seamAllowance) {
    const errors = [];
    
    if (!svgElement || seamAllowance <= 0) {
        return { svg: svgElement, errors };
    }
    
    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true);
    
    // Find all paths with class 'seam'
    const seamPaths = clonedSvg.querySelectorAll('path.seam');
    
    seamPaths.forEach((path, index) => {
        try {
            const pathData = path.getAttribute('d');
            if (!pathData) return;
            
            // Expand the path
            const expandedPath = expandPathWithClipper(pathData, seamAllowance);
            
            // Create seam allowance path
            const allowancePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            allowancePath.setAttribute('d', expandedPath);
            allowancePath.setAttribute('class', 'seam-allowance');
            allowancePath.setAttribute('fill', 'none');
            allowancePath.setAttribute('stroke', '#000');
            allowancePath.setAttribute('stroke-width', '2');
            
            // Add ID if original has one
            const originalId = path.getAttribute('id');
            if (originalId) {
                allowancePath.setAttribute('id', `${originalId}-allowance`);
            }
            
            // Insert the allowance path after the original
            path.parentNode.insertBefore(allowancePath, path.nextSibling);
            
            // Update original path style with finer dotted line
            path.setAttribute('stroke-dasharray', '2,2');
        } catch (error) {
            const pathId = path.getAttribute('id') || `path-${index + 1}`;
            const errorMsg = window.i18n?.translate('seamAllowanceError', { pathId, error: error.message }) ||
                           `Failed to create seam allowance for ${pathId}: ${error.message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
            console.error('Path data:', path.getAttribute('d'));
        }
    });
    
    return { svg: clonedSvg, errors };
}