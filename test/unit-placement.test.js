import { describe, test, expect, vi } from 'vitest';
import { calculateUnitPlacement, createPlacedUnitsSVG } from '../js/unit-placement.js';

// Mock analyzeSVGUnits to avoid DOM dependencies
vi.mock('../js/svg-processor.js', () => ({
  analyzeSVGUnits: vi.fn((svgElement) => {
    // Return mock units based on test SVG structure
    const mockUnits = svgElement.mockUnits || [];
    return mockUnits;
  })
}));

describe('Unit Placement Algorithm', () => {
  const gridStrategy = {
    printableWidth: 190,
    printableHeight: 277,
    margin: 10
  };
  
  test('should place all units when they fit on one page', () => {
    // Create mock SVG with units
    const svg = { 
      mockUnits: [
        {
          index: 0,
          element: {},
          width: 50,
          height: 50,
          boundingBox: { x: 0, y: 0, width: 50, height: 50 }
        },
        {
          index: 1,
          element: {},
          width: 50,
          height: 50,
          boundingBox: { x: 60, y: 0, width: 50, height: 50 }
        },
        {
          index: 2,
          element: {},
          width: 50,
          height: 50,
          boundingBox: { x: 0, y: 60, width: 50, height: 50 }
        }
      ]
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(1);
    expect(placement.pages[0].units.length).toBe(3);
    expect(placement.unplacedUnits.length).toBe(0);
  });
  
  test('should create multiple pages when units do not fit on one page', () => {
    const svg = {
      mockUnits: [
        {
          index: 0,
          element: {},
          width: 180,
          height: 260,
          boundingBox: { x: 0, y: 0, width: 180, height: 260 }
        },
        {
          index: 1,
          element: {},
          width: 180,
          height: 260,
          boundingBox: { x: 0, y: 0, width: 180, height: 260 }
        }
      ]
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(2);
    expect(placement.pages[0].units.length).toBe(1);
    expect(placement.pages[1].units.length).toBe(1);
    expect(placement.unplacedUnits.length).toBe(0);
  });
  
  test('should mark units as unplaced when they are too large', () => {
    const svg = {
      mockUnits: [
        {
          index: 0,
          element: {},
          width: 50,
          height: 50,
          boundingBox: { x: 0, y: 0, width: 50, height: 50 }
        },
        {
          index: 1,
          element: {},
          width: 200,
          height: 300,
          boundingBox: { x: 0, y: 0, width: 200, height: 300 }
        }
      ]
    };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(1);
    expect(placement.pages[0].units.length).toBe(1);
    expect(placement.unplacedUnits.length).toBe(1);
  });
  
  test('should handle empty SVG', () => {
    const svg = { mockUnits: [] };
    
    const placement = calculateUnitPlacement(svg, gridStrategy);
    
    expect(placement.pages.length).toBe(0);
    expect(placement.unplacedUnits.length).toBe(0);
  });
  
  test('should avoid overlapping units on the same page', () => {
    const svg = {
      mockUnits: [
        {
          index: 0,
          element: {},
          width: 100,
          height: 100,
          boundingBox: { x: 0, y: 0, width: 100, height: 100 }
        },
        {
          index: 1,
          element: {},
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
    const originalSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
    const originalSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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