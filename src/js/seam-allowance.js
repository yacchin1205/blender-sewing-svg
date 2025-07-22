/**
 * Seam allowance calculation and path expansion
 */

import { expandPathWithClipper, applySeamAllowanceWithClipper } from './clipper-offset.js';

/**
 * Expands a path by the given offset distance
 * @param {string} pathData - SVG path data string
 * @param {number} offset - Offset distance
 * @returns {string} - Expanded path data
 */
export function expandPath(pathData, offset) {
    return expandPathWithClipper(pathData, offset);
}

/**
 * Apply seam allowance to all seam paths in the SVG
 * @param {SVGElement} svgElement - The SVG element
 * @param {number} seamAllowance - Seam allowance in mm
 * @returns {{svg: SVGElement, errors: Array}} - Modified SVG element and any errors
 */
export function applySeamAllowance(svgElement, seamAllowance) {
    return applySeamAllowanceWithClipper(svgElement, seamAllowance);
}