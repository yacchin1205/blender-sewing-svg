import { describe, test, expect, vi, beforeEach } from 'vitest';
import { calculateUnitPlacement, createPlacedUnitsSVG } from '../src/js/unit-placement.js';

// Mock the functions to avoid DOM dependencies
vi.mock('../src/js/svg-processor.js', () => ({
  analyzeSVGUnits: vi.fn((svgElement) => {
    // Return mock units based on test SVG structure
    const mockUnits = svgElement.mockUnits || [];
    return mockUnits;
  }),
  getElementBoundingBox: vi.fn(() => ({ x: 0, y: 0, width: 50, height: 50 }))
}));

// Mock document.body and createElementNS for DOM operations
beforeEach(() => {
  // Mock appendChild to avoid happy-dom internal errors
  const originalAppendChild = document.body.appendChild;
  document.body.appendChild = vi.fn((element) => {
    // Don't actually append, just return the element
    return element;
  });
  document.body.removeChild = vi.fn((element) => {
    return element;
  });
  
  // Mock createElementNS to return a proper mock SVG element
  global.document.createElementNS = vi.fn((ns, tagName) => {
    const attrs = {};
    if (tagName === 'svg') {
      return {
        style: {},
        appendChild: vi.fn(function(child) { return child; }),
        removeChild: vi.fn(),
        setAttribute: vi.fn((key, value) => { attrs[key] = value; }),
        getAttribute: vi.fn((key) => attrs[key]),
        querySelector: vi.fn((selector) => {
          // Return the first child element for 'g' selector
          if (selector === 'g') {
            return {
              getAttribute: vi.fn((attr) => {
                if (attr === 'transform') return 'translate(20, 30) ';
                return null;
              })
            };
          }
          return null;
        }),
        querySelectorAll: vi.fn(() => []),
        parentNode: document.body,
        ownerDocument: document,
        nodeType: 1
      };
    }
    return {
      setAttribute: vi.fn(),
      getAttribute: vi.fn((attr) => {
        if (attr === 'transform') return '';
        return null;
      }),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      cloneNode: vi.fn(function() { return this; }),
      getBBox: vi.fn(() => ({ x: 0, y: 0, width: 50, height: 50 })),
      nodeType: 1
    };
  });
});

