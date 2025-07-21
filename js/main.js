import { loadSVGFile, setupFileHandlers, scaleSVG } from './svg-processor.js';
import { generatePDF, calculatePageInfo } from './pdf-generator.js';
import { updateUI, showError, showProgress } from './ui-controller.js';
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
    generateButton: document.getElementById('generatePdf'),
    progressInfo: document.getElementById('progressInfo'),
    
    // Settings elements
    scaleFactor: document.getElementById('scaleFactor'),
    paperSize: document.getElementById('paperSize'),
    orientation: document.getElementById('orientation'),
    splitPages: document.getElementById('splitPages'),
    overlap: document.getElementById('overlap'),
    addMarks: document.getElementById('addMarks'),
    overlapGroup: document.getElementById('overlapGroup')
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
    elements.splitPages.addEventListener('change', handleSplitPagesChange);
    elements.overlap.addEventListener('change', updatePreview);
    elements.addMarks.addEventListener('change', updatePreview);
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
        splitPages: elements.splitPages.checked,
        overlap: parseInt(elements.overlap.value),
        scaleFactor: parseFloat(elements.scaleFactor.value)
    };
    
    const pageInfo = calculatePageInfo(currentSVG, settings);
    if (pageInfo) {
        elements.pageInfo.innerHTML = `
            ${t('sizeLabel')} ${pageInfo.width}mm × ${pageInfo.height}mm<br>
            ${t('pagesLabel')} ${pageInfo.pageCount} ${t('pagesUnit')}
        `;
    }
}

// Handle split pages checkbox change
function handleSplitPagesChange() {
    elements.overlapGroup.style.display = elements.splitPages.checked ? 'block' : 'none';
    updatePreview();
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
            splitPages: elements.splitPages.checked,
            overlap: parseInt(elements.overlap.value),
            addMarks: elements.addMarks.checked,
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

// Get grid strategy based on settings
function getGridStrategy() {
    const paperSizes = {
        a4: { width: 210, height: 297 },
        a3: { width: 297, height: 420 },
        b4: { width: 257, height: 364 },
        b5: { width: 182, height: 257 }
    };
    
    const size = paperSizes[elements.paperSize.value];
    const isLandscape = elements.orientation.value === 'landscape';
    
    const pageWidth = isLandscape ? size.height : size.width;
    const pageHeight = isLandscape ? size.width : size.height;
    const margin = 10;
    const overlap = parseInt(elements.overlap.value);
    
    return {
        pageWidth,
        pageHeight,
        margin,
        overlap,
        printableWidth: pageWidth - margin * 2,
        printableHeight: pageHeight - margin * 2,
        effectiveWidth: pageWidth - margin * 2 - overlap,
        effectiveHeight: pageHeight - margin * 2 - overlap
    };
}