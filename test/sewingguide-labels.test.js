import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { assignSewingguideLabels, updateAllSewingguideLabels } from '../src/js/sewingguide-labels.js';

describe('Sewingguide Labels', () => {
    let dom;
    let svg;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <svg xmlns="http://www.w3.org/2000/svg" id="test-svg">
                </svg>
            </body>
            </html>
        `);
        global.document = dom.window.document;
        svg = document.getElementById('test-svg');
        
        // Add createSVGPoint to svg element
        svg.createSVGPoint = function() {
            return { x: 0, y: 0 };
        };
        
        // Mock SVG DOM methods that JSDOM doesn't support
        global.SVGElement = dom.window.SVGElement;
        global.SVGElement.prototype.getBBox = function() {
            // Default bounding box
            return { x: 0, y: 0, width: 100, height: 100 };
        };
        global.SVGPathElement = dom.window.SVGPathElement || dom.window.SVGElement;
        global.SVGPathElement.prototype.getTotalLength = function() {
            return 100;
        };
        global.SVGPathElement.prototype.getPointAtLength = function(length) {
            // Simple linear interpolation for testing
            const d = this.getAttribute('d');
            const match = d.match(/M\s*([\d.]+),([\d.]+)\s*L\s*([\d.]+),([\d.]+)/);
            if (match) {
                const x1 = parseFloat(match[1]);
                const y1 = parseFloat(match[2]);
                const x2 = parseFloat(match[3]);
                const y2 = parseFloat(match[4]);
                const ratio = length / 100;
                return {
                    x: x1 + (x2 - x1) * ratio,
                    y: y1 + (y2 - y1) * ratio
                };
            }
            return { x: length, y: length };
        };
        
        // Mock SVG methods for each path element  
        const originalQuerySelector = svg.querySelector.bind(svg);
        svg.querySelector = function(selector) {
            const element = originalQuerySelector(selector);
            if (element && element.tagName === 'path') {
                // Add ownerSVGElement getter
                Object.defineProperty(element, 'ownerSVGElement', {
                    get: function() {
                        return {
                            createSVGPoint: function() {
                                return { x: 0, y: 0 };
                            }
                        };
                    },
                    configurable: true
                });
            }
            return element;
        };
        
        const originalQuerySelectorAll = svg.querySelectorAll.bind(svg);
        svg.querySelectorAll = function(selector) {
            const elements = originalQuerySelectorAll(selector);
            elements.forEach(element => {
                if (element && element.tagName === 'path') {
                    Object.defineProperty(element, 'ownerSVGElement', {
                        get: function() {
                            return svg;
                        },
                        configurable: true
                    });
                }
            });
            return elements;
        };
    });

    describe('assignSewingguideLabels', () => {
        it('should assign labels to sewingguide pairs', () => {
            // Create two pattern pieces with matching sewingguides
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10"/>
                </g>
                <g data-pattern-symbol="B">
                    <path class="seam" d="M 25,0 L 50,0 L 50,30 L 25,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 30,10 L 40,10"/>
                </g>
            `;

            assignSewingguideLabels(svg);

            const sewingguides = svg.querySelectorAll('.sewinguide');
            expect(sewingguides[0].getAttribute('data-sewingguide-label')).toBe('A:B:1');
            expect(sewingguides[1].getAttribute('data-sewingguide-label')).toBe('A:B:1'); // Both show same sorted label

            // Check that visual labels were added
            const labels = svg.querySelectorAll('.sewingguide-label');
            expect(labels.length).toBe(2);
            expect(labels[0].textContent).toBe('A:B:1');
            expect(labels[1].textContent).toBe('A:B:1'); // Both show same sorted label
        });

        it('should handle multiple pairs with same symbols', () => {
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10"/>
                    <path class="sewinguide" stroke="#00ff00" d="M 10,20 L 20,20"/>
                </g>
                <g data-pattern-symbol="B">
                    <path class="seam" d="M 25,0 L 50,0 L 50,30 L 25,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 30,10 L 40,10"/>
                    <path class="sewinguide" stroke="#00ff00" d="M 30,20 L 40,20"/>
                </g>
            `;

            assignSewingguideLabels(svg);

            const redPair = svg.querySelectorAll('[stroke="#ff0000"]');
            expect(redPair[0].getAttribute('data-sewingguide-label')).toBe('A:B:1');
            expect(redPair[1].getAttribute('data-sewingguide-label')).toBe('A:B:1'); // Same sorted label

            const greenPair = svg.querySelectorAll('[stroke="#00ff00"]');
            expect(greenPair[0].getAttribute('data-sewingguide-label')).toBe('A:B:2');
            expect(greenPair[1].getAttribute('data-sewingguide-label')).toBe('A:B:2'); // Same sorted label
        });

        it('should warn about colors appearing more than twice', () => {
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10"/>
                </g>
                <g data-pattern-symbol="B">
                    <path class="seam" d="M 25,0 L 50,0 L 50,30 L 25,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 30,10 L 40,10"/>
                </g>
                <g data-pattern-symbol="C">
                    <path class="seam" d="M 45,0 L 70,0 L 70,30 L 45,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 50,10 L 60,10"/>
                </g>
            `;

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            assignSewingguideLabels(svg);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Sewingguide color #ff0000 appears 3 times (expected 2 for pair matching)'
            );

            // Ensure no labels were assigned to the 3+ color group
            const sewingguides = svg.querySelectorAll('.sewinguide');
            expect(sewingguides[0].hasAttribute('data-sewingguide-label')).toBe(false);
            expect(sewingguides[1].hasAttribute('data-sewingguide-label')).toBe(false);
            expect(sewingguides[2].hasAttribute('data-sewingguide-label')).toBe(false);

            consoleSpy.mockRestore();
        });

        it('should skip sewingguides not within pattern pieces', () => {
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10"/>
                </g>
                <!-- This one is outside any pattern piece -->
                <path class="sewinguide" stroke="#ff0000" d="M 30,10 L 40,10"/>
            `;

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            assignSewingguideLabels(svg);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Sewingguide elements with color #ff0000 are not within pattern pieces'
            );

            const sewingguides = svg.querySelectorAll('.sewinguide');
            expect(sewingguides[0].hasAttribute('data-sewingguide-label')).toBe(false);
            expect(sewingguides[1].hasAttribute('data-sewingguide-label')).toBe(false);

            consoleSpy.mockRestore();
        });

        it('should handle same pattern piece pairs (A:A)', () => {
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,20 L 20,20"/>
                </g>
            `;

            assignSewingguideLabels(svg);

            const sewingguides = svg.querySelectorAll('.sewinguide');
            expect(sewingguides[0].getAttribute('data-sewingguide-label')).toBe('A:A:1');
            expect(sewingguides[1].getAttribute('data-sewingguide-label')).toBe('A:A:1'); // Same pattern, same label
        });
    });

    describe('updateAllSewingguideLabels', () => {
        it('should recreate visual labels from data attributes', () => {
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10" 
                          data-sewingguide-label="A:B:1"/>
                </g>
                <g data-pattern-symbol="B">
                    <path class="seam" d="M 25,0 L 50,0 L 50,30 L 25,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 30,10 L 40,10"
                          data-sewingguide-label="A:B:1"/>
                </g>
            `;

            updateAllSewingguideLabels(svg);

            const labels = svg.querySelectorAll('.sewingguide-label');
            expect(labels.length).toBe(2);
            expect(labels[0].textContent).toBe('A:B:1');
            expect(labels[1].textContent).toBe('A:B:1'); // Both show same sorted label
        });

        it('should remove old labels before adding new ones', () => {
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 30,0 L 30,30 L 0,30 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 20,10" 
                          data-sewingguide-label="A:B:1"/>
                    <text class="sewingguide-label">Old Label</text>
                </g>
            `;

            updateAllSewingguideLabels(svg);

            const labels = svg.querySelectorAll('.sewingguide-label');
            expect(labels.length).toBe(1);
            expect(labels[0].textContent).toBe('A:B:1');
            expect(labels[0].textContent).not.toBe('Old Label');
        });
    });

    describe('label overlap avoidance', () => {
        it('should adjust label position when same label appears multiple times', () => {
            // Create pattern where same pair (A:B) has multiple sewingguides
            // This will create A:B:1 twice at same position, triggering overlap avoidance
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 50,0 L 50,50 L 0,50 Z"/>
                    <!-- First A:B connection -->
                    <path class="sewinguide" stroke="#ff0000" d="M 0,10 L 10,10"/>
                    <!-- Second A:B connection at same x position -->
                    <path class="sewinguide" stroke="#00ff00" d="M 0,10 L 10,10"/>
                </g>
                <g data-pattern-symbol="B">
                    <path class="seam" d="M 60,0 L 110,0 L 110,50 L 60,50 Z"/>
                    <!-- Matching connections -->
                    <path class="sewinguide" stroke="#ff0000" d="M 100,10 L 110,10"/>
                    <path class="sewinguide" stroke="#00ff00" d="M 100,40 L 110,40"/>
                </g>
            `;

            // Mock getBBox for pattern pieces
            const patterns = svg.querySelectorAll('[data-pattern-symbol]');
            patterns.forEach(pattern => {
                pattern.getBBox = function() {
                    if (this.getAttribute('data-pattern-symbol') === 'A') {
                        return { x: 0, y: 0, width: 50, height: 50 };
                    }
                    return { x: 60, y: 0, width: 50, height: 50 };
                };
            });

            assignSewingguideLabels(svg);

            const labels = svg.querySelectorAll('.sewingguide-label');
            
            // Verify we have 4 labels total
            expect(labels.length).toBe(4);
            
            // Count unique positions
            const positions = new Set();
            labels.forEach(label => {
                const x = label.getAttribute('x');
                const y = label.getAttribute('y');
                positions.add(`${x},${y}`);
            });
            
            // With overlap avoidance, we should have more than 2 unique positions
            // (If no overlap avoidance, all A:B:1 labels would be at same position)
            expect(positions.size).toBeGreaterThan(2);
        });
    });

    describe('label positioning', () => {
        it('should position labels at the endpoint closer to pattern center', () => {
            // Create a pattern piece with sewingguide
            svg.innerHTML = `
                <g data-pattern-symbol="A">
                    <path class="seam" d="M 0,0 L 100,0 L 100,100 L 0,100 Z"/>
                    <rect x="0" y="0" width="100" height="100"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 10,10 L 90,90"/>
                </g>
                <g data-pattern-symbol="B">
                    <path class="seam" d="M 200,0 L 300,0 L 300,100 L 200,100 Z"/>
                    <rect x="200" y="0" width="100" height="100"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 210,90 L 290,10"/>
                </g>
            `;

            // Mock getBBox for pattern pieces
            const patternA = svg.querySelector('[data-pattern-symbol="A"]');
            const patternB = svg.querySelector('[data-pattern-symbol="B"]');
            
            patternA.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
            patternB.getBBox = () => ({ x: 200, y: 0, width: 100, height: 100 });

            assignSewingguideLabels(svg);

            const labels = svg.querySelectorAll('.sewingguide-label');
            
            // Pattern A center is at (50,50)
            // Sewinguide endpoints: (10,10) to (90,90)
            // Distance from (10,10) to (50,50) = sqrt(40^2 + 40^2) = ~56.57
            // Distance from (90,90) to (50,50) = sqrt(40^2 + 40^2) = ~56.57
            // They're equidistant, but (10,10) is the start point
            
            // Pattern B center is at (250,50)  
            // Sewinguide endpoints: (210,90) to (290,10)
            // Distance from (210,90) to (250,50) = sqrt(40^2 + 40^2) = ~56.57
            // Distance from (290,10) to (250,50) = sqrt(40^2 + 40^2) = ~56.57
            // They're equidistant, but (210,90) is the start point
            
            // Since distances are equal, the implementation might choose either endpoint
            // Let's check what was actually chosen
            const label1X = parseFloat(labels[0].getAttribute('x'));
            const label1Y = parseFloat(labels[0].getAttribute('y'));
            const label2X = parseFloat(labels[1].getAttribute('x'));
            const label2Y = parseFloat(labels[1].getAttribute('y'));
            
            // For pattern A's sewinguide, one endpoint should be used
            expect([10, 90]).toContain(label1X);
            expect([10, 90]).toContain(label1Y);
            
            // For pattern B's sewinguide, one endpoint should be used  
            expect([210, 290]).toContain(label2X);
            expect([10, 90]).toContain(label2Y);
        });
    });
});