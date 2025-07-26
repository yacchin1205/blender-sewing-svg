/**
 * Texture mapping functionality for pattern pieces
 */

export class TextureMapper {
    constructor() {
        this.textures = new Map(); // pieceId -> textureData
        this.selectedPiece = null;
        this.svgElement = null;
    }

    /**
     * Initialize texture mapping for an SVG element
     * @param {SVGElement} svgElement - The SVG element containing pattern pieces
     */
    initialize(svgElement) {
        this.svgElement = svgElement;
        this.removeSeamFills();
        this.setupPatternPieceSelection();
        
        // Rebuild texture map from existing images
        this.rebuildTextureMap();
        
        // Ensure all texture images have proper clipping
        this.ensureAllTexturesClipped();
    }

    /**
     * Make seam paths transparent but clickable
     */
    removeSeamFills() {
        if (!this.svgElement) return;
        
        // Make all seam and seam-allowance paths transparent but keep them clickable
        const seamPaths = this.svgElement.querySelectorAll('.seam, .seam-allowance');
        seamPaths.forEach(path => {
            path.style.fill = 'transparent';
            path.setAttribute('fill', 'transparent');
            path.style.pointerEvents = 'all';
        });
    }

    /**
     * Setup click event handlers for pattern pieces
     */
    setupPatternPieceSelection() {
        if (!this.svgElement) return;

        // Add hover event listeners for unified hover effect
        this.svgElement.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('seam') || 
                e.target.classList.contains('seam-allowance')) {
                const piece = this.findPatternPiece(e.target);
                if (piece) {
                    piece.classList.add('hover');
                }
            }
        });

        this.svgElement.addEventListener('mouseout', (e) => {
            if (e.target.classList.contains('seam') || 
                e.target.classList.contains('seam-allowance')) {
                const piece = this.findPatternPiece(e.target);
                if (piece) {
                    piece.classList.remove('hover');
                }
            }
        });

        // Add click event listener to SVG
        this.svgElement.addEventListener('click', (e) => {
            // First try to find pattern-unit
            let piece = e.target.closest('.pattern-unit');
            
            // If no pattern-unit, check if we clicked on a seam or seam-allowance
            if (!piece && (e.target.classList.contains('seam') || 
                           e.target.classList.contains('seam-allowance'))) {
                // Get the parent g element
                piece = e.target.parentElement;
                // Make sure it's a g element and not already selected
                if (piece && piece.tagName === 'g') {
                    // Add a class to identify this as a selectable piece
                    piece.classList.add('pattern-piece');
                }
            }
            
            // Also check for pattern-piece class (for seam-based selection)
            if (!piece) {
                piece = e.target.closest('.pattern-piece');
            }
            
            if (piece) {
                this.selectPiece(piece);
            } else if (!e.target.closest('.texture-image')) {
                this.deselectPiece();
            }
        });

        // Make pattern units hoverable
        const pieces = this.svgElement.querySelectorAll('.pattern-unit');
        pieces.forEach(piece => {
            piece.style.cursor = 'pointer';
        });
        
        // Also make seam and seam-allowance paths hoverable
        const seamPaths = this.svgElement.querySelectorAll('.seam, .seam-allowance');
        seamPaths.forEach(path => {
            path.style.cursor = 'pointer';
        });
    }

    /**
     * Find the pattern piece element from a child element
     * @param {Element} element - The element to start from
     * @returns {Element|null} - The pattern piece element or null
     */
    findPatternPiece(element) {
        // First check if it's already a pattern unit or piece
        if (element.classList.contains('pattern-unit') || element.classList.contains('pattern-piece')) {
            return element;
        }
        
        // Check parent for pattern-unit
        let piece = element.closest('.pattern-unit');
        if (piece) return piece;
        
        // Check parent for pattern-piece
        piece = element.closest('.pattern-piece');
        if (piece) return piece;
        
        // If element is seam or seam-allowance, check parent g element
        if (element.classList.contains('seam') || element.classList.contains('seam-allowance')) {
            const parent = element.parentElement;
            if (parent && parent.tagName === 'g') {
                parent.classList.add('pattern-piece');
                return parent;
            }
        }
        
        return null;
    }

    /**
     * Select a pattern piece
     * @param {Element} piece - The pattern piece element
     */
    selectPiece(piece) {
        // If clicking the same piece, just return
        if (this.selectedPiece === piece) {
            return;
        }
        
        // Properly deselect previous piece (including re-applying clip-path)
        this.deselectPiece();

        // Select new piece
        this.selectedPiece = piece;
        piece.classList.add('selected');

        // Update UI
        const pieceName = piece.getAttribute('id');
        if (!pieceName) {
            console.error('Pattern piece has no ID:', piece);
            throw new Error('Pattern piece must have an ID');
        }
        document.getElementById('selectedPieceName').textContent = pieceName;
        document.getElementById('textureSettings').style.display = 'block';

        // Show existing texture controls if texture exists
        const textureData = this.textures.get(pieceName);
        if (textureData) {
            this.showTextureControls(textureData);
            document.getElementById('removeTextureBtn').style.display = 'inline-block';
            
            // Remove clipping from texture image when selected
            const textureImage = piece.querySelector('.texture-image');
            if (textureImage) {
                textureImage.removeAttribute('clip-path');
                console.log(`Removed clip-path from piece ${pieceName}`);
            }
        } else {
            document.getElementById('textureControls').style.display = 'none';
            document.getElementById('removeTextureBtn').style.display = 'none';
        }
    }

    /**
     * Deselect the current piece
     */
    deselectPiece() {
        if (this.selectedPiece) {
            // Re-apply clipping to texture image when deselected
            const pieceId = this.selectedPiece.getAttribute('id');
            if (pieceId) {
                const textureImage = this.selectedPiece.querySelector('.texture-image');
                if (textureImage) {
                    const clipId = `clip-${pieceId}`;
                    textureImage.setAttribute('clip-path', `url(#${clipId})`);
                    console.log(`Re-applied clip-path to piece ${pieceId}`);
                }
            }
            
            this.selectedPiece.classList.remove('selected');
            this.selectedPiece = null;
        }
        document.getElementById('textureSettings').style.display = 'none';
    }

    /**
     * Apply texture to the selected piece
     * @param {string} imageSrc - Base64 or URL of the image
     * @param {number} imageWidth - Natural width of the image
     * @param {number} imageHeight - Natural height of the image
     */
    applyTexture(imageSrc, imageWidth, imageHeight) {
        if (!this.selectedPiece) {
            throw new Error('No piece selected');
        }

        const pieceId = this.selectedPiece.getAttribute('id');
        if (!pieceId) {
            throw new Error('Selected piece has no ID');
        }
        
        // Remove existing texture
        this.removeTexture();

        // Create clipPath for the piece
        const clipId = `clip-${pieceId}`;
        this.createClipPath(this.selectedPiece, clipId);

        // Get piece bounding box
        const bbox = this.selectedPiece.getBBox();

        // Calculate initial size to fit within piece
        const imageAspect = imageWidth / imageHeight;
        const pieceAspect = bbox.width / bbox.height;
        
        let width, height;
        if (imageAspect > pieceAspect) {
            width = bbox.width;
            height = width / imageAspect;
        } else {
            height = bbox.height;
            width = height * imageAspect;
        }

        // Create image element
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('href', imageSrc);
        image.classList.add('texture-image');
        
        // Center the image in the piece
        const x = bbox.x + (bbox.width - width) / 2;
        const y = bbox.y + (bbox.height - height) / 2;
        
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', width);
        image.setAttribute('height', height);
        
        // Store natural dimensions for later reference
        image.setAttribute('data-natural-width', imageWidth);
        image.setAttribute('data-natural-height', imageHeight);
        
        // Apply clipping (will be removed while selected)
        image.setAttribute('clip-path', `url(#${clipId})`);
        
        // Insert image as first child (behind other elements)
        this.selectedPiece.insertBefore(image, this.selectedPiece.firstChild);
        
        // Remove clipping since piece is selected
        image.removeAttribute('clip-path');

        // Store texture data
        const textureData = {
            src: imageSrc,
            naturalWidth: imageWidth,
            naturalHeight: imageHeight,
            transform: {
                x: x,
                y: y,
                width: width,
                height: height,
                scale: 100,
                rotation: 0,
                offsetX: 0,
                offsetY: 0
            }
        };
        
        this.textures.set(pieceId, textureData);

        // Show controls and update values
        this.showTextureControls(textureData);
        document.getElementById('removeTextureBtn').style.display = 'inline-block';
    }

    /**
     * Create a clip path for the pattern piece
     * @param {Element} piece - The pattern piece element
     * @param {string} clipId - ID for the clip path
     */
    createClipPath(piece, clipId) {
        // Check if clip path already exists
        let clipPath = this.svgElement.querySelector(`#${clipId}`);
        if (clipPath) return;

        // Create new clip path
        clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipId);

        // Find the appropriate path for clipping
        // First try seam-allowance (outer boundary if it exists)
        let clippingPath = piece.querySelector('.seam-allowance');
        // If no seam-allowance, use seam path
        if (!clippingPath) {
            clippingPath = piece.querySelector('.seam');
        }
        
        if (clippingPath) {
            const clonedPath = clippingPath.cloneNode(true);
            // Remove any styling that might interfere
            clonedPath.removeAttribute('class');
            clonedPath.removeAttribute('style');
            // Ensure the path has no fill that would block the image
            clonedPath.setAttribute('fill', 'none');
            clipPath.appendChild(clonedPath);
            
            console.log('Created clip path:', clipId, 'from', clippingPath.classList.toString());
        } else {
            console.warn('No clipping path found for piece:', piece);
        }

        // Add to defs
        let defs = this.svgElement.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svgElement.insertBefore(defs, this.svgElement.firstChild);
        }
        defs.appendChild(clipPath);
    }

    /**
     * Show texture controls with current values
     * @param {Object} textureData - The texture data
     */
    showTextureControls(textureData) {
        document.getElementById('textureControls').style.display = 'block';
        
        // Set control values
        document.getElementById('textureScale').value = textureData.transform.scale;
        document.getElementById('textureRotation').value = textureData.transform.rotation;
        document.getElementById('textureOffsetX').value = textureData.transform.offsetX;
        document.getElementById('textureOffsetY').value = textureData.transform.offsetY;
    }

    /**
     * Update texture transform based on control values
     */
    updateTextureTransform() {
        if (!this.selectedPiece) return;

        const pieceId = this.selectedPiece.getAttribute('id');
        if (!pieceId) {
            console.error('Selected piece has no ID');
            return;
        }
        
        const textureData = this.textures.get(pieceId);
        if (!textureData) return;

        const image = this.selectedPiece.querySelector('.texture-image');
        if (!image) return;

        // Get control values
        const scale = parseFloat(document.getElementById('textureScale').value) / 100;
        const rotation = parseFloat(document.getElementById('textureRotation').value);
        const offsetX = parseFloat(document.getElementById('textureOffsetX').value);
        const offsetY = parseFloat(document.getElementById('textureOffsetY').value);

        // Update stored transform
        textureData.transform.scale = scale * 100;
        textureData.transform.rotation = rotation;
        textureData.transform.offsetX = offsetX;
        textureData.transform.offsetY = offsetY;

        // Calculate new dimensions
        const newWidth = textureData.transform.width * scale;
        const newHeight = textureData.transform.height * scale;

        // Apply transformations
        const bbox = this.selectedPiece.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        // Calculate position with offset
        const x = centerX - newWidth / 2 + offsetX;
        const y = centerY - newHeight / 2 + offsetY;

        // Update image attributes
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', newWidth);
        image.setAttribute('height', newHeight);

        // Apply rotation around center
        if (rotation !== 0) {
            const imageCenterX = x + newWidth / 2;
            const imageCenterY = y + newHeight / 2;
            image.setAttribute('transform', `rotate(${rotation} ${imageCenterX} ${imageCenterY})`);
        } else {
            image.removeAttribute('transform');
        }
    }

    /**
     * Remove texture from selected piece
     */
    removeTexture() {
        if (!this.selectedPiece) return;

        const pieceId = this.selectedPiece.getAttribute('id');
        const image = this.selectedPiece.querySelector('.texture-image');
        
        if (image) {
            image.remove();
        }

        this.textures.delete(pieceId);
        
        // Hide controls
        document.getElementById('textureControls').style.display = 'none';
        document.getElementById('removeTextureBtn').style.display = 'none';
    }

    /**
     * Get all texture data for saving
     * @returns {Array} Array of texture data
     */
    getTextureData() {
        const data = [];
        this.textures.forEach((textureData, pieceId) => {
            data.push({
                pieceId,
                ...textureData
            });
        });
        return data;
    }

    /**
     * Load texture data
     * @param {Array} data - Array of texture data
     */
    loadTextureData(data) {
        data.forEach(item => {
            const piece = this.svgElement.querySelector(`#${item.pieceId}`);
            if (piece) {
                // Check if texture already exists (from cloneNode)
                const existingImage = piece.querySelector('.texture-image');
                if (existingImage) {
                    // Just update the texture map
                    this.textures.set(item.pieceId, item);
                    // Ensure clip-path is applied since piece is not selected after page switch
                    const clipId = `clip-${item.pieceId}`;
                    existingImage.setAttribute('clip-path', `url(#${clipId})`);
                    console.log(`Applied clip-path to existing texture in piece ${item.pieceId}`);
                } else {
                    // Temporarily select the piece
                    this.selectedPiece = piece;
                    
                    // Apply the texture
                    this.applyTexture(item.src, item.naturalWidth, item.naturalHeight);
                    
                    // Restore transform
                    const textureData = this.textures.get(item.pieceId);
                    if (textureData) {
                        textureData.transform = item.transform;
                        this.updateTextureTransform();
                    }
                    
                    // Ensure clip-path is applied since we're not selecting the piece
                    const textureImage = piece.querySelector('.texture-image');
                    if (textureImage) {
                        const clipId = `clip-${item.pieceId}`;
                        textureImage.setAttribute('clip-path', `url(#${clipId})`);
                    }
                }
            }
        });
        
        // Deselect
        this.deselectPiece();
    }
    
    /**
     * Re-apply textures to the current SVG
     */
    reapplyTextures() {
        if (!this.svgElement || this.textures.size === 0) return;
        
        // Create a copy of texture data to avoid modification during iteration
        const textureDataCopy = new Map(this.textures);
        
        // Clear the textures map to avoid circular references
        this.textures.clear();
        
        // Re-apply each texture
        textureDataCopy.forEach((textureData, pieceId) => {
            // Find the piece in the current SVG
            const piece = this.svgElement.querySelector(`#${pieceId}`);
            if (piece) {
                // Check if texture image already exists (from cloneNode)
                const existingImage = piece.querySelector('.texture-image');
                if (existingImage) {
                    // Just update the textures map
                    this.textures.set(pieceId, textureData);
                } else {
                    // Apply new texture
                    this.selectedPiece = piece;
                    this.applyTexture(textureData.src, textureData.naturalWidth, textureData.naturalHeight);
                    
                    // Restore transform
                    const newTextureData = this.textures.get(pieceId);
                    if (newTextureData) {
                        newTextureData.transform = textureData.transform;
                        this.updateTextureTransform();
                    }
                }
            }
        });
        
        // Clear selection
        this.selectedPiece = null;
    }
    
    /**
     * Rebuild texture map from existing texture images in SVG
     */
    rebuildTextureMap() {
        if (!this.svgElement) {
            throw new Error('SVG element is not initialized');
        }
        
        // Clear existing map
        this.textures.clear();
        
        // Find all texture images
        const textureImages = this.svgElement.querySelectorAll('.texture-image');
        
        textureImages.forEach(image => {
            const piece = image.parentElement;
            if (!piece || piece.tagName !== 'g') {
                console.error('Texture image found outside of g element:', image);
                return;
            }
            
            const pieceId = piece.getAttribute('id');
            if (!pieceId) {
                console.error('Pattern piece with texture has no ID:', piece);
                return;
            }
            
            // Rebuild texture data from image attributes
            const textureData = {
                src: image.getAttribute('href') || image.getAttribute('xlink:href'),
                naturalWidth: parseFloat(image.getAttribute('data-natural-width') || image.getAttribute('width')),
                naturalHeight: parseFloat(image.getAttribute('data-natural-height') || image.getAttribute('height')),
                transform: {
                    x: parseFloat(image.getAttribute('x') || 0),
                    y: parseFloat(image.getAttribute('y') || 0),
                    width: parseFloat(image.getAttribute('width') || 0),
                    height: parseFloat(image.getAttribute('height') || 0),
                    scale: 100, // Will be calculated from width/height
                    rotation: 0, // Will be extracted from transform attribute if present
                    offsetX: 0,
                    offsetY: 0
                }
            };
            
            // Extract rotation from transform attribute if present
            const transform = image.getAttribute('transform');
            if (transform) {
                const rotateMatch = transform.match(/rotate\(([^,]+)/);
                if (rotateMatch) {
                    textureData.transform.rotation = parseFloat(rotateMatch[1]);
                }
            }
            
            this.textures.set(pieceId, textureData);
        });
    }
    
    /**
     * Ensure all texture images have proper clipping paths
     */
    ensureAllTexturesClipped() {
        if (!this.svgElement) return;
        
        // Find all texture images
        const textureImages = this.svgElement.querySelectorAll('.texture-image');
        
        textureImages.forEach(image => {
            const piece = image.parentElement;
            if (!piece || piece.tagName !== 'g') return;
            
            const pieceId = piece.getAttribute('id');
            if (!pieceId) return;
            
            // Skip if this is the selected piece
            if (piece === this.selectedPiece) return;
            
            const clipId = `clip-${pieceId}`;
            
            // Check if clip path exists
            let clipPath = this.svgElement.querySelector(`#${clipId}`);
            if (!clipPath) {
                // Create clip path if it doesn't exist
                this.createClipPath(piece, clipId);
                console.log(`Created missing clip path for piece ${pieceId}`);
            }
            
            // Apply clipping
            image.setAttribute('clip-path', `url(#${clipId})`);
            console.log(`Ensured clip-path for texture in piece ${pieceId}`);
        });
    }
}