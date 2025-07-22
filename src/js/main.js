import { loadSVGFile, setupFileHandlers, scaleSVG, checkUnitsPageConstraints, analyzeSVGUnits } from './svg-processor.js';
import { generatePDF, calculatePageInfo, getGridStrategy } from './pdf-generator.js';
import { calculateUnitPlacement, createPlacedUnitsSVG } from './unit-placement.js';
import { updateUI, showError, showProgress, showUnitWarning, hideUnitWarning } from './ui-controller.js';
import { initializeI18n, t } from './i18n.js';
import { applySeamAllowance } from './seam-allowance.js';

// Global state
let currentSVG = null;
let scaledSVG = null;
let currentPageIndex = 0;
let currentPlacement = null;

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
    pageIndicator: document.getElementById('pageIndicator')
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
    
    const scaleFactor = parseFloat(elements.scaleFactor.value);
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
}

// Display preview with placement
function displayPreviewWithPlacement() {
    if (!scaledSVG) return;
    
    const settings = {
        paperSize: elements.paperSize.value,
        orientation: elements.orientation.value,
        splitPages: true,
        overlap: 0,
        addMarks: true,
        scaleFactor: parseFloat(elements.scaleFactor.value),
        seamAllowance: parseFloat(elements.seamAllowance.value)
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
        elements.svgPreview.appendChild(scaledSVG.cloneNode(true));
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
        splitPages: true,
        overlap: 0,
        addMarks: true,
        scaleFactor: parseFloat(elements.scaleFactor.value),
        seamAllowance: parseFloat(elements.seamAllowance.value)
    };
    
    const gridStrategy = getGridStrategy(settings);
    const currentPage = currentPlacement.pages[currentPageIndex];
    
    // Clear and update preview
    elements.svgPreview.innerHTML = '';
    const previewSVG = createPlacedUnitsSVG(scaledSVG, currentPage, gridStrategy);
    elements.svgPreview.appendChild(previewSVG);
    
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
        splitPages: true,  // Fixed to true
        overlap: 0,        // Fixed to 0 (no margin)
        addMarks: true,    // Fixed to true
        scaleFactor: parseFloat(elements.scaleFactor.value),
        seamAllowance: parseFloat(elements.seamAllowance.value)
    };
    
    // Calculate page info - use scaledSVG which has seam allowance applied
    const pageInfo = calculatePageInfo(scaledSVG, settings);
    if (pageInfo) {
        let infoHtml = `
            ${t('sizeLabel')} ${pageInfo.width}mm × ${pageInfo.height}mm<br>
            ${t('pagesLabel')} ${pageInfo.pageCount} ${t('pagesUnit')}
        `;
        
        // Add unit placement info if multiple pages
        if (settings.splitPages && pageInfo.pageCount > 1) {
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
            splitPages: true,  // Fixed to true
            overlap: 0,        // Fixed to 0 (no margin)
            addMarks: true,    // Fixed to true
            scaleFactor: parseFloat(elements.scaleFactor.value),
            seamAllowance: parseFloat(elements.seamAllowance.value)
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