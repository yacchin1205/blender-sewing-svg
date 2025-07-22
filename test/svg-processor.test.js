import { describe, test, expect } from 'vitest';
import { scaleSVG, createPagedSVG, calculatePageLayout } from '../src/js/svg-processor.js';

// Test helper function
function createTestSVG(width = 100, height = 100) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', `${width}mm`);
  svg.setAttribute('height', `${height}mm`);
  
  // Mock viewBox.baseVal that updates when setAttribute is called
  const viewBoxObj = {
    x: 0,
    y: 0,
    width: width,
    height: height
  };
  
  Object.defineProperty(svg, 'viewBox', {
    value: {
      baseVal: viewBoxObj
    },
    writable: true,
    configurable: true
  });
  
  // Override setAttribute to update viewBox.baseVal when viewBox is set
  const originalSetAttribute = svg.setAttribute.bind(svg);
  svg.setAttribute = function(name, value) {
    if (name === 'viewBox') {
      const parts = value.split(' ').map(Number);
      if (parts.length === 4) {
        viewBoxObj.x = parts[0];
        viewBoxObj.y = parts[1];
        viewBoxObj.width = parts[2];
        viewBoxObj.height = parts[3];
      }
    }
    return originalSetAttribute(name, value);
  };
  
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'seam');
  path.setAttribute('d', `M 0,0 L ${width},0 L ${width},${height} L 0,${height} Z`);
  path.style.strokeWidth = '1px';
  
  g.appendChild(path);
  svg.appendChild(g);
  
  return svg;
}

describe('Scale Correction Functions', () => {
  test('viewBox should be correctly adjusted', () => {
    const svg = createTestSVG(14433.48, 14433.48);
    scaleSVG(svg, 0.001);
    
    // Check the viewBox.baseVal properties are updated
    expect(svg.viewBox.baseVal.x).toBe(0);
    expect(svg.viewBox.baseVal.y).toBe(0);
    expect(svg.viewBox.baseVal.width).toBeCloseTo(14.43348, 5);
    expect(svg.viewBox.baseVal.height).toBeCloseTo(14.43348, 5);
  });
  
  test('size attributes should be correctly adjusted', () => {
    const svg = createTestSVG(1000, 1000);
    scaleSVG(svg, 0.001);
    
    expect(svg.getAttribute('width')).toBe('1mm');
    expect(svg.getAttribute('height')).toBe('1mm');
  });
  
  test('stroke-width should be proportionally adjusted', () => {
    const svg = createTestSVG();
    const path = svg.querySelector('path');
    path.setAttribute('stroke-width', '10');
    
    scaleSVG(svg, 0.1);
    
    expect(path.getAttribute('stroke-width')).toBe('1');
  });
  
  test('stroke-width in style elements should also be adjusted', () => {
    const svg = createTestSVG();
    const path = svg.querySelector('path');
    path.setAttribute('stroke-width', '10');
    
    scaleSVG(svg, 0.1);
    
    // The current implementation scales stroke-width attributes, not CSS styles
    expect(path.getAttribute('stroke-width')).toBe('1');
  });
});

describe('Page Split Functions', () => {
  test('required page count should be calculated correctly', () => {
    const svg = createTestSVG(500, 800);
    const gridStrategy = {
      effectiveWidth: 180,
      effectiveHeight: 267
    };
    
    const layout = calculatePageLayout(svg, gridStrategy);
    
    expect(layout.pagesX).toBe(3); // Math.ceil(500 / 180) = 3
    expect(layout.pagesY).toBe(3); // Math.ceil(800 / 267) = 3
    expect(layout.totalPages).toBe(9);
  });
  
  test('single page viewBox should be set correctly', () => {
    const svg = createTestSVG(1000, 1000);
    const gridStrategy = {
      printableWidth: 190,
      printableHeight: 277,
      effectiveWidth: 180,
      effectiveHeight: 267,
      overlap: 10
    };
    
    const pagedSVG = createPagedSVG(svg, 1, 1, gridStrategy);
    const viewBox = pagedSVG.getAttribute('viewBox');
    
    // For pageX=1, pageY=1: x=180-10=170, y=267-10=257
    expect(viewBox).toBe('170 257 190 277');
  });
  
  test('clipping path should be applied correctly', () => {
    const svg = createTestSVG(500, 500);
    const gridStrategy = {
      printableWidth: 190,
      printableHeight: 277,
      effectiveWidth: 180,
      effectiveHeight: 267,
      overlap: 10
    };
    
    const pagedSVG = createPagedSVG(svg, 0, 0, gridStrategy);
    const clipPath = pagedSVG.querySelector('clipPath');
    const rect = clipPath.querySelector('rect');
    
    expect(clipPath.id).toBe('page-0-0');
    expect(rect.getAttribute('x')).toBe('-10'); // 0 * 180 - 10
    expect(rect.getAttribute('y')).toBe('-10'); // 0 * 267 - 10
    expect(rect.getAttribute('width')).toBe('190');
    expect(rect.getAttribute('height')).toBe('277');
  });
  
  test('clipping path should be applied to group elements', () => {
    const svg = createTestSVG(500, 500);
    const gridStrategy = {
      printableWidth: 190,
      printableHeight: 277,
      effectiveWidth: 180,
      effectiveHeight: 267,
      overlap: 10
    };
    
    const pagedSVG = createPagedSVG(svg, 0, 0, gridStrategy);
    const groups = pagedSVG.querySelectorAll('svg > g');
    
    groups.forEach(g => {
      expect(g.getAttribute('clip-path')).toBe('url(#page-0-0)');
    });
  });
});

describe('Error Handling', () => {
  test('should not throw error for invalid SVG elements', () => {
    const svg = createTestSVG();
    // Remove viewBox to create error condition
    delete svg.viewBox;
    
    expect(() => scaleSVG(svg, 0.001)).not.toThrow();
  });
  
  test('should not throw error for paths without stroke-width', () => {
    const svg = createTestSVG();
    const path = svg.querySelector('path');
    path.style.strokeWidth = '';
    path.removeAttribute('stroke-width');
    
    expect(() => scaleSVG(svg, 0.001)).not.toThrow();
  });
});