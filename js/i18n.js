// Internationalization (i18n) module
const translations = {
    en: {
        // Header
        title: 'Sewing SVG to PDF Converter',
        subtitle: 'Convert SVG files from Blender Seams to Sewing Pattern plugin to printable PDFs',
        
        // Upload section
        uploadText: 'Drag & drop SVG file<br>or',
        selectFileButton: 'Select File',
        loadedFile: 'Loaded file:',
        
        // Settings
        settingsTitle: 'Settings',
        scaleCorrection: 'Scale Correction',
        scaleFactor: 'Scale factor:',
        scaleHelp: 'Default: 0.001 (1/1000)',
        paperSettings: 'Paper Settings',
        paperSize: 'Paper size:',
        orientation: 'Orientation:',
        portrait: 'Portrait',
        landscape: 'Landscape',
        printOptions: 'Print Options',
        splitPages: 'Split into multiple pages',
        overlapMargin: 'Overlap margin (mm):',
        addMarks: 'Add alignment marks',
        
        // Paper sizes
        paperSizes: {
            a4: 'A4 (210×297mm)',
            a3: 'A3 (297×420mm)',
            b4: 'B4 (257×364mm)',
            b5: 'B5 (182×257mm)'
        },
        
        // Preview
        previewTitle: 'Preview',
        sizeLabel: 'Size:',
        pagesLabel: 'Pages:',
        pagesUnit: 'pages',
        
        // Action
        generateButton: 'Generate PDF',
        
        // Messages
        selectSvgFile: 'Please select an SVG file',
        failedToLoad: 'Failed to load file:',
        noSvgLoaded: 'No SVG file loaded',
        generatingPdf: 'Generating PDF...',
        pdfGenerated: 'PDF generated successfully!',
        failedToGenerate: 'Failed to generate PDF:',
        
        // Footer
        copyright: '© 2024 Sewing SVG to PDF Converter'
    },
    ja: {
        // Header
        title: 'Sewing SVG to PDF Converter',
        subtitle: 'Blender Seams to Sewing Pattern プラグインのSVGファイルを印刷可能なPDFに変換します',
        
        // Upload section
        uploadText: 'SVGファイルをドラッグ&ドロップ<br>または',
        selectFileButton: 'ファイルを選択',
        loadedFile: '読み込みファイル:',
        
        // Settings
        settingsTitle: '設定',
        scaleCorrection: 'スケール補正',
        scaleFactor: 'スケール係数:',
        scaleHelp: 'デフォルト: 0.001 (1/1000)',
        paperSettings: '用紙設定',
        paperSize: '用紙サイズ:',
        orientation: '向き:',
        portrait: '縦',
        landscape: '横',
        printOptions: '印刷オプション',
        splitPages: '複数ページに分割',
        overlapMargin: 'のりしろ (mm):',
        addMarks: '位置合わせマークを追加',
        
        // Paper sizes
        paperSizes: {
            a4: 'A4 (210×297mm)',
            a3: 'A3 (297×420mm)',
            b4: 'B4 (257×364mm)',
            b5: 'B5 (182×257mm)'
        },
        
        // Preview
        previewTitle: 'プレビュー',
        sizeLabel: 'サイズ:',
        pagesLabel: 'ページ数:',
        pagesUnit: 'ページ',
        
        // Action
        generateButton: 'PDFを生成',
        
        // Messages
        selectSvgFile: 'SVGファイルを選択してください',
        failedToLoad: 'ファイルの読み込みに失敗しました:',
        noSvgLoaded: 'SVGファイルが読み込まれていません',
        generatingPdf: 'PDFを生成中...',
        pdfGenerated: 'PDFが生成されました！',
        failedToGenerate: 'PDF生成に失敗しました:',
        
        // Footer
        copyright: '© 2024 Sewing SVG to PDF Converter'
    }
};

// Detect browser language
function detectLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    // Check if Japanese
    if (browserLang.startsWith('ja')) {
        return 'ja';
    }
    // Default to English
    return 'en';
}

// Current language
let currentLanguage = detectLanguage();

// Get translation
export function t(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    
    for (const k of keys) {
        if (value && typeof value === 'object') {
            value = value[k];
        } else {
            break;
        }
    }
    
    // Fallback to English if translation not found
    if (value === undefined && currentLanguage !== 'en') {
        value = translations.en;
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                break;
            }
        }
    }
    
    return value || key;
}

// Get current language
export function getCurrentLanguage() {
    return currentLanguage;
}

// Set language
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        updatePageTexts();
    }
}

// Update all page texts
export function updatePageTexts() {
    // Header
    const title = document.querySelector('h1');
    if (title) title.textContent = t('title');
    
    const subtitle = document.querySelector('header p');
    if (subtitle) subtitle.textContent = t('subtitle');
    
    // Upload section
    const uploadText = document.querySelector('.upload-area p');
    if (uploadText) uploadText.innerHTML = t('uploadText');
    
    const selectFileButton = document.querySelector('.file-label');
    if (selectFileButton) selectFileButton.textContent = t('selectFileButton');
    
    // Settings
    const settingsTitle = document.querySelector('.settings-section h2');
    if (settingsTitle) settingsTitle.textContent = t('settingsTitle');
    
    // Update all labels and options
    updateLabel('scaleFactor', t('scaleFactor'));
    updateLabel('paperSize', t('paperSize'));
    updateLabel('orientation', t('orientation'));
    updateLabel('splitPages', t('splitPages'));
    updateLabel('overlap', t('overlapMargin'));
    updateLabel('addMarks', t('addMarks'));
    
    // Update setting group headings
    const settingGroups = document.querySelectorAll('.setting-group h3');
    settingGroups[0].textContent = t('scaleCorrection');
    settingGroups[1].textContent = t('paperSettings');
    settingGroups[2].textContent = t('printOptions');
    
    // Update help text
    const helpText = document.querySelector('.help-text');
    if (helpText) helpText.textContent = t('scaleHelp');
    
    // Update paper size options
    const paperSizeSelect = document.getElementById('paperSize');
    if (paperSizeSelect) {
        const options = paperSizeSelect.querySelectorAll('option');
        options.forEach(option => {
            const paperKey = option.value;
            option.textContent = t(`paperSizes.${paperKey}`);
        });
    }
    
    // Update orientation options
    const orientationSelect = document.getElementById('orientation');
    if (orientationSelect) {
        const options = orientationSelect.querySelectorAll('option');
        options[0].textContent = t('portrait');
        options[1].textContent = t('landscape');
    }
    
    // Preview section
    const previewTitle = document.querySelector('.preview-section h2');
    if (previewTitle) previewTitle.textContent = t('previewTitle');
    
    // Generate button
    const generateButton = document.getElementById('generatePdf');
    if (generateButton) generateButton.textContent = t('generateButton');
    
    // Footer
    const footer = document.querySelector('footer p');
    if (footer) footer.textContent = t('copyright');
}

// Helper function to update label
function updateLabel(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        const label = document.querySelector(`label[for="${elementId}"]`);
        if (label) label.textContent = text;
    }
}

// Initialize i18n
export function initializeI18n() {
    updatePageTexts();
}