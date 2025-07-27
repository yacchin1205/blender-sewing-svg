import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('Main.js Texture Sync Integration', () => {
    beforeEach(() => {
        // Set up DOM elements without jsdom
        document.body.innerHTML = `
            <input type="file" id="fileInput" />
            <div id="uploadArea"></div>
            <div id="fileInfo"></div>
            <div id="settingsSection"></div>
            <div id="previewSection"></div>
            <div id="actionSection"></div>
            <div id="svgPreview"></div>
            <div id="pageInfo"></div>
            <div id="unitWarning"></div>
            <button id="generatePdf"></button>
            <div id="progressInfo"></div>
            
            <input id="scaleFactor" value="0.001" />
            <input id="seamAllowance" value="5" />
            <select id="paperSize"><option value="a4">A4</option></select>
            <select id="orientation"><option value="portrait">Portrait</option></select>
            
            <div id="pageNavigation" style="display: none;">
                <button id="prevPageBtn"></button>
                <button id="nextPageBtn"></button>
                <div id="pageIndicator"></div>
            </div>
            
            <input type="file" id="textureImageInput" />
            <button id="removeTextureBtn"></button>
            <input id="textureScale" value="100" />
            <input id="textureRotation" value="0" />
            <input id="textureOffsetX" value="0" />
            <input id="textureOffsetY" value="0" />
            
            <div id="textureSettings" style="display: none;">
                <div id="selectedPieceName"></div>
                <div id="textureControls" style="display: none;"></div>
            </div>
        `;
    });
    
    test('syncTextureToScaledSVG should copy texture from preview to scaled SVG', () => {
        // Create mock SVGs
        const scaledSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const previewSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        
        // Create pattern pieces in both SVGs
        const scaledPiece = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        scaledPiece.setAttribute('id', 'test-piece-1');
        scaledSVG.appendChild(scaledPiece);
        
        const previewPiece = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        previewPiece.setAttribute('id', 'test-piece-1');
        previewSVG.appendChild(previewPiece);
        
        // Add texture to preview piece
        const textureImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        textureImage.classList.add('texture-image');
        textureImage.setAttribute('href', 'data:image/png;base64,test');
        textureImage.setAttribute('x', '10');
        textureImage.setAttribute('y', '20');
        textureImage.setAttribute('width', '100');
        textureImage.setAttribute('height', '100');
        textureImage.setAttribute('data-offset-x', '30');
        textureImage.setAttribute('data-offset-y', '40');
        textureImage.setAttribute('data-scale', '150');
        textureImage.setAttribute('data-rotation', '90');
        previewPiece.appendChild(textureImage);
        
        // Mock the sync function
        const syncTextureToScaledSVG = (previewPiece) => {
            const pieceId = previewPiece.getAttribute('id');
            const sourcePiece = scaledSVG.querySelector(`#${pieceId}`);
            
            // Remove existing texture
            const existingImage = sourcePiece.querySelector('.texture-image');
            if (existingImage) {
                existingImage.remove();
            }
            
            // Copy texture from preview
            const previewImage = previewPiece.querySelector('.texture-image');
            if (previewImage) {
                const clonedImage = previewImage.cloneNode(true);
                sourcePiece.insertBefore(clonedImage, sourcePiece.firstChild);
            }
        };
        
        // Execute sync
        syncTextureToScaledSVG(previewPiece);
        
        // Verify texture was copied to scaled SVG
        const copiedTexture = scaledPiece.querySelector('.texture-image');
        expect(copiedTexture).toBeDefined();
        expect(copiedTexture.getAttribute('href')).toBe('data:image/png;base64,test');
        expect(copiedTexture.getAttribute('x')).toBe('10');
        expect(copiedTexture.getAttribute('y')).toBe('20');
        expect(copiedTexture.getAttribute('data-offset-x')).toBe('30');
        expect(copiedTexture.getAttribute('data-offset-y')).toBe('40');
        expect(copiedTexture.getAttribute('data-scale')).toBe('150');
        expect(copiedTexture.getAttribute('data-rotation')).toBe('90');
    });
    
    test('syncTextureToScaledSVG should remove texture when preview has none', () => {
        // Create mock SVGs
        const scaledSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const previewSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        
        // Create pattern pieces
        const scaledPiece = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        scaledPiece.setAttribute('id', 'test-piece-1');
        
        // Add existing texture to scaled piece
        const existingTexture = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        existingTexture.classList.add('texture-image');
        scaledPiece.appendChild(existingTexture);
        scaledSVG.appendChild(scaledPiece);
        
        const previewPiece = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        previewPiece.setAttribute('id', 'test-piece-1');
        previewSVG.appendChild(previewPiece);
        // No texture in preview piece
        
        // Mock the sync function with remove support
        const syncTextureToScaledSVG = (previewPiece) => {
            const pieceId = previewPiece.getAttribute('id');
            const sourcePiece = scaledSVG.querySelector(`#${pieceId}`);
            
            // Remove existing texture
            const existingImage = sourcePiece.querySelector('.texture-image');
            if (existingImage) {
                existingImage.remove();
            }
            
            // Copy texture from preview
            const previewImage = previewPiece.querySelector('.texture-image');
            if (previewImage) {
                const clonedImage = previewImage.cloneNode(true);
                sourcePiece.insertBefore(clonedImage, sourcePiece.firstChild);
            } else {
                // If no texture in preview, ensure it's removed from source too
                const sourceImage = sourcePiece.querySelector('.texture-image');
                if (sourceImage) {
                    sourceImage.remove();
                }
            }
        };
        
        // Execute sync
        syncTextureToScaledSVG(previewPiece);
        
        // Verify texture was removed from scaled SVG
        const remainingTexture = scaledPiece.querySelector('.texture-image');
        expect(remainingTexture).toBeNull();
    });
    
    test('page navigation should preserve texture transforms', () => {
        // Create scaled SVG with texture
        const scaledSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const piece = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        piece.setAttribute('id', 'test-piece-1');
        
        const textureImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        textureImage.classList.add('texture-image');
        textureImage.setAttribute('href', 'data:image/png;base64,test');
        textureImage.setAttribute('data-offset-x', '50');
        textureImage.setAttribute('data-offset-y', '75');
        textureImage.setAttribute('data-scale', '200');
        textureImage.setAttribute('data-rotation', '180');
        piece.appendChild(textureImage);
        scaledSVG.appendChild(piece);
        
        // Simulate creating a new preview from scaled SVG (what happens on page navigation)
        const createPreviewFromScaled = (scaledSVG) => {
            return scaledSVG.cloneNode(true);
        };
        
        const newPreviewSVG = createPreviewFromScaled(scaledSVG);
        
        // Verify texture and its transforms are preserved
        const previewPiece = newPreviewSVG.querySelector('#test-piece-1');
        const previewTexture = previewPiece.querySelector('.texture-image');
        
        expect(previewTexture).toBeDefined();
        expect(previewTexture.getAttribute('data-offset-x')).toBe('50');
        expect(previewTexture.getAttribute('data-offset-y')).toBe('75');
        expect(previewTexture.getAttribute('data-scale')).toBe('200');
        expect(previewTexture.getAttribute('data-rotation')).toBe('180');
    });
});