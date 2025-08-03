import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TextureMapper } from '../src/js/texture-mapping.js';

describe('Texture Sync to Master SVG', () => {
    let textureMapper;
    let svgElement;
    let syncCallback;
    let syncedPieces;
    
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <input id="textureScale" value="100" />
            <input id="textureRotation" value="0" />
            <input id="textureOffsetX" value="0" />
            <input id="textureOffsetY" value="0" />
            <div id="textureControls" style="display: none;"></div>
            <button id="removeTextureBtn" style="display: none;"></button>
            <div id="textureSettings" style="display: none;">
                <div id="selectedPieceName"></div>
            </div>
        `;
        
        // Create test SVG
        svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.setAttribute('viewBox', '0 0 500 500');
        svgElement.setAttribute('width', '500mm');
        svgElement.setAttribute('height', '500mm');
        
        // Add defs
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.appendChild(defs);
        
        // Create pattern pieces
        for (let i = 1; i <= 2; i++) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('id', `pattern-piece-${i}`);
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'seam');
            path.setAttribute('d', `M ${i * 100},100 L ${i * 100 + 80},100 L ${i * 100 + 80},180 L ${i * 100},180 Z`);
            path.style.fill = 'transparent';
            path.style.stroke = '#000';
            path.style.strokeWidth = '1';
            
            g.appendChild(path);
            svgElement.appendChild(g);
        }
        textureMapper = new TextureMapper();
        
        // Mock sync callback to track calls
        syncedPieces = [];
        syncCallback = vi.fn((piece) => {
            syncedPieces.push({
                pieceId: piece.getAttribute('id'),
                hasTexture: !!piece.querySelector('.texture-image'),
                textureData: piece.querySelector('.texture-image') ? {
                    x: piece.querySelector('.texture-image').getAttribute('x'),
                    y: piece.querySelector('.texture-image').getAttribute('y'),
                    offsetX: piece.querySelector('.texture-image').getAttribute('data-offset-x'),
                    offsetY: piece.querySelector('.texture-image').getAttribute('data-offset-y'),
                    scale: piece.querySelector('.texture-image').getAttribute('data-scale'),
                    rotation: piece.querySelector('.texture-image').getAttribute('data-rotation')
                } : null
            });
        });
        
        textureMapper.syncCallback = syncCallback;
        textureMapper.initialize(svgElement);
    });
    
    test('should call sync callback when applying texture', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Select piece
        textureMapper.selectPiece(piece);
        
        // Apply texture
        const imageSrc = 'data:image/png;base64,test';
        textureMapper.applyTexture(imageSrc, 100, 100);
        
        // Verify sync callback was called exactly twice 
        // (once in removeTexture for cleanup, once in applyTexture for new texture)
        expect(syncCallback).toHaveBeenCalledTimes(2);
        expect(syncCallback).toHaveBeenCalledWith(piece);
        
        // Verify synced data - check both calls
        expect(syncedPieces).toHaveLength(2);
        
        // First call is from removeTexture (no texture)
        expect(syncedPieces[0].pieceId).toBe('pattern-piece-1');
        expect(syncedPieces[0].hasTexture).toBe(false);
        expect(syncedPieces[0].textureData).toBe(null);
        
        // Second call is from applyTexture (with texture)
        expect(syncedPieces[1].pieceId).toBe('pattern-piece-1');
        expect(syncedPieces[1].hasTexture).toBe(true);
        expect(syncedPieces[1].textureData.offsetX).toBe('0');
        expect(syncedPieces[1].textureData.offsetY).toBe('0');
        expect(syncedPieces[1].textureData.scale).toBe('100');
        expect(syncedPieces[1].textureData.rotation).toBe('0');
    });
    
    test('should call sync callback when updating texture transform', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Select piece and apply texture
        textureMapper.selectPiece(piece);
        textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
        
        // Clear previous calls
        syncCallback.mockClear();
        syncedPieces = [];
        
        // Update transform
        document.getElementById('textureOffsetX').value = '50';
        document.getElementById('textureOffsetY').value = '30';
        document.getElementById('textureScale').value = '150';
        document.getElementById('textureRotation').value = '45';
        
        textureMapper.updateTextureTransform();
        
        // Verify sync callback was called
        expect(syncCallback).toHaveBeenCalledTimes(1);
        expect(syncCallback).toHaveBeenCalledWith(piece);
        
        // Verify synced data has updated values
        expect(syncedPieces[0].textureData.offsetX).toBe('50');
        expect(syncedPieces[0].textureData.offsetY).toBe('30');
        expect(syncedPieces[0].textureData.scale).toBe('150');
        expect(syncedPieces[0].textureData.rotation).toBe('45');
    });
    
    test('should call sync callback when removing texture', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Select piece and apply texture
        textureMapper.selectPiece(piece);
        textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
        
        // Clear previous calls
        syncCallback.mockClear();
        syncedPieces = [];
        
        // Remove texture
        textureMapper.removeTexture();
        
        // Verify sync callback was called
        expect(syncCallback).toHaveBeenCalledTimes(1);
        expect(syncCallback).toHaveBeenCalledWith(piece);
        
        // Verify synced data shows no texture
        expect(syncedPieces[0].hasTexture).toBe(false);
        expect(syncedPieces[0].textureData).toBe(null);
    });
    
    test('should preserve transform data in image attributes', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Select piece and apply texture
        textureMapper.selectPiece(piece);
        textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
        
        // Update transform
        document.getElementById('textureOffsetX').value = '25';
        document.getElementById('textureOffsetY').value = '15';
        document.getElementById('textureScale').value = '120';
        document.getElementById('textureRotation').value = '30';
        
        textureMapper.updateTextureTransform();
        
        // Get the texture image
        const textureImage = piece.querySelector('.texture-image');
        
        // Verify data attributes are set correctly
        expect(textureImage.getAttribute('data-offset-x')).toBe('25');
        expect(textureImage.getAttribute('data-offset-y')).toBe('15');
        expect(textureImage.getAttribute('data-scale')).toBe('120');
        expect(textureImage.getAttribute('data-rotation')).toBe('30');
    });
    
    test('should pass sync callback through updateTextureTransform', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Select piece and apply texture
        textureMapper.selectPiece(piece);
        textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
        
        // Clear previous calls
        syncCallback.mockClear();
        
        // Create a custom sync callback for this test
        const customSyncCallback = vi.fn();
        
        // Call updateTextureTransform with custom callback
        textureMapper.updateTextureTransform(customSyncCallback);
        
        // Verify custom callback was called
        expect(customSyncCallback).toHaveBeenCalledTimes(1);
        expect(customSyncCallback).toHaveBeenCalledWith(piece);
        
        // Verify default callback was not called (since we passed a custom one)
        expect(syncCallback).not.toHaveBeenCalled();
    });
    
    test('should handle drag operations with sync', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Select piece and apply texture
        textureMapper.selectPiece(piece);
        textureMapper.applyTexture('data:image/png;base64,test', 100, 100);
        
        const textureImage = piece.querySelector('.texture-image');
        
        // Clear previous calls
        syncCallback.mockClear();
        syncedPieces = [];
        
        // Simulate mouse down on texture
        const mouseDownEvent = new MouseEvent('mousedown', {
            clientX: 100,
            clientY: 100,
            bubbles: true
        });
        Object.defineProperty(mouseDownEvent, 'target', { value: textureImage, enumerable: true });
        textureMapper.handleTextureMouseDown(mouseDownEvent);
        
        // Mock SVG coordinate transformation
        svgElement.getScreenCTM = vi.fn(() => ({
            inverse: () => ({
                a: 1, b: 0, c: 0, d: 1, e: 0, f: 0
            })
        }));
        svgElement.createSVGPoint = vi.fn(() => ({
            x: 0,
            y: 0,
            matrixTransform: (matrix) => ({ x: 150, y: 150 })
        }));
        
        // Simulate mouse move
        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: 150,
            clientY: 150,
            bubbles: true
        });
        textureMapper.handleTextureMouseMove(mouseMoveEvent);
        
        // Verify sync callback was called during drag
        expect(syncCallback).toHaveBeenCalled();
        
        // Simulate mouse up
        const mouseUpEvent = new MouseEvent('mouseup', {
            clientX: 150,
            clientY: 150,
            bubbles: true
        });
        textureMapper.handleTextureMouseUp(mouseUpEvent);
        
        // Verify texture is no longer being dragged
        expect(textureMapper.isDragging).toBe(false);
    });
    
    test('should rebuild texture map with transform data', () => {
        const piece = svgElement.querySelector('#pattern-piece-1');
        
        // Manually create a texture image with transform data
        const textureImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        textureImage.classList.add('texture-image');
        textureImage.setAttribute('href', 'data:image/png;base64,test');
        textureImage.setAttribute('x', '50');
        textureImage.setAttribute('y', '50');
        textureImage.setAttribute('width', '100');
        textureImage.setAttribute('height', '100');
        textureImage.setAttribute('data-natural-width', '200');
        textureImage.setAttribute('data-natural-height', '200');
        textureImage.setAttribute('data-offset-x', '25');
        textureImage.setAttribute('data-offset-y', '15');
        textureImage.setAttribute('data-scale', '150');
        textureImage.setAttribute('data-rotation', '45');
        piece.insertBefore(textureImage, piece.firstChild);
        
        // Rebuild texture map
        textureMapper.rebuildTextureMap();
        
        // Verify texture data was rebuilt correctly
        const textureData = textureMapper.textures.get('pattern-piece-1');
        expect(textureData).toBeDefined();
        expect(textureData.transform.offsetX).toBe(25);
        expect(textureData.transform.offsetY).toBe(15);
        expect(textureData.transform.scale).toBe(150);
        expect(textureData.transform.rotation).toBe(45);
    });
});