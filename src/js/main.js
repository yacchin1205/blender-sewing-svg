import { loadSVGFile, setupFileHandlers, scaleSVG, checkUnitsPageConstraints, analyzeSVGUnits } from './svg-processor.js';
import { generatePDF, calculatePageInfo, getGridStrategy } from './pdf-generator.js';
import { calculateUnitPlacement, createPlacedUnitsSVG } from './unit-placement.js';
import { updateUI, showError, showProgress, showUnitWarning, hideUnitWarning } from './ui-controller.js';
import { initializeI18n, t } from './i18n.js';
import { applySeamAllowance } from './seam-allowance.js';
import { TextureMapper } from './texture-mapping.js';

// Global state
let currentSVG = null;
let scaledSVG = null;
let currentPageIndex = 0;
let currentPlacement = null;
let textureMapper = null;

// DOM element references
const elements = {
    fileInput: document.getElementById('fileInput'),
    uploadArea: document.getElementById('uploadArea'),
    fileInfo: document.getElementById('fileInfo'),
    settingsSection: document.getElementById('settingsSection'),
    previewSection: document.getElementById('previewSection'),
    actionSection: document.getElementById('actionSection'),
    svgPreview: document.getElementById('svgPreview'),
    pageInfo: document.getElementById('pageInfo'),
    unitWarning: document.getElementById('unitWarning'),
    generateButton: document.getElementById('generatePdf'),
    progressInfo: document.getElementById('progressInfo'),
    
    // Settings elements
    scaleFactor: document.getElementById('scaleFactor'),
    seamAllowance: document.getElementById('seamAllowance'),
    paperSize: document.getElementById('paperSize'),
    orientation: document.getElementById('orientation'),
    
    // Page navigation elements
    pageNavigation: document.getElementById('pageNavigation'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageIndicator: document.getElementById('pageIndicator'),
    
    // Texture mapping elements
    textureImageInput: document.getElementById('textureImageInput'),
    removeTextureBtn: document.getElementById('removeTextureBtn'),
    textureScale: document.getElementById('textureScale'),
    textureRotation: document.getElementById('textureRotation'),
    textureOffsetX: document.getElementById('textureOffsetX'),
    textureOffsetY: document.getElementById('textureOffsetY')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
    setupEventListeners();
    setupFileHandlers(elements.uploadArea, elements.fileInput, handleFileSelect);
});

// Setup event listeners
function setupEventListeners() {
    elements.generateButton.addEventListener('click', handleGeneratePDF);
    elements.scaleFactor.addEventListener('change', updatePreview);
    elements.seamAllowance.addEventListener('change', updatePreview);
    elements.paperSize.addEventListener('change', updatePreview);
    elements.orientation.addEventListener('change', updatePreview);
    
    // Page navigation listeners
    elements.prevPageBtn.addEventListener('click', () => navigatePage(-1));
    elements.nextPageBtn.addEventListener('click', () => navigatePage(1));
    
    // Texture mapping listeners
    elements.textureImageInput.addEventListener('change', handleTextureImageUpload);
    elements.removeTextureBtn.addEventListener('click', handleRemoveTexture);
    elements.textureScale.addEventListener('input', handleTextureTransformUpdate);
    elements.textureRotation.addEventListener('input', handleTextureTransformUpdate);
    elements.textureOffsetX.addEventListener('input', handleTextureTransformUpdate);
    elements.textureOffsetY.addEventListener('input', handleTextureTransformUpdate);
}

// Handle file selection
async function handleFileSelect(file) {
    if (!file || !file.name.endsWith('.svg')) {
        showError(t('selectSvgFile'));
        return;
    }
    
    try {
        // Load SVG file
        currentSVG = await loadSVGFile(file);
        
        // Assign IDs to all pattern pieces (g elements) if they don't have one
        assignPatternPieceIds(currentSVG);
        
        // Update UI
        updateUI.fileLoaded(elements, file.name);
        
        // Update preview
        updatePreview();
        
    } catch (error) {
        showError(t('failedToLoad') + ' ' + error.message);
        console.error(error);
    }
}

