import { loadSVGFile, setupFileHandlers, scaleSVG, checkUnitsPageConstraints, analyzeSVGUnits } from './svg-processor.js';
import { generatePDF, calculatePageInfo } from './pdf-generator.js';
import { calculateUnitPlacement } from './unit-placement.js';
import { updateUI, showError, showProgress, showUnitWarning, hideUnitWarning } from './ui-controller.js';
import { initializeI18n, t } from './i18n.js';

// Global state
let currentSVG = null;
let scaledSVG = null;

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
    paperSize: document.getElementById('paperSize'),
    orientation: document.getElementById('orientation')
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
    elements.paperSize.addEventListener('change', updatePreview);
    elements.orientation.addEventListener('change', updatePreview);
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
    
    // Clone SVG and apply scale correction
    scaledSVG = currentSVG.cloneNode(true);
    scaleSVG(scaledSVG, scaleFactor);
    
    // Display in preview
    elements.svgPreview.innerHTML = '';
    elements.svgPreview.appendChild(scaledSVG);
    
    // Update page information
    updatePageInfo();
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
        scaleFactor: parseFloat(elements.scaleFactor.value)
    };
    
    // Calculate page info
    const pageInfo = calculatePageInfo(currentSVG, settings);
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
            scaleFactor: parseFloat(elements.scaleFactor.value)
        };
        
        // Generate PDF
        await generatePDF(currentSVG, settings);
        
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