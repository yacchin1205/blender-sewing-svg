import { describe, it, expect } from 'vitest';
import { indexToSymbol, assignPatternPieceSymbols, addSymbolToPattern, updateAllSymbols } from '../src/js/pattern-symbols.js';

describe('Pattern Symbols', () => {
    describe('indexToSymbol', () => {
        it('should convert single digit indices correctly', () => {
            expect(indexToSymbol(0)).toBe('A');
            expect(indexToSymbol(1)).toBe('B');
            expect(indexToSymbol(25)).toBe('Z');
        });
        
        it('should convert double digit indices correctly', () => {
            expect(indexToSymbol(26)).toBe('AA');
            expect(indexToSymbol(27)).toBe('AB');
            expect(indexToSymbol(51)).toBe('AZ');
            expect(indexToSymbol(52)).toBe('BA');
            expect(indexToSymbol(701)).toBe('ZZ');
        });
        
        it('should convert triple digit indices correctly', () => {
            expect(indexToSymbol(702)).toBe('AAA');
            expect(indexToSymbol(703)).toBe('AAB');
        });
        
        it('should throw error for invalid input', () => {
            expect(() => indexToSymbol(-1)).toThrow('Invalid index: -1. Must be a non-negative integer.');
            expect(() => indexToSymbol(1.5)).toThrow('Invalid index: 1.5. Must be a non-negative integer.');
            expect(() => indexToSymbol('A')).toThrow('Invalid index: A. Must be a non-negative integer.');
            expect(() => indexToSymbol(null)).toThrow('Invalid index: null. Must be a non-negative integer.');
        });
    });
    
    describe('assignPatternPieceSymbols', () => {
        it('should assign symbols to pattern pieces', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const g1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('class', 'seam');
            g1.appendChild(path1);
            
            const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('class', 'seam');
            g2.appendChild(path2);
            
            svg.appendChild(g1);
            svg.appendChild(g2);
            
            assignPatternPieceSymbols(svg);
            
            expect(g1.getAttribute('data-pattern-symbol')).toBe('A');
            expect(g2.getAttribute('data-pattern-symbol')).toBe('B');
        });
        
        it('should not reassign existing symbols', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'seam');
            g.appendChild(path);
            g.setAttribute('data-pattern-symbol', 'X');
            svg.appendChild(g);
            
            assignPatternPieceSymbols(svg);
            
            expect(g.getAttribute('data-pattern-symbol')).toBe('X');
        });
        
        it('should throw error for invalid SVG element', () => {
            expect(() => assignPatternPieceSymbols(null)).toThrow('Invalid SVG element provided');
            expect(() => assignPatternPieceSymbols(document.createElement('div'))).toThrow('Invalid SVG element provided');
        });
    });
    
    describe('addSymbolToPattern', () => {
        it('should add symbol text to pattern piece', () => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('data-pattern-symbol', 'A');
            
            // Mock getBBox
            g.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
            
            addSymbolToPattern(g);
            
            const text = g.querySelector('.pattern-symbol');
            expect(text).toBeTruthy();
            expect(text.textContent).toBe('A');
            expect(text.getAttribute('x')).toBe('50');
            expect(text.getAttribute('y')).toBe('50');
        });
        
        it('should throw error for pattern piece without symbol', () => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
            
            expect(() => addSymbolToPattern(g)).toThrow('Pattern piece unknown has no symbol assigned');
        });
        
        it('should throw error for invalid bounding box', () => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('data-pattern-symbol', 'A');
            g.getBBox = () => ({ x: 0, y: 0, width: 0, height: 100 });
            
            expect(() => addSymbolToPattern(g)).toThrow('Invalid bounding box');
        });
    });
    
    describe('updateAllSymbols', () => {
        it('should update all pattern pieces with symbols', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const g1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g1.setAttribute('data-pattern-symbol', 'A');
            g1.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
            
            const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g2.setAttribute('data-pattern-symbol', 'B');
            g2.getBBox = () => ({ x: 100, y: 0, width: 100, height: 100 });
            
            svg.appendChild(g1);
            svg.appendChild(g2);
            
            updateAllSymbols(svg);
            
            expect(g1.querySelector('.pattern-symbol').textContent).toBe('A');
            expect(g2.querySelector('.pattern-symbol').textContent).toBe('B');
        });
        
        it('should throw error if any symbol fails to add', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('data-pattern-symbol', 'A');
            g.getBBox = () => { throw new Error('getBBox failed'); };
            
            svg.appendChild(g);
            
            expect(() => updateAllSymbols(svg)).toThrow();
        });
    });
});