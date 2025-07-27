import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTempDir, cleanupTempDir, getImageMagickCommand, execAsync } from './test-helpers.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Seam Allowance Feature', () => {
    test('should apply seam allowance to pattern pieces', async ({ page }) => {
        const tempDir = createTempDir();
        
        try {
            await page.goto('/');
            
            // Upload test SVG with seam paths
            const filePath = path.join(__dirname, '../../test-files/seam-allowance-test.svg');
            await page.setInputFiles('#fileInput', filePath);
            
            // Wait for file to be loaded
            await page.waitForSelector('.file-info', { state: 'visible' });
            
            // Set seam allowance to 10mm
            await page.fill('#seamAllowance', '10');
            
            // Set scale to 1 (no scaling)
            await page.fill('#scaleFactor', '1');
            
            // Generate PDF
            const downloadPromise = page.waitForEvent('download');
            await page.click('#generatePdf');
            
            // Wait for download
            const download = await downloadPromise;
            const downloadPath = path.join(tempDir, download.suggestedFilename());
            await download.saveAs(downloadPath);
            
            // Verify PDF was created
            const stats = await fs.stat(downloadPath);
            expect(stats.size).toBeGreaterThan(1000);
            
            // Convert PDF to image for visual verification
            const { convert } = await getImageMagickCommand();
            const imagePath = downloadPath.replace('.pdf', '.png');
            await execAsync(`${convert} "${downloadPath}" -density 150 -background white -alpha remove "${imagePath}"`);
            
            // Check that image was created
            const imageStats = await fs.stat(imagePath);
            expect(imageStats.size).toBeGreaterThan(1000);
            
            console.log('Seam allowance PDF generated successfully');
        } finally {
            cleanupTempDir(tempDir);
        }
    });
    
    test('should show seam allowance field with default value', async ({ page }) => {
        await page.goto('/');
        
        // First load a file to show the settings section
        const filePath = path.join(__dirname, '../../test-files/seam-allowance-test.svg');
        await page.setInputFiles('#fileInput', filePath);
        
        // Wait for settings section to be visible
        await page.waitForSelector('#settingsSection', { state: 'visible' });
        
        // Check that seam allowance field exists
        const seamAllowanceInput = page.locator('#seamAllowance');
        await expect(seamAllowanceInput).toBeVisible();
        
        // Check default value is 5
        const value = await seamAllowanceInput.inputValue();
        expect(value).toBe('5');
        
        // Check unit label for seam allowance field
        const unitLabel = page.locator('#settingsSection').getByText('mm', { exact: true }).first();
        await expect(unitLabel).toBeVisible();
    });
    
    test('should update preview when seam allowance changes', async ({ page }) => {
        await page.goto('/');
        
        // Upload test SVG
        const filePath = path.join(__dirname, '../../test-files/seam-allowance-test.svg');
        await page.setInputFiles('#fileInput', filePath);
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Get initial preview state
        await page.waitForTimeout(500);
        
        // Check that initial preview has seam-allowance with default 5mm
        const initialPreview = await page.locator('#svgPreview').innerHTML();
        expect(initialPreview).toContain('seam-allowance');
        
        // Count initial seam-allowance paths
        const initialSeamPaths = (initialPreview.match(/class="seam-allowance"/g) || []).length;
        expect(initialSeamPaths).toBeGreaterThan(0);
        
        // Change seam allowance to 0 to see clear difference
        await page.fill('#seamAllowance', '0');
        
        // Wait for preview update and trigger change event
        await page.locator('#seamAllowance').press('Enter');
        await page.waitForTimeout(1500);
        
        // Get updated preview after seam allowance is set to 0
        const zeroAllowancePreview = await page.locator('#svgPreview').innerHTML();
        
        // Should NOT contain seam-allowance paths when allowance is 0
        expect(zeroAllowancePreview).not.toContain('seam-allowance');
        
        // Now set to 15mm
        await page.fill('#seamAllowance', '15');
        await page.locator('#seamAllowance').press('Enter');
        await page.waitForTimeout(1500);
        const updatedPreview = await page.locator('#svgPreview').innerHTML();
        
        // Should contain seam-allowance paths again
        expect(updatedPreview).toContain('seam-allowance');
        
        // Count seam-allowance paths after 15mm setting
        const updatedSeamPaths = (updatedPreview.match(/class="seam-allowance"/g) || []).length;
        expect(updatedSeamPaths).toBeGreaterThan(0);
        
        // The preview should have changed from the zero state
        expect(updatedPreview).not.toBe(zeroAllowancePreview);
    });
    
    test('should handle zero seam allowance', async ({ page }) => {
        const tempDir = createTempDir();
        
        try {
            await page.goto('/');
            
            // Upload test SVG
            const filePath = path.join(__dirname, '../../test-files/seam-allowance-test.svg');
            await page.setInputFiles('#fileInput', filePath);
            
            // Wait for file to be loaded
            await page.waitForSelector('.file-info', { state: 'visible' });
            
            // Set seam allowance to 0
            await page.fill('#seamAllowance', '0');
            
            // Generate PDF
            const downloadPromise = page.waitForEvent('download');
            await page.click('#generatePdf');
            
            // Wait for download
            const download = await downloadPromise;
            const downloadPath = path.join(tempDir, download.suggestedFilename());
            await download.saveAs(downloadPath);
            
            // Verify PDF was created
            const stats = await fs.stat(downloadPath);
            expect(stats.size).toBeGreaterThan(1000);
            
            // When seam allowance is 0, the PDF should still generate successfully
            console.log('Zero seam allowance PDF generated successfully');
        } finally {
            cleanupTempDir(tempDir);
        }
    });
    
    test('should apply seam allowance with scaling', async ({ page }) => {
        const tempDir = createTempDir();
        
        try {
            await page.goto('/');
            
            // Upload test SVG
            const filePath = path.join(__dirname, '../../test-files/seam-allowance-test.svg');
            await page.setInputFiles('#fileInput', filePath);
            
            // Wait for file to be loaded
            await page.waitForSelector('.file-info', { state: 'visible' });
            
            // Set seam allowance
            await page.fill('#seamAllowance', '7');
            
            // Set scale factor
            await page.fill('#scaleFactor', '0.5');
            
            // Generate PDF
            const downloadPromise = page.waitForEvent('download');
            await page.click('#generatePdf');
            
            // Wait for download
            const download = await downloadPromise;
            const downloadPath = path.join(tempDir, download.suggestedFilename());
            await download.saveAs(downloadPath);
            
            // Verify PDF was created
            const stats = await fs.stat(downloadPath);
            expect(stats.size).toBeGreaterThan(1000);
            
            console.log('Seam allowance with scaling PDF generated successfully');
        } finally {
            cleanupTempDir(tempDir);
        }
    });
});