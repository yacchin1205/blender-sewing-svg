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
        seamAllowanceSettings: 'Seam Allowance',
        seamAllowance: 'Seam allowance width:',
        seamAllowanceUnit: 'mm',
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
        
        // Unit constraint warnings
        unitConstraintWarning: 'Pattern Unit Size Warning',
        unitTooLarge: 'The following pattern units exceed the printable page size:',
        unitExceedsWidth: 'Width exceeds page limit',
        unitExceedsHeight: 'Height exceeds page limit',
        unitExceedsBoth: 'Width and height exceed page limits',
        unitSizeFormat: 'Unit size: {width}mm × {height}mm',
        pageSizeFormat: 'Max page size: {width}mm × {height}mm',
        unitSuggestion: 'Try using a larger paper size (A3 instead of A4) or reduce the scale factor to make the units smaller.',
        
        // Seam allowance errors
        seamAllowanceError: 'Seam allowance error ({pathId}): {error}',
        pathHasTooFewPoints: 'Path has too few points for offset: {points}',
        offsetAlgorithmFailed: 'Offset algorithm returned no polygons',
        
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
        seamAllowanceSettings: '縫いしろ設定',
        seamAllowance: '縫いしろ幅:',
        seamAllowanceUnit: 'mm',
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
        
        // Unit constraint warnings
        unitConstraintWarning: '型紙ユニットサイズ警告',
        unitTooLarge: '以下の型紙ユニットが印刷可能ページサイズを超えています:',
        unitExceedsWidth: '幅がページ制限を超過',
        unitExceedsHeight: '高さがページ制限を超過',
        unitExceedsBoth: '幅と高さがページ制限を超過',
        unitSizeFormat: 'ユニットサイズ: {width}mm × {height}mm',
        pageSizeFormat: '最大ページサイズ: {width}mm × {height}mm',
        unitSuggestion: 'より大きな用紙サイズ（A4からA3など）を使用するか、スケール係数を小さくしてユニットを縮小してください。',
        
        // Seam allowance errors
        seamAllowanceError: '縫いしろ作成エラー ({pathId}): {error}',
        pathHasTooFewPoints: 'パスのポイント数が少なすぎます: {points}',
        offsetAlgorithmFailed: 'オフセットアルゴリズムがポリゴンを返しませんでした',
        
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
    
    // Update setting group headings
    const settingGroups = document.querySelectorAll('.setting-group h3');
    if (settingGroups[0]) settingGroups[0].textContent = t('scaleCorrection');
    if (settingGroups[1]) settingGroups[1].textContent = t('paperSettings');
    
    // Note: help text removed per user request
    
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