// Update preview
function updatePreview() {
    if (!currentSVG) return;
    
    const scalePercentage = parseFloat(elements.scaleFactor.value);
    const scaleFactor = scalePercentage / 100; // Convert percentage to scale factor
    const seamAllowance = parseFloat(elements.seamAllowance.value);
    
    // Clone SVG and apply transformations
    let processedSVG = currentSVG.cloneNode(true);
    
    // Apply seam allowance first if specified
    // Adjust seam allowance by scale factor so it becomes the correct size after scaling
    if (seamAllowance > 0) {
        const adjustedSeamAllowance = seamAllowance / scaleFactor;
        const result = applySeamAllowance(processedSVG, adjustedSeamAllowance);
        processedSVG = result.svg;
        
        // Show errors if any
        if (result.errors.length > 0) {
            const errorMessage = result.errors.join('\n');
            showError(errorMessage);
        }
    }
    
    // Then apply scale correction
    scaleSVG(processedSVG, scaleFactor);
    scaledSVG = processedSVG;
    
    // Adjust stroke-width for seam-allowance paths to be scale-independent
    const seamAllowancePaths = scaledSVG.querySelectorAll('path.seam-allowance');
    seamAllowancePaths.forEach(path => {
        // Set stroke-width to a fixed value that looks good regardless of scale
        path.setAttribute('stroke-width', '2');
    });
    
    // Display in preview with placement
    displayPreviewWithPlacement();
    
    // Update page information
    updatePageInfo();
    
    // Initialize texture mapper if not already done
    if (!textureMapper) {
        textureMapper = new TextureMapper();
        // Set sync callback to always update scaledSVG
        textureMapper.syncCallback = (previewPiece) => {
            syncTextureToScaledSVG(previewPiece);
        };
    }
    
    // Initialize texture mapping for the current preview
    const previewSvg = elements.svgPreview.querySelector('svg');
    if (previewSvg) {
        textureMapper.initialize(previewSvg);
    }
}

// Display preview with placement
function displayPreviewWithPlacement() {
    if (!scaledSVG) return;
    
    const settings = {
        paperSize: elements.paperSize.value,
        orientation: elements.orientation.value,
        overlap: 0,
        addMarks: true,
        scaleFactor: parseFloat(elements.scaleFactor.value) / 100,
        seamAllowance: parseFloat(elements.seamAllowance.value),
    };
    
    const gridStrategy = getGridStrategy(settings);
    currentPlacement = calculateUnitPlacement(scaledSVG, gridStrategy);
    
    // Reset to first page
    currentPageIndex = 0;
    
    // Show or hide navigation based on page count
    if (currentPlacement.pages.length > 1) {
        elements.pageNavigation.style.display = 'flex';
        updatePageDisplay();
    } else {
        elements.pageNavigation.style.display = 'none';
        elements.svgPreview.innerHTML = '';
        // For single page or no pages, just show the original scaled SVG
        const previewSvg = scaledSVG.cloneNode(true);
        elements.svgPreview.appendChild(previewSvg);
        
        // Re-initialize texture mapper for the new SVG
        if (textureMapper) {
            // Store texture data before re-initializing
            const textureData = textureMapper.getTextureData();
            textureMapper.initialize(previewSvg);
            // Restore textures if any existed
            if (textureData.length > 0) {
                textureMapper.loadTextureData(textureData);
            }
        }
    }
}

// Navigate between pages
function navigatePage(direction) {
    if (!currentPlacement || currentPlacement.pages.length <= 1) return;
    
    const newIndex = currentPageIndex + direction;
    if (newIndex >= 0 && newIndex < currentPlacement.pages.length) {
        currentPageIndex = newIndex;
        updatePageDisplay();
    }
}

// Update page display
function updatePageDisplay() {
    if (!currentPlacement || !scaledSVG) return;
    
    const settings = {
        paperSize: elements.paperSize.value,
        orientation: elements.orientation.value,
        overlap: 0,
        addMarks: true,
        scaleFactor: parseFloat(elements.scaleFactor.value) / 100,
        seamAllowance: parseFloat(elements.seamAllowance.value),
    };
    
    const gridStrategy = getGridStrategy(settings);
    const currentPage = currentPlacement.pages[currentPageIndex];
    
    // Clear and update preview
    elements.svgPreview.innerHTML = '';
    const previewSVG = createPlacedUnitsSVG(scaledSVG, currentPage, gridStrategy);
    elements.svgPreview.appendChild(previewSVG);
    
    // Re-initialize texture mapper for the new page
    if (textureMapper) {
        // Store texture data before re-initializing
        const textureData = textureMapper.getTextureData();
        textureMapper.initialize(previewSVG);
        // Restore textures if any existed
        if (textureData.length > 0) {
            textureMapper.loadTextureData(textureData);
        }
    }
    
    // Update navigation controls
    elements.pageIndicator.textContent = `ページ ${currentPageIndex + 1} / ${currentPlacement.pages.length}`;
    elements.prevPageBtn.disabled = currentPageIndex === 0;
    elements.nextPageBtn.disabled = currentPageIndex === currentPlacement.pages.length - 1;
}

