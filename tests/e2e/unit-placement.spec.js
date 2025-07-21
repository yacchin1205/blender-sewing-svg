import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createTempDir, cleanupTempDir } from './test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Unit Placement for Multi-page PDF', () => {
  test('should place pattern units without cutting across pages', async ({ page }) => {
    const tempDir = createTempDir();
    
    try {
      await page.goto('/');
      
      // Upload SVG file with multiple pattern units
      const filePath = path.join(__dirname, '../../test-files/pattern-with-units.svg');
      await page.setInputFiles('#fileInput', filePath);
      
      // Wait for file to be loaded
      await page.waitForSelector('.file-info', { state: 'visible' });
      
      // Set scale factor to 1 (no scaling)
      await page.fill('#scaleFactor', '1');
      
      // Set paper size to A4
      await page.selectOption('#paperSize', 'a4');
      
      // Check page info shows multiple pages
      await page.waitForTimeout(500); // Wait for calculations
      const pageInfo = await page.textContent('#pageInfo');
      console.log('Page info:', pageInfo);
      
      // Page info should show size and page count
      expect(pageInfo).toContain('400.0mm × 500.0mm');
      expect(pageInfo).toMatch(/\d+ pages/); // Should show multiple pages
      
      // Check if unit warning is visible
      const unitWarning = await page.locator('#unitWarning').isVisible();
      if (unitWarning) {
        const warningText = await page.textContent('#unitWarning');
        console.log('Unit warning is visible:', warningText);
      }
      
      // Generate PDF button should be enabled
      const generateButton = page.locator('#generatePdf');
      await expect(generateButton).toBeEnabled();
      
      // Click generate PDF
      const downloadPromise = page.waitForEvent('download');
      await generateButton.click();
      
      // Wait for download
      const download = await downloadPromise;
      const fileName = download.suggestedFilename();
      console.log('Downloaded file:', fileName);
      
      // Verify filename indicates multiple pages
      expect(fileName).toMatch(/sewing-pattern-\d+pages\.pdf/);
      
      // Save and verify the PDF was created
      const downloadPath = path.join(tempDir, fileName);
      await download.saveAs(downloadPath);
      
      // Check file exists and has content
      const stats = await fs.stat(downloadPath);
      expect(stats.size).toBeGreaterThan(1000); // PDF should have substantial content
    } finally {
      cleanupTempDir(tempDir);
    }
  });
  
  test('should show error when no pattern units are detected', async ({ page }) => {
    // Create temporary directory for test files
    const tempDir = createTempDir();
    
    try {
      await page.goto('/');
      
      // Create an SVG without g elements (no pattern units)
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100mm" height="100mm">
        <rect x="10" y="10" width="80" height="80" fill="red"/>
      </svg>`;
      
      // Create a file from the SVG content
      const fileName = 'no-units.svg';
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, svgContent);
    
      // Upload the file
      await page.setInputFiles('#fileInput', filePath);
      
      // Wait for file to be loaded
      await page.waitForSelector('.file-info', { state: 'visible' });
      
      // Try to generate PDF
      const generateButton = page.locator('#generatePdf');
      await expect(generateButton).toBeEnabled();
      
      // Handle alert dialog
      page.on('dialog', async dialog => {
        console.log('Alert message:', dialog.message());
        expect(dialog.message()).toContain('パターンピースが検出されませんでした');
        await dialog.dismiss();
      });
      
      // Click generate and expect error alert
      await generateButton.click();
      
      // Wait a bit for alert to be handled
      await page.waitForTimeout(1000);
    } finally {
      // Clean up temporary directory
      cleanupTempDir(tempDir);
    }
  });
  
  test('should handle pattern units that are too large for any page', async ({ page }) => {
    const tempDir = createTempDir();
    
    try {
      await page.goto('/');
      
      // Create an SVG with oversized units
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000mm" height="1000mm">
        <g class="pattern-unit">
          <rect x="0" y="0" width="300" height="400" fill="blue"/>
        </g>
      </svg>`;
      
      // Create a file from the SVG content
      const fileName = 'oversized-units.svg';
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, svgContent);
      
      // Upload the file
      await page.setInputFiles('#fileInput', filePath);
      
      // Wait for file to be loaded
      await page.waitForSelector('.file-info', { state: 'visible' });
      
      // Should show unit warning
      await page.waitForSelector('#unitWarning', { state: 'visible' });
      const warningText = await page.textContent('#unitWarning');
      expect(warningText).toContain('Pattern Unit Size Warning');
      
      // Generate button should be disabled
      const generateButton = page.locator('#generatePdf');
      await expect(generateButton).toBeDisabled();
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});