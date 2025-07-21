import { t } from './i18n.js';

// UI update functions
export const updateUI = {
    fileLoaded: (elements, fileName) => {
        elements.fileInfo.innerHTML = `<strong>${t('loadedFile')}</strong> ${fileName}`;
        elements.fileInfo.classList.add('show');
        elements.settingsSection.style.display = 'block';
        elements.previewSection.style.display = 'block';
        elements.actionSection.style.display = 'block';
    },
    
    reset: (elements) => {
        elements.fileInfo.classList.remove('show');
        elements.settingsSection.style.display = 'none';
        elements.previewSection.style.display = 'none';
        elements.actionSection.style.display = 'none';
        elements.svgPreview.innerHTML = '';
        elements.pageInfo.innerHTML = '';
    }
};

// Show error message
export function showError(message) {
    alert(message);
}

// Show progress
export function showProgress(element, message, type = 'info') {
    element.innerHTML = message;
    element.classList.add('show');
    
    if (type === 'success') {
        element.style.backgroundColor = '#c6f6d5';
    } else if (type === 'error') {
        element.style.backgroundColor = '#fed7d7';
    } else {
        element.style.backgroundColor = '#bee3f8';
    }
}