// Update page information
function updatePageInfo() {
    if (!scaledSVG) return;
    
    const settings = {
        paperSize: elements.paperSize.value,
        orientation: elements.orientation.value,
        overlap: 0,        // Fixed to 0 (no margin)
        addMarks: true,    // Fixed to true
        scaleFactor: parseFloat(elements.scaleFactor.value) / 100,
        seamAllowance: parseFloat(elements.seamAllowance.value),
    };
    
    // Calculate page info - use scaledSVG which has seam allowance applied
    const pageInfo = calculatePageInfo(scaledSVG, settings);
    if (pageInfo) {
        let infoHtml = `
            ${t('sizeLabel')} ${pageInfo.width}mm × ${pageInfo.height}mm<br>
            ${t('pagesLabel')} ${pageInfo.pageCount} ${t('pagesUnit')}
        `;
        
        // Add unit placement info if multiple pages
        if (pageInfo.pageCount > 1) {
            const units = analyzeSVGUnits(scaledSVG);
            if (units.length > 0) {
                infoHtml += `<br>${t('unitsLabel') || 'Pattern pieces:'} ${units.length}`;
            }
        }
        
        elements.pageInfo.innerHTML = infoHtml;
    }
    
    // Check unit constraints using the already scaled SVG
    const constraintCheck = checkUnitsPageConstraints(scaledSVG, settings);
    if (constraintCheck.isValid) {
        hideUnitWarning(elements);
        elements.generateButton.disabled = false;
    } else {
        showUnitWarning(elements, constraintCheck, t);
        elements.generateButton.disabled = true;
    }
}


// Handle PDF generation
async function handleGeneratePDF() {
    if (!scaledSVG) {
        showError(t('noSvgLoaded'));
        return;
    }
    
    try {
        elements.generateButton.disabled = true;
        showProgress(elements.progressInfo, t('generatingPdf'));
        
        const settings = {
            paperSize: elements.paperSize.value,
            orientation: elements.orientation.value,
            overlap: 0,        // Fixed to 0 (no margin)
            addMarks: true,    // Fixed to true
            scaleFactor: parseFloat(elements.scaleFactor.value) / 100,
            seamAllowance: parseFloat(elements.seamAllowance.value),
            };
        
        // Generate PDF - use scaledSVG which already has seam allowance applied
        await generatePDF(scaledSVG, settings);
        
        showProgress(elements.progressInfo, t('pdfGenerated'), 'success');
        
    } catch (error) {
        showError(t('failedToGenerate') + ' ' + error.message);
        console.error(error);
    } finally {
        elements.generateButton.disabled = false;
        setTimeout(() => {
            elements.progressInfo.classList.remove('show');
        }, 3000);
    }
}

// Handle texture image upload
async function handleTextureImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !textureMapper) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Apply texture to selected piece (will call syncCallback automatically)
            textureMapper.applyTexture(e.target.result, img.width, img.height);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
}

// Handle texture removal
function handleRemoveTexture() {
    if (textureMapper && textureMapper.selectedPiece) {
        // removeTexture will call syncCallback automatically
        textureMapper.removeTexture();
    }
}

// Handle texture transform updates
function handleTextureTransformUpdate() {
    if (textureMapper) {
        // updateTextureTransform will call syncCallback automatically
        textureMapper.updateTextureTransform();
    }
}

// Sync texture from preview to scaledSVG
function syncTextureToScaledSVG(previewPiece) {
    if (!previewPiece) {
        throw new Error('Preview piece is required');
    }
    if (!scaledSVG) {
        throw new Error('Scaled SVG is not available');
    }
    
    const pieceId = previewPiece.getAttribute('id');
    if (!pieceId) {
        throw new Error('Preview piece must have an ID');
    }
    
    // Find corresponding piece in scaledSVG
    const sourcePiece = scaledSVG.querySelector(`#${pieceId}`);
    if (!sourcePiece) {
        throw new Error(`Source piece with ID ${pieceId} not found in scaled SVG`);
    }
    
    // Remove existing texture image
    const existingImage = sourcePiece.querySelector('.texture-image');
    if (existingImage) {
        existingImage.remove();
    }
    
    // Copy texture image from preview
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
    
    // Also ensure clip path exists in scaledSVG
    const clipId = `clip-${pieceId}`;
    let clipPath = scaledSVG.querySelector(`#${clipId}`);
    if (!clipPath && previewImage) {
        // Copy clip path from preview SVG
        const previewClipPath = previewPiece.ownerDocument.querySelector(`#${clipId}`);
        if (previewClipPath) {
            let defs = scaledSVG.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                scaledSVG.insertBefore(defs, scaledSVG.firstChild);
            }
            defs.appendChild(previewClipPath.cloneNode(true));
        }
    }
}

// Assign IDs to pattern pieces
function assignPatternPieceIds(svgElement) {
    // Find all g elements that contain seam paths
    const groups = svgElement.querySelectorAll('g');
    let pieceIndex = 0;
    
    groups.forEach(group => {
        // Check if this group contains a seam path
        const seamPath = group.querySelector('.seam');
        if (!seamPath) return;
        
        // If the group doesn't have an ID, assign one
        if (!group.getAttribute('id')) {
            pieceIndex++;
            group.setAttribute('id', `pattern-piece-${pieceIndex}`);
        }
    });
}