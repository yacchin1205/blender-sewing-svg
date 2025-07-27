import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TextureMapper } from '../src/js/texture-mapping.js';

describe('TextureMapper', () => {
    let textureMapper;
    let mockSVG;
    
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="textureSettings" style="display: none;"></div>
            <span id="selectedPieceName"></span>
            <div id="textureControls" style="display: none;"></div>
            <button id="removeTextureBtn" style="display: none;"></button>
            <input id="textureScale" value="100">
            <input id="textureRotation" value="0">
            <input id="textureOffsetX" value="0">
            <input id="textureOffsetY" value="0">
        `;
        
        // Create mock SVG
        mockSVG = createMockSVG();
        document.body.appendChild(mockSVG);
        
        textureMapper = new TextureMapper();
    });
    
    describe('initialization', () => {
        test('should initialize with empty texture map', () => {
            expect(textureMapper.textures.size).toBe(0);
            expect(textureMapper.selectedPiece).toBeNull();
            expect(textureMapper.svgElement).toBeNull();
        });
        
        test('should set svgElement and setup event listeners on initialize', () => {
            textureMapper.initialize(mockSVG);
            
            expect(textureMapper.svgElement).toBe(mockSVG);
            
            // Check that seam paths are transparent
            const seamPaths = mockSVG.querySelectorAll('.seam');
            seamPaths.forEach(path => {
                expect(path.style.fill).toBe('transparent');
            });
        });
        
        test('should assign pattern-piece class to g elements with seam paths', () => {
            textureMapper.initialize(mockSVG);
            
            const piece = mockSVG.querySelector('#piece1');
            
            // Simulate click on seam path
            const seamPath = piece.querySelector('.seam');
            const clickEvent = new Event('click', { bubbles: true });
            seamPath.dispatchEvent(clickEvent);
            
            expect(piece.classList.contains('pattern-piece')).toBe(true);
        });
    });
    
    describe('pattern piece selection', () => {
        beforeEach(() => {
            textureMapper.initialize(mockSVG);
        });
        
        test('should select piece when clicked', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            
            expect(textureMapper.selectedPiece).toBe(piece);
            expect(piece.classList.contains('selected')).toBe(true);
            expect(document.getElementById('textureSettings').style.display).toBe('block');
            expect(document.getElementById('selectedPieceName').textContent).toBe('piece1');
        });
        
        test('should deselect previous piece when selecting new piece', () => {
            const piece1 = mockSVG.querySelector('#piece1');
            const piece2 = mockSVG.querySelector('#piece2');
            
            textureMapper.selectPiece(piece1);
            textureMapper.selectPiece(piece2);
            
            expect(piece1.classList.contains('selected')).toBe(false);
            expect(piece2.classList.contains('selected')).toBe(true);
            expect(textureMapper.selectedPiece).toBe(piece2);
        });
        
        test('should not reselect the same piece', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            
            // Add spy to check if deselectPiece is called
            const deselectSpy = vi.spyOn(textureMapper, 'deselectPiece');
            
            textureMapper.selectPiece(piece);
            
            expect(deselectSpy).not.toHaveBeenCalled();
            expect(textureMapper.selectedPiece).toBe(piece);
        });
        
        test('should throw error if piece has no ID', () => {
            const pieceWithoutId = mockSVG.querySelector('#piece3');
            pieceWithoutId.removeAttribute('id');
            
            expect(() => textureMapper.selectPiece(pieceWithoutId)).toThrow('Pattern piece must have an ID');
        });
    });
    
    describe('texture application', () => {
        beforeEach(() => {
            textureMapper.initialize(mockSVG);
        });
        
        test('should apply texture to selected piece', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            
            const imageSrc = 'data:image/png;base64,test';
            textureMapper.applyTexture(imageSrc, 100, 100);
            
            const textureImage = piece.querySelector('.texture-image');
            expect(textureImage).toBeTruthy();
            expect(textureImage.getAttribute('href')).toBe(imageSrc);
            expect(textureMapper.textures.has('piece1')).toBe(true);
        });
        
        test('should create clip path for texture', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            
            textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
            
            const clipPath = mockSVG.querySelector('#clip-piece1');
            expect(clipPath).toBeTruthy();
            expect(clipPath.querySelector('path')).toBeTruthy();
        });
        
        test('should remove clip-path from texture when piece is selected', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            
            textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
            
            const textureImage = piece.querySelector('.texture-image');
            expect(textureImage).toBeDefined();
            expect(textureImage.hasAttribute('clip-path')).toBe(false);
        });
        
        test('should throw error if no piece is selected', () => {
            expect(() => textureMapper.applyTexture('data:image/png;base64,test', 100, 100))
                .toThrow('No piece selected');
        });
    });
    
    describe('texture clipping', () => {
        beforeEach(() => {
            textureMapper.initialize(mockSVG);
        });
        
        test('should apply clip-path when piece is deselected', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
            
            textureMapper.deselectPiece();
            
            const textureImage = piece.querySelector('.texture-image');
            expect(textureImage).toBeDefined();
            expect(textureImage.getAttribute('clip-path')).toBe('url(#clip-piece1)');
        });
        
        test('should ensure all textures are clipped after initialization', () => {
            // Add texture to piece1
            const piece1 = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece1);
            textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
            textureMapper.deselectPiece();
            
            // Re-initialize (simulating page change)
            textureMapper.initialize(mockSVG);
            
            const textureImage = piece1.querySelector('.texture-image');
            expect(textureImage).toBeDefined();
            expect(textureImage.getAttribute('clip-path')).toBe('url(#clip-piece1)');
        });
    });
    
    describe('texture data persistence', () => {
        beforeEach(() => {
            textureMapper.initialize(mockSVG);
        });
        
        test('should save and load texture data', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
            
            const textureData = textureMapper.getTextureData();
            expect(textureData).toHaveLength(1);
            expect(textureData[0].pieceId).toBe('piece1');
            expect(textureData[0].src).toBe('data:image/png;base64,test');
            
            // Clear and reload
            textureMapper.textures.clear();
            textureMapper.loadTextureData(textureData);
            
            expect(textureMapper.textures.has('piece1')).toBe(true);
        });
        
        test('should rebuild texture map from existing images', () => {
            // Manually add texture image
            const piece = mockSVG.querySelector('#piece1');
            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            image.classList.add('texture-image');
            image.setAttribute('href', 'data:image/png;base64,test');
            image.setAttribute('data-natural-width', '100');
            image.setAttribute('data-natural-height', '100');
            piece.insertBefore(image, piece.firstChild);
            
            textureMapper.rebuildTextureMap();
            
            expect(textureMapper.textures.has('piece1')).toBe(true);
            const textureData = textureMapper.textures.get('piece1');
            expect(textureData.src).toBe('data:image/png;base64,test');
        });
    });
    
    describe('texture transformation', () => {
        beforeEach(() => {
            textureMapper.initialize(mockSVG);
        });
        
        test('should update texture transform based on control values', () => {
            const piece = mockSVG.querySelector('#piece1');
            textureMapper.selectPiece(piece);
            textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
            
            // Update control values
            document.getElementById('textureScale').value = '150';
            document.getElementById('textureRotation').value = '45';
            document.getElementById('textureOffsetX').value = '10';
            document.getElementById('textureOffsetY').value = '20';
            
            textureMapper.updateTextureTransform();
            
            const textureData = textureMapper.textures.get('piece1');
            expect(textureData.transform.scale).toBe(150);
            expect(textureData.transform.rotation).toBe(45);
            expect(textureData.transform.offsetX).toBe(10);
            expect(textureData.transform.offsetY).toBe(20);
            
            // Check rotation on texture image
            const textureImage = piece.querySelector('.texture-image');
            expect(textureImage).toBeDefined();
            expect(textureImage.getAttribute('transform')).toContain('rotate(45');
        });
    });
});

// Helper function to create mock SVG
function createMockSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 300');
    
    // Add defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    
    // Add pattern pieces
    for (let i = 1; i <= 3; i++) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', `piece${i}`);
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'seam');
        path.setAttribute('d', `M ${i * 50},50 L ${i * 50 + 40},50 L ${i * 50 + 40},90 L ${i * 50},90 Z`);
        path.style.stroke = '#000';
        path.style.strokeWidth = '1px';
        path.style.fill = 'white';
        
        g.appendChild(path);
        svg.appendChild(g);
    }
    
    return svg;
}