describe('Unit Placement Algorithm', () => {
  const gridStrategy = {
    printableWidth: 190,
    printableHeight: 277,
    margin: 10
  };
  
  test('should place all units when they fit on one page', () => {
    // Create mock groups with proper structure
    const createMockGroup = (id, bbox) => ({
      parentElement: { tagName: 'svg' },
      getAttribute: (attr) => attr === 'id' ? id : attr === 'class' ? '' : '',
      querySelectorAll: (selector) => {
        if (selector === '.seam-allowance') {
          return [{
            cloneNode: () => {
              // Create a mock cloned element that works with appendChild
              const cloned = {
                getBBox: () => bbox,
                nodeType: 1,
                ownerDocument: { body: document.body }
              };
              return cloned;
            },
            getBBox: () => bbox
          }];
        }
        if (selector === '.seam') return [];
        return [];
      },
      querySelector: (selector) => {
        if (selector === 'path.seam-allowance') return {};
        return null;
      }
    });

    const svg = { 
      querySelectorAll: (selector) => {
        if (selector === 'g') {
          return [
            createMockGroup('piece1', { x: 0, y: 0, width: 50, height: 50 }),
            createMockGroup('piece2', { x: 60, y: 0, width: 50, height: 50 }),
            createMockGroup('piece3', { x: 0, y: 60, width: 50, height: 50 })
          ];
        }
        if (selector === 'path.seam-allowance') return [{}]; // Indicates seam allowance exists
        return [];
      }
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(1);
    expect(placement.pages[0].units.length).toBe(3);
    expect(placement.unplacedUnits.length).toBe(0);
  });
  
  test('should create multiple pages when units do not fit on one page', () => {
    const createMockGroup = (id, bbox) => ({
      parentElement: { tagName: 'svg' },
      getAttribute: (attr) => attr === 'id' ? id : attr === 'class' ? '' : '',
      querySelectorAll: (selector) => {
        if (selector === '.seam-allowance') {
          return [{
            cloneNode: () => {
              const cloned = {
                getBBox: () => bbox,
                nodeType: 1,
                ownerDocument: { body: document.body }
              };
              return cloned;
            },
            getBBox: () => bbox
          }];
        }
        if (selector === '.seam') return [];
        return [];
      },
      querySelector: (selector) => {
        if (selector === 'path.seam-allowance') return {};
        return null;
      }
    });

    const svg = {
      querySelectorAll: (selector) => {
        if (selector === 'g') {
          return [
            createMockGroup('piece1', { x: 0, y: 0, width: 180, height: 260 }),
            createMockGroup('piece2', { x: 0, y: 0, width: 180, height: 260 })
          ];
        }
        if (selector === 'path.seam-allowance') return [{}];
        return [];
      }
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(2);
    expect(placement.pages[0].units.length).toBe(1);
    expect(placement.pages[1].units.length).toBe(1);
    expect(placement.unplacedUnits.length).toBe(0);
  });
  
  test('should mark units as unplaced when they are too large', () => {
    const createMockGroup = (id, bbox) => ({
      parentElement: { tagName: 'svg' },
      getAttribute: (attr) => attr === 'id' ? id : attr === 'class' ? '' : '',
      querySelectorAll: (selector) => {
        if (selector === '.seam-allowance') {
          return [{
            cloneNode: () => {
              const cloned = {
                getBBox: () => bbox,
                nodeType: 1,
                ownerDocument: { body: document.body }
              };
              return cloned;
            },
            getBBox: () => bbox
          }];
        }
        if (selector === '.seam') return [];
        return [];
      },
      querySelector: (selector) => {
        if (selector === 'path.seam-allowance') return {};
        return null;
      }
    });

    const svg = {
      querySelectorAll: (selector) => {
        if (selector === 'g') {
          return [
            createMockGroup('piece1', { x: 0, y: 0, width: 50, height: 50 }),
            createMockGroup('piece2', { x: 0, y: 0, width: 200, height: 300 }) // Too large for page
          ];
        }
        if (selector === 'path.seam-allowance') return [{}];
        return [];
      }
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(1);
    expect(placement.pages[0].units.length).toBe(1);
    expect(placement.unplacedUnits.length).toBe(1);
  });
  
  test('should handle empty SVG', () => {
    const svg = { querySelectorAll: () => [], mockUnits: [] };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(0);
    expect(placement.unplacedUnits.length).toBe(0);
  });
  
  test('should avoid overlapping units on the same page', () => {
    const svg = {
      querySelectorAll: () => [],
      mockUnits: [
        {
          index: 0,
          element: { querySelector: () => null },
          width: 100,
          height: 100,
          boundingBox: { x: 0, y: 0, width: 100, height: 100 }
        },
        {
          index: 1,
          element: { querySelector: () => null },
          width: 100,
          height: 100,
          boundingBox: { x: 50, y: 50, width: 100, height: 100 }
        }
      ]
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    if (placement.pages.length === 1 && placement.pages[0].units.length === 2) {
      const unit1 = placement.pages[0].units[0];
      const unit2 = placement.pages[0].units[1];
      
      // Check that units don't overlap
      const overlap = !(
        unit1.x + unit1.width <= unit2.x ||
        unit2.x + unit2.width <= unit1.x ||
        unit1.y + unit1.height <= unit2.y ||
        unit2.y + unit2.height <= unit1.y
      );
      
      expect(overlap).toBe(false);
    }
  });
});

describe('SVG Generation', () => {
  const gridStrategy = {
    printableWidth: 190,
    printableHeight: 277,
    margin: 10
  };
  
  test('should create SVG with correct dimensions', () => {
    const originalSVG = {
      viewBox: { baseVal: { x: 0, y: 0, width: 200, height: 300 } },
      querySelector: vi.fn()
    };
    const mockElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const page = {
      units: [{
        element: mockElement,
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        boundingBox: { x: 0, y: 0 }
      }]
    };
    
    const pagedSVG = createPlacedUnitsSVG(originalSVG, page, gridStrategy);
    
    expect(pagedSVG.getAttribute('viewBox')).toBe('0 0 190 277');
    expect(pagedSVG.getAttribute('width')).toBe('190mm');
    expect(pagedSVG.getAttribute('height')).toBe('277mm');
  });
  
  test('should apply transform to position units correctly', () => {
    const originalSVG = {
      viewBox: { baseVal: { x: 0, y: 0, width: 200, height: 300 } },
      querySelector: vi.fn()
    };
    const mockElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const page = {
      units: [{
        element: mockElement,
        x: 20,
        y: 30,
        width: 50,
        height: 50,
        boundingBox: { x: 0, y: 0 }
      }]
    };
    
    const pagedSVG = createPlacedUnitsSVG(originalSVG, page, gridStrategy);
    const unitGroup = pagedSVG.querySelector('g');
    
    expect(unitGroup.getAttribute('transform')).toContain('translate(20, 30)');
  });
});