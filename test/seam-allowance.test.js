import { describe, it, expect } from 'vitest';
import { applySeamAllowance, expandPath } from '../src/js/seam-allowance.js';

describe('Seam Allowance', () => {
    describe('expandPath', () => {
        it('should expand a square path by exact offset', () => {
            // 80x80 square centered at (50,50)
            const pathData = 'M 10,10 L 90,10 L 90,90 L 10,90 Z';
            const offset = 5;
            
            const expanded = expandPath(pathData, offset);
            
            // Parse the expanded path to check coordinates
            const coords = expanded.match(/[\d.]+/g).map(Number);
            
            // Clipper may return points in different order, so let's check all coordinates exist
            const points = [];
            for (let i = 0; i < coords.length; i += 2) {
                points.push({ x: coords[i], y: coords[i + 1] });
            }
            
            // Expected corners after 5 unit offset: (5,5), (95,5), (95,95), (5,95)
            const expectedPoints = [
                { x: 5, y: 5 },
                { x: 95, y: 5 },
                { x: 95, y: 95 },
                { x: 5, y: 95 }
            ];
            
            // Check that we have 4 points
            expect(points.length).toBe(4);
            
            // Check that all expected points exist (order may vary)
            for (const expected of expectedPoints) {
                const found = points.some(p => 
                    Math.abs(p.x - expected.x) < 0.01 && 
                    Math.abs(p.y - expected.y) < 0.01
                );
                expect(found).toBe(true);
            }
        });
        
        it('should expand a triangle path by exact offset', () => {
            // Equilateral triangle
            const pathData = 'M 50,10 L 90,80 L 10,80 Z';
            const offset = 5;
            
            const expanded = expandPath(pathData, offset);
            
            // Parse the expanded path to check coordinates
            const coords = expanded.match(/[\d.]+/g).map(Number);
            
            // Check that we have at least 3 points
            expect(coords.length).toBeGreaterThanOrEqual(6);
            
            // Parse into points
            const points = [];
            for (let i = 0; i < coords.length; i += 2) {
                points.push({ x: coords[i], y: coords[i + 1] });
            }
            
            // For a triangle offset outward, we expect:
            // - At least one point with y < 10 (top moved up)
            // - At least two points with y > 80 (bottom moved down)
            const hasTopPoint = points.some(p => p.y < 10);
            const bottomPoints = points.filter(p => p.y > 80);
            
            expect(hasTopPoint).toBe(true);
            expect(bottomPoints.length).toBeGreaterThanOrEqual(2);
        });
    });
    
    describe('applySeamAllowance', () => {
        it('should return original SVG when seam allowance is 0', () => {
            // Create a test SVG
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 10,10 L 90,10 L 90,90 L 10,90 Z');
            path.setAttribute('class', 'seam');
            svg.appendChild(path);
            
            const result = applySeamAllowance(svg, 0);
            
            // Should only have original path
            const seamPaths = result.svg.querySelectorAll('path.seam');
            const allowancePaths = result.svg.querySelectorAll('path.seam-allowance');
            
            expect(seamPaths.length).toBe(1);
            expect(allowancePaths.length).toBe(0);
            expect(result.errors.length).toBe(0);
        });
        
        it('should create seam allowance path with exact coordinates', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 20,20 L 80,20 L 80,80 L 20,80 Z');
            path.setAttribute('class', 'seam');
            svg.appendChild(path);
            
            const result = applySeamAllowance(svg, 10);
            
            // Should have both original and allowance paths
            const seamPaths = result.svg.querySelectorAll('path.seam');
            const allowancePaths = result.svg.querySelectorAll('path.seam-allowance');
            
            expect(seamPaths.length).toBe(1);
            expect(allowancePaths.length).toBe(1);
            expect(result.errors.length).toBe(0);
            
            // Check the seam allowance path coordinates
            const allowancePath = allowancePaths[0];
            const pathData = allowancePath.getAttribute('d');
            const coords = pathData.match(/[\d.]+/g).map(Number);
            
            // Parse into points
            const points = [];
            for (let i = 0; i < coords.length; i += 2) {
                points.push({ x: coords[i], y: coords[i + 1] });
            }
            
            // With 10 unit offset outward from (20,20)-(80,80) square:
            // Expected corners: (10,10), (90,10), (90,90), (10,90)
            const expectedPoints = [
                { x: 10, y: 10 },
                { x: 90, y: 10 },
                { x: 90, y: 90 },
                { x: 10, y: 90 }
            ];
            
            // Check that we have 4 points
            expect(points.length).toBe(4);
            
            // Check that all expected points exist (order may vary)
            for (const expected of expectedPoints) {
                const found = points.some(p => 
                    Math.abs(p.x - expected.x) < 0.01 && 
                    Math.abs(p.y - expected.y) < 0.01
                );
                expect(found).toBe(true);
            }
        });
        
        it('should handle SVG with no seam paths', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 10,10 L 90,10 L 90,90 L 10,90 Z');
            // No class="seam"
            svg.appendChild(path);
            
            const result = applySeamAllowance(svg, 5);
            
            // Should have no allowance paths
            const allowancePaths = result.svg.querySelectorAll('path.seam-allowance');
            expect(allowancePaths.length).toBe(0);
            expect(result.errors.length).toBe(0);
        });
        
        it('should handle empty SVG', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            
            const result = applySeamAllowance(svg, 5);
            
            expect(result.svg).not.toBe(svg); // Should be a clone, not the same object
            expect(result.svg.outerHTML).toBe(svg.outerHTML); // But should have same content
            expect(result.errors.length).toBe(0);
        });
        
        it('should handle null SVG element', () => {
            const result = applySeamAllowance(null, 5);
            
            expect(result.svg).toBe(null);
            expect(result.errors.length).toBe(0);
        });
        
        it('should handle complex paths with many coordinate pairs', () => {
            // Path with implicit L commands after M (from example.svg)
            const complexPath = 'M 100,100 200,100 300,100 400,150 500,200 600,250 700,300 800,350 900,400 1000,450 Z';
            const offset = 10;
            
            const expanded = expandPath(complexPath, offset);
            
            // Should return a valid path
            expect(expanded).toMatch(/^M\s+[\d.]+,[\d.]+/);
            expect(expanded).toContain('L');
            expect(expanded).toContain('Z');
            
            // Parse coordinates
            const coords = expanded.match(/[\d.]+/g).map(Number);
            
            // Should have a reasonable number of points (Clipper might simplify)
            expect(coords.length).toBeGreaterThanOrEqual(6); // At least 3 points * 2 coords
        });
        
        it('should handle paths with very large coordinates', () => {
            // Simplified version of a path from example.svg
            const largePath = 'M 8084.217,9431.709 L 7942.195,9428.745 L 8083.552,9396.922 L 8224.717,9365.330 Z';
            const offset = 50;
            
            const expanded = expandPath(largePath, offset);
            
            // Should return a valid path
            expect(expanded).toMatch(/^M\s+[\d.]+,[\d.]+/);
            
            // Parse coordinates to check they're reasonable
            const coords = expanded.match(/[\d.]+/g).map(Number);
            const points = [];
            for (let i = 0; i < coords.length; i += 2) {
                points.push({ x: coords[i], y: coords[i + 1] });
            }
            
            // All points should be within reasonable bounds
            points.forEach(p => {
                expect(p.x).toBeGreaterThan(7000); // Offset should not make coordinates negative
                expect(p.x).toBeLessThan(9000); // Offset should not explode
                expect(p.y).toBeGreaterThan(9000);
                expect(p.y).toBeLessThan(10000);
            });
        });
        
        it('should handle paths with only two points gracefully', () => {
            // Path with only 2 points (should fail gracefully)
            const twoPointPath = 'M 10,10 L 20,20';
            
            expect(() => expandPath(twoPointPath, 5)).toThrow('Path has too few points');
        });
        
        it('should create seam allowance for complex SVG similar to example.svg', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            
            // Add multiple complex paths
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M 100,100 200,100 300,150 400,200 500,250 600,300 700,350 800,400 Z');
            path1.setAttribute('class', 'seam');
            path1.setAttribute('id', 'complex-path-1');
            
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M 1000,1000 L 1100,1050 L 1200,1100 L 1300,1150 L 1400,1200 Z');
            path2.setAttribute('class', 'seam');
            path2.setAttribute('id', 'complex-path-2');
            
            svg.appendChild(path1);
            svg.appendChild(path2);
            
            const result = applySeamAllowance(svg, 20);
            
            // Should create allowance for both paths
            const seamPaths = result.svg.querySelectorAll('path.seam');
            const allowancePaths = result.svg.querySelectorAll('path.seam-allowance');
            
            expect(seamPaths.length).toBe(2);
            expect(allowancePaths.length).toBe(2);
            expect(result.errors.length).toBe(0);
            
            // Check that allowance paths have proper IDs
            const allowance1 = result.svg.querySelector('#complex-path-1-allowance');
            const allowance2 = result.svg.querySelector('#complex-path-2-allowance');
            
            expect(allowance1).toBeTruthy();
            expect(allowance2).toBeTruthy();
            
            // Verify paths contain valid data
            expect(allowance1.getAttribute('d')).toMatch(/^M\s+[\d.]+,[\d.]+/);
            expect(allowance2.getAttribute('d')).toMatch(/^M\s+[\d.]+,[\d.]+/);
        });
    });
});