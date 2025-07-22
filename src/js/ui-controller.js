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

// Show unit constraint warning
export function showUnitWarning(elements, constraintCheck, t) {
    const { violations, pageConstraints } = constraintCheck;
    
    let violationList = '';
    violations.forEach((violation, index) => {
        const unitName = violation.unitClass || violation.unitId || `Unit ${violation.unitIndex + 1}`;
        const sizeInfo = t('unitSizeFormat')
            .replace('{width}', violation.unitSize.width.toFixed(1))
            .replace('{height}', violation.unitSize.height.toFixed(1));
        
        let exceedsInfo = '';
        if (violation.exceedsWidth && violation.exceedsHeight) {
            exceedsInfo = t('unitExceedsBoth');
        } else if (violation.exceedsWidth) {
            exceedsInfo = t('unitExceedsWidth');
        } else if (violation.exceedsHeight) {
            exceedsInfo = t('unitExceedsHeight');
        }
        
        violationList += `
            <li>
                ${unitName}
                <div class="violation-details">
                    ${sizeInfo}<br>
                    ${exceedsInfo}
                </div>
            </li>
        `;
    });
    
    const pageSizeInfo = t('pageSizeFormat')
        .replace('{width}', pageConstraints.printableWidth.toFixed(0))
        .replace('{height}', pageConstraints.printableHeight.toFixed(0));
    
    elements.unitWarning.innerHTML = `
        <h4>${t('unitConstraintWarning')}</h4>
        <p>${t('unitTooLarge')}</p>
        <ul>${violationList}</ul>
        <div class="violation-details">${pageSizeInfo}</div>
        <div class="suggestion">${t('unitSuggestion')}</div>
    `;
    
    elements.unitWarning.classList.add('show');
}

// Hide unit constraint warning
export function hideUnitWarning(elements) {
    elements.unitWarning.classList.remove('show');
}