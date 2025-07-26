/**
 * Texture mapping functionality for pattern pieces
 */

export class TextureMapper {
    constructor() {
        this.textures = new Map(); // pieceId -> textureData
        this.selectedPiece = null;
        this.svgElement = null;
        this.syncCallback = null; // Callback to sync changes to master SVG
        
        // Drag state
        this.isDragging = false;
        this.dragStartPoint = null;
        this.dragStartOffset = null;
        this.activeTextureImage = null;
        
        // Resize state
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartPoint = null;
        this.resizeStartScale = null;
        this.resizeStartDimensions = null;
        
        // Rotate state
        this.isRotating = false;
        this.rotateStartPoint = null;
        this.rotateStartAngle = null;
        this.rotateCenter = null;
        
        // Manipulation handles
        this.manipulationHandles = null;
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
        
        // Setup texture manipulation events
        this.setupTextureManipulation();
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
            
            // Update texture interactivity
            this.updateTextureInteractivity();
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
        
        // Remove manipulation handles
        if (this.manipulationHandles) {
            this.manipulationHandles.remove();
            this.manipulationHandles = null;
        }
        
        // Update texture interactivity
        this.updateTextureInteractivity();
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

        // Get piece bounding box from seam path only (not including texture)
        const seamPath = this.selectedPiece.querySelector('.seam');
        const bbox = seamPath.getBBox();

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
        
        // Store initial transform data
        image.setAttribute('data-offset-x', '0');
        image.setAttribute('data-offset-y', '0');
        image.setAttribute('data-scale', '100');
        image.setAttribute('data-rotation', '0');
        
        // Apply clipping directly to the image
        image.setAttribute('clip-path', `url(#${clipId})`);
        
        // Add image directly to piece (no group needed)
        this.selectedPiece.insertBefore(image, this.selectedPiece.firstChild);
        
        // Remove clipping since piece is selected
        image.removeAttribute('clip-path');

        // Calculate and store piece center based on seam path
        const pieceCenterX = bbox.x + bbox.width / 2;
        const pieceCenterY = bbox.y + bbox.height / 2;
        
        // Store texture data
        const textureData = {
            src: imageSrc,
            naturalWidth: imageWidth,
            naturalHeight: imageHeight,
            pieceCenter: {
                x: pieceCenterX,
                y: pieceCenterY
            },
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
        
        // Update texture interactivity
        this.updateTextureInteractivity();
        
        // Sync to master SVG
        if (this.syncCallback) {
            this.syncCallback(this.selectedPiece);
        }
    }

    /**
     * Create a clip path for the pattern piece
     * @param {Element} piece - The pattern piece element
     * @param {string} clipId - ID for the clip path
     * @param {number} rotation - Current rotation angle (optional)
     * @param {number} centerX - X coordinate of rotation center (optional)
     * @param {number} centerY - Y coordinate of rotation center (optional)
     */
    createClipPath(piece, clipId, rotation = 0, centerX = null, centerY = null) {
        // Always recreate clip path to update rotation
        let existingClipPath = this.svgElement.querySelector(`#${clipId}`);
        if (existingClipPath) {
            existingClipPath.remove();
        }

        // Create new clip path
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
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
            
            // Apply inverse rotation to the clip path
            if (rotation !== 0) {
                // Use provided center or calculate from bounding box
                if (centerX === null || centerY === null) {
                    const bbox = clippingPath.getBBox();
                    centerX = bbox.x + bbox.width / 2;
                    centerY = bbox.y + bbox.height / 2;
                }
                clonedPath.setAttribute('transform', `rotate(${-rotation} ${centerX} ${centerY})`);
            }
            
            clipPath.appendChild(clonedPath);
            
            console.log('Created clip path:', clipId, 'from', clippingPath.classList.toString(), 'with rotation:', -rotation);
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
    updateTextureTransform(syncCallback) {
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

        // Use stored piece center instead of recalculating
        let centerX, centerY;
        if (textureData.pieceCenter) {
            centerX = textureData.pieceCenter.x;
            centerY = textureData.pieceCenter.y;
        } else {
            // Fallback: calculate from seam path
            const seamPath = this.selectedPiece.querySelector('.seam');
            const seamBBox = seamPath.getBBox();
            centerX = seamBBox.x + seamBBox.width / 2;
            centerY = seamBBox.y + seamBBox.height / 2;
            // Store for future use
            textureData.pieceCenter = { x: centerX, y: centerY };
        }

        // Calculate position with offset
        const x = centerX - newWidth / 2 + offsetX;
        const y = centerY - newHeight / 2 + offsetY;

        // Update image attributes
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', newWidth);
        image.setAttribute('height', newHeight);
        
        // Store transform data in custom attributes for persistence
        image.setAttribute('data-offset-x', offsetX);
        image.setAttribute('data-offset-y', offsetY);
        image.setAttribute('data-scale', scale * 100);
        image.setAttribute('data-rotation', rotation);

        // Apply rotation directly to the image
        const imageCenterX = x + newWidth / 2;
        const imageCenterY = y + newHeight / 2;
        
        if (rotation !== 0) {
            image.setAttribute('transform', `rotate(${rotation} ${imageCenterX} ${imageCenterY})`);
        } else {
            image.removeAttribute('transform');
        }
        
        // Update clip path with inverse rotation, using the same center as the image
        const clipId = `clip-${pieceId}`;
        this.createClipPath(this.selectedPiece, clipId, rotation, imageCenterX, imageCenterY);
        
        // Call sync callback if provided, otherwise use default
        if (syncCallback) {
            syncCallback(this.selectedPiece);
        } else if (this.syncCallback) {
            this.syncCallback(this.selectedPiece);
        }
        
        // Update manipulation handles to reflect new transform
        this.updateManipulationHandles();
    }

    /**
     * Remove texture from selected piece
     */
    removeTexture() {
        if (!this.selectedPiece) return;

        const pieceId = this.selectedPiece.getAttribute('id');
        const textureImage = this.selectedPiece.querySelector('.texture-image');
        
        if (textureImage) {
            textureImage.remove();
        }

        this.textures.delete(pieceId);
        
        // Hide controls
        document.getElementById('textureControls').style.display = 'none';
        document.getElementById('removeTextureBtn').style.display = 'none';
        
        // Sync to master SVG
        if (this.syncCallback) {
            this.syncCallback(this.selectedPiece);
        }
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
                    // Ensure clip-path is applied to texture image since piece is not selected after page switch
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
                        if (item.pieceCenter) {
                            textureData.pieceCenter = item.pieceCenter;
                        }
                        this.updateTextureTransform();
                    }
                    
                    // Ensure clip-path is applied to texture image since we're not selecting the piece
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
            // Get the pattern piece (parent element)
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
            
            // Calculate piece center from seam path
            const seamPath = piece.querySelector('.seam');
            const seamBBox = seamPath.getBBox();
            const pieceCenterX = seamBBox.x + seamBBox.width / 2;
            const pieceCenterY = seamBBox.y + seamBBox.height / 2;
            
            // Rebuild texture data from image attributes
            const textureData = {
                src: image.getAttribute('href') || image.getAttribute('xlink:href'),
                naturalWidth: parseFloat(image.getAttribute('data-natural-width') || image.getAttribute('width')),
                naturalHeight: parseFloat(image.getAttribute('data-natural-height') || image.getAttribute('height')),
                pieceCenter: {
                    x: pieceCenterX,
                    y: pieceCenterY
                },
                transform: {
                    x: parseFloat(image.getAttribute('x') || 0),
                    y: parseFloat(image.getAttribute('y') || 0),
                    width: parseFloat(image.getAttribute('width') || 0),
                    height: parseFloat(image.getAttribute('height') || 0),
                    scale: 100, // Will be calculated from width/height
                    rotation: 0, // Will be extracted from transform attribute if present
                    offsetX: parseFloat(image.getAttribute('data-offset-x') || 0),
                    offsetY: parseFloat(image.getAttribute('data-offset-y') || 0)
                }
            };
            
            // Extract scale from stored attribute
            const storedScale = image.getAttribute('data-scale');
            if (storedScale) {
                textureData.transform.scale = parseFloat(storedScale);
            }
            
            // Extract rotation from stored attribute or image transform
            const storedRotation = image.getAttribute('data-rotation');
            if (storedRotation) {
                textureData.transform.rotation = parseFloat(storedRotation);
            } else {
                // Check image transform for rotation
                const transform = image.getAttribute('transform');
                if (transform) {
                    const rotateMatch = transform.match(/rotate\(([^,]+)/);
                    if (rotateMatch) {
                        textureData.transform.rotation = parseFloat(rotateMatch[1]);
                    }
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
            // Get the pattern piece (parent element)
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
            
            // Apply clipping to texture image
            image.setAttribute('clip-path', `url(#${clipId})`);
            console.log(`Ensured clip-path for texture in piece ${pieceId}`);
        });
    }
    
    /**
     * Setup texture manipulation events (drag, resize, rotate)
     */
    setupTextureManipulation() {
        if (!this.svgElement) return;
        
        // Mouse events for texture manipulation
        this.svgElement.addEventListener('mousedown', (e) => this.handleTextureMouseDown(e));
        this.svgElement.addEventListener('mousemove', (e) => this.handleTextureMouseMove(e));
        this.svgElement.addEventListener('mouseup', (e) => this.handleTextureMouseUp(e));
        this.svgElement.addEventListener('mouseleave', (e) => this.handleTextureMouseUp(e));
        
        // Update texture images to be interactive when selected
        this.updateTextureInteractivity();
    }
    
    /**
     * Update texture images interactivity based on selection
     */
    updateTextureInteractivity() {
        const textureImages = this.svgElement.querySelectorAll('.texture-image');
        textureImages.forEach(image => {
            // Get the pattern piece (parent element)
            const piece = image.parentElement;
            if (piece === this.selectedPiece) {
                // Make texture interactive when piece is selected
                image.style.pointerEvents = 'all';
                image.style.cursor = 'move';
            } else {
                // Texture should not block piece selection
                image.style.pointerEvents = 'none';
            }
        });
        
        // Update manipulation handles
        this.updateManipulationHandles();
    }
    
    /**
     * Create or update manipulation handles for selected texture
     */
    updateManipulationHandles() {
        // Remove existing handles
        if (this.manipulationHandles) {
            this.manipulationHandles.remove();
            this.manipulationHandles = null;
        }
        
        if (!this.selectedPiece) return;
        
        const textureImage = this.selectedPiece.querySelector('.texture-image');
        if (!textureImage) return;
        
        // Create handles group
        const handlesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handlesGroup.classList.add('texture-manipulation-handles');
        
        // Get texture bounds
        const x = parseFloat(textureImage.getAttribute('x'));
        const y = parseFloat(textureImage.getAttribute('y'));
        const width = parseFloat(textureImage.getAttribute('width'));
        const height = parseFloat(textureImage.getAttribute('height'));
        
        
        // Get rotation from image transform
        let rotation = 0;
        let centerX = x + width / 2;
        let centerY = y + height / 2;
        
        const transform = textureImage.getAttribute('transform');
        if (transform) {
            const rotateMatch = transform.match(/rotate\(([^,]+),?\s*([^,]*),?\s*([^)]*)\)/);
            if (rotateMatch) {
                rotation = parseFloat(rotateMatch[1]);
                if (rotateMatch[2] && rotateMatch[3]) {
                    centerX = parseFloat(rotateMatch[2]);
                    centerY = parseFloat(rotateMatch[3]);
                }
            }
        }
        
        // Create resize handles (corners)
        const handleSize = 10;
        const handlePositions = [
            { id: 'nw', x: x - handleSize/2, y: y - handleSize/2 },
            { id: 'ne', x: x + width - handleSize/2, y: y - handleSize/2 },
            { id: 'sw', x: x - handleSize/2, y: y + height - handleSize/2 },
            { id: 'se', x: x + width - handleSize/2, y: y + height - handleSize/2 }
        ];
        
        
        handlePositions.forEach(pos => {
            const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            handle.setAttribute('x', pos.x);
            handle.setAttribute('y', pos.y);
            handle.setAttribute('width', handleSize);
            handle.setAttribute('height', handleSize);
            handle.setAttribute('fill', '#4299e1');
            handle.setAttribute('stroke', '#fff');
            handle.setAttribute('stroke-width', '1');
            handle.setAttribute('class', `resize-handle resize-handle-${pos.id}`);
            handle.style.cursor = pos.id.includes('n') && pos.id.includes('w') || pos.id.includes('s') && pos.id.includes('e') ? 'nwse-resize' : 'nesw-resize';
            handle.style.pointerEvents = 'all';
            handlesGroup.appendChild(handle);
        });
        
        // Create rotation handles (all four sides)
        const rotateHandleOffset = 20;
        const rotateHandlePositions = [
            { id: 'top', cx: x + width / 2, cy: y - rotateHandleOffset, lineX1: x + width / 2, lineY1: y, lineX2: x + width / 2, lineY2: y - rotateHandleOffset },
            { id: 'bottom', cx: x + width / 2, cy: y + height + rotateHandleOffset, lineX1: x + width / 2, lineY1: y + height, lineX2: x + width / 2, lineY2: y + height + rotateHandleOffset },
            { id: 'left', cx: x - rotateHandleOffset, cy: y + height / 2, lineX1: x, lineY1: y + height / 2, lineX2: x - rotateHandleOffset, lineY2: y + height / 2 },
            { id: 'right', cx: x + width + rotateHandleOffset, cy: y + height / 2, lineX1: x + width, lineY1: y + height / 2, lineX2: x + width + rotateHandleOffset, lineY2: y + height / 2 }
        ];
        
        rotateHandlePositions.forEach(pos => {
            // Add line connecting rotation handle to texture
            const rotateLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            rotateLine.setAttribute('x1', pos.lineX1);
            rotateLine.setAttribute('y1', pos.lineY1);
            rotateLine.setAttribute('x2', pos.lineX2);
            rotateLine.setAttribute('y2', pos.lineY2);
            rotateLine.setAttribute('stroke', '#48bb78');
            rotateLine.setAttribute('stroke-width', '1');
            rotateLine.setAttribute('stroke-dasharray', '2,2');
            rotateLine.style.pointerEvents = 'none';
            handlesGroup.appendChild(rotateLine);
            
            // Create rotation handle
            const rotateHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            rotateHandle.setAttribute('cx', pos.cx);
            rotateHandle.setAttribute('cy', pos.cy);
            rotateHandle.setAttribute('r', 6);
            rotateHandle.setAttribute('fill', '#48bb78');
            rotateHandle.setAttribute('stroke', '#fff');
            rotateHandle.setAttribute('stroke-width', '1');
            rotateHandle.setAttribute('class', `rotate-handle rotate-handle-${pos.id}`);
            rotateHandle.style.cursor = 'crosshair';
            rotateHandle.style.pointerEvents = 'all';
            handlesGroup.appendChild(rotateHandle);
        });
        
        // Apply rotation to handles group if needed
        if (rotation !== 0) {
            handlesGroup.setAttribute('transform', `rotate(${rotation} ${centerX} ${centerY})`);
        }
        
        // Add handles to the pattern piece (not the texture group) to ensure they're on top
        this.selectedPiece.appendChild(handlesGroup);
        this.manipulationHandles = handlesGroup;
    }
    
    /**
     * Handle mouse down on texture
     */
    handleTextureMouseDown(e) {
        // Check if we clicked on a texture image of the selected piece
        if (!this.selectedPiece) return;
        
        const textureImage = this.selectedPiece.querySelector('.texture-image');
        const target = e.target;
        
        // Check if we clicked on a resize handle
        if (target.classList.contains('resize-handle')) {
            this.startResize(e, target);
            return;
        }
        
        // Check if we clicked on rotation handle
        if (target.classList.contains('rotate-handle')) {
            this.startRotation(e);
            return;
        }
        
        // Check if we clicked on the texture image itself
        if (!textureImage || target !== textureImage) return;
        
        // Start dragging
        this.isDragging = true;
        this.activeTextureImage = textureImage;
        this.dragStartPoint = { x: e.clientX, y: e.clientY };
        
        // Add dragging class for visual feedback
        textureImage.classList.add('dragging');
        
        // Get current offset values
        const pieceId = this.selectedPiece.getAttribute('id');
        const textureData = this.textures.get(pieceId);
        if (textureData) {
            this.dragStartOffset = {
                x: textureData.transform.offsetX || 0,
                y: textureData.transform.offsetY || 0
            };
        } else {
            this.dragStartOffset = { x: 0, y: 0 };
        }
        
        
        // Prevent default to avoid image dragging behavior
        e.preventDefault();
    }
    
    /**
     * Start resizing texture
     */
    startResize(e, handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.resizeStartPoint = { x: e.clientX, y: e.clientY };
        
        const textureImage = this.selectedPiece.querySelector('.texture-image');
        const pieceId = this.selectedPiece.getAttribute('id');
        const textureData = this.textures.get(pieceId);
        
        if (textureData) {
            this.resizeStartScale = textureData.transform.scale || 100;
            this.resizeStartDimensions = {
                width: parseFloat(textureImage.getAttribute('width')),
                height: parseFloat(textureImage.getAttribute('height'))
            };
        }
        
        // Add visual feedback
        textureImage.classList.add('resizing');
        
        e.preventDefault();
    }
    
    /**
     * Start rotating texture
     */
    startRotation(e) {
        this.isRotating = true;
        this.rotateStartPoint = { x: e.clientX, y: e.clientY };
        
        const textureImage = this.selectedPiece.querySelector('.texture-image');
        const pieceId = this.selectedPiece.getAttribute('id');
        const textureData = this.textures.get(pieceId);
        
        // Get texture center in SVG coordinates
        const x = parseFloat(textureImage.getAttribute('x'));
        const y = parseFloat(textureImage.getAttribute('y'));
        const width = parseFloat(textureImage.getAttribute('width'));
        const height = parseFloat(textureImage.getAttribute('height'));
        
        this.rotateCenter = {
            x: x + width / 2,
            y: y + height / 2
        };
        
        // Calculate initial angle
        const pt = this.svgElement.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const matrix = this.svgElement.getScreenCTM();
        if (matrix) {
            const svgPoint = pt.matrixTransform(matrix.inverse());
            const dx = svgPoint.x - this.rotateCenter.x;
            const dy = svgPoint.y - this.rotateCenter.y;
            this.rotateStartAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        }
        
        if (textureData) {
            this.rotateStartRotation = textureData.transform.rotation || 0;
        } else {
            this.rotateStartRotation = 0;
        }
        
        // Add visual feedback
        textureImage.classList.add('rotating');
        
        e.preventDefault();
    }
    
    /**
     * Handle mouse move for texture dragging
     */
    handleTextureMouseMove(e) {
        if (this.isResizing) {
            this.handleResize(e);
        } else if (this.isRotating) {
            this.handleRotation(e);
        } else if (this.isDragging && this.activeTextureImage) {
            this.handleDrag(e);
        }
    }
    
    /**
     * Handle dragging
     */
    handleDrag(e) {
        // Get the current scale of the texture
        const pieceId = this.selectedPiece.getAttribute('id');
        const textureData = this.textures.get(pieceId);
        const currentScale = textureData ? (textureData.transform.scale / 100) : 1;
        
        // Convert screen coordinates to SVG coordinates
        const pt = this.svgElement.createSVGPoint();
        
        // Get the CTM (Current Transformation Matrix) for the SVG
        const matrix = this.svgElement.getScreenCTM();
        if (!matrix) return;
        
        // Convert current mouse position
        pt.x = e.clientX;
        pt.y = e.clientY;
        const currentSvgPoint = pt.matrixTransform(matrix.inverse());
        
        // Convert start position
        pt.x = this.dragStartPoint.x;
        pt.y = this.dragStartPoint.y;
        const startSvgPoint = pt.matrixTransform(matrix.inverse());
        
        // Calculate delta in SVG coordinates
        let deltaX = currentSvgPoint.x - startSvgPoint.x;
        let deltaY = currentSvgPoint.y - startSvgPoint.y;
        
        // Compensate for scale to maintain consistent drag sensitivity
        // When image is scaled up, we need to reduce the delta to maintain the same visual movement
        deltaX = deltaX / currentScale;
        deltaY = deltaY / currentScale;
        
        // Update offset values
        const newOffsetX = this.dragStartOffset.x + deltaX;
        const newOffsetY = this.dragStartOffset.y + deltaY;
        
        // Update the controls
        document.getElementById('textureOffsetX').value = Math.round(newOffsetX);
        document.getElementById('textureOffsetY').value = Math.round(newOffsetY);
        
        // Apply the transformation with sync callback
        this.updateTextureTransform(this.syncCallback);
        
        e.preventDefault();
    }
    
    /**
     * Handle resizing
     */
    handleResize(e) {
        const deltaX = e.clientX - this.resizeStartPoint.x;
        const deltaY = e.clientY - this.resizeStartPoint.y;
        
        // Determine which handle is being dragged
        const handleClass = this.resizeHandle.getAttribute('class');
        const isCorner = handleClass.includes('resize-handle-');
        
        if (isCorner) {
            // Determine which corner handle is being dragged
            const handleId = handleClass.match(/resize-handle-(\w+)/)?.[1];
            let direction = 1;
            
            // Adjust direction based on which handle is being dragged
            switch(handleId) {
                case 'nw': // North-West: negative X and Y movement increases size
                    direction = (deltaX < 0 || deltaY < 0) ? 1 : -1;
                    break;
                case 'ne': // North-East: positive X, negative Y movement increases size
                    direction = (deltaX > 0 || deltaY < 0) ? 1 : -1;
                    break;
                case 'sw': // South-West: negative X, positive Y movement increases size
                    direction = (deltaX < 0 || deltaY > 0) ? 1 : -1;
                    break;
                case 'se': // South-East: positive X and Y movement increases size
                    direction = (deltaX > 0 || deltaY > 0) ? 1 : -1;
                    break;
            }
            
            // Calculate distance based on the larger movement axis
            const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
            
            // Calculate new scale with reduced sensitivity
            const scaleDelta = (distance * direction) / 300;
            const newScale = Math.max(10, Math.min(500, this.resizeStartScale + (scaleDelta * 100)));
            
            // Update the scale control
            document.getElementById('textureScale').value = Math.round(newScale);
            
            // Apply the transformation
            this.updateTextureTransform(this.syncCallback);
        }
        
        e.preventDefault();
    }
    
    /**
     * Handle rotation
     */
    handleRotation(e) {
        // Convert mouse position to SVG coordinates
        const pt = this.svgElement.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        
        const matrix = this.svgElement.getScreenCTM();
        if (!matrix) return;
        
        const svgPoint = pt.matrixTransform(matrix.inverse());
        
        // Calculate angle from center
        const dx = svgPoint.x - this.rotateCenter.x;
        const dy = svgPoint.y - this.rotateCenter.y;
        const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Calculate rotation delta
        const angleDelta = currentAngle - this.rotateStartAngle;
        let newRotation = this.rotateStartRotation + angleDelta;
        
        // Normalize angle to 0-360 range
        while (newRotation < 0) newRotation += 360;
        while (newRotation >= 360) newRotation -= 360;
        
        // Update the rotation control
        document.getElementById('textureRotation').value = Math.round(newRotation);
        
        // Apply the transformation
        this.updateTextureTransform(this.syncCallback);
        
        e.preventDefault();
    }
    
    /**
     * Handle mouse up to end dragging
     */
    handleTextureMouseUp(e) {
        const textureImage = this.selectedPiece?.querySelector('.texture-image');
        
        if (this.isDragging) {
            // Remove dragging class
            if (this.activeTextureImage) {
                this.activeTextureImage.classList.remove('dragging');
            }
            
            this.isDragging = false;
            this.activeTextureImage = null;
            this.dragStartPoint = null;
            this.dragStartOffset = null;
        }
        
        if (this.isResizing) {
            // Remove resizing class
            if (textureImage) {
                textureImage.classList.remove('resizing');
            }
            
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeStartPoint = null;
            this.resizeStartScale = null;
            this.resizeStartDimensions = null;
        }
        
        if (this.isRotating) {
            // Remove rotating class
            if (textureImage) {
                textureImage.classList.remove('rotating');
            }
            
            this.isRotating = false;
            this.rotateStartPoint = null;
            this.rotateStartAngle = null;
            this.rotateStartRotation = null;
            this.rotateCenter = null;
        }
        
        // Update manipulation handles to reflect new position/size/rotation
        this.updateManipulationHandles();
    }
}