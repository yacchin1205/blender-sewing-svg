import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTempDir, cleanupTempDir } from './test-helpers.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Example.svg Seam Allowance', () => {
    test('Without seam allowance - should fit on page', async ({ page }) => {
        const tempDir = createTempDir();
        
        try {
            await page.goto('/');
            
            // Upload example.svg
            const filePath = path.join(__dirname, '../../resources/example.svg');
            await page.setInputFiles('#fileInput', filePath);
            
            // Wait for file to be loaded
            await page.waitForSelector('.file-info', { state: 'visible' });
            
            // Set seam allowance to 0 (no seam allowance)
            await page.fill('#seamAllowance', '0');
            
            // Set scale to 0.01% (very small scale for large example.svg)
            await page.fill('#scaleFactor', '0.01');
            
            // Trigger change event to ensure preview updates
            await page.locator('#scaleFactor').press('Enter');
            
            // Wait for preview update
            await page.waitForTimeout(2000);
            
            // Check that no seam-allowance paths are created
            const previewHTML = await page.locator('#svgPreview').innerHTML();
            expect(previewHTML).not.toContain('seam-allowance');
            
            // Generate PDF
            const downloadPromise = page.waitForEvent('download');
            await page.click('#generatePdf');
            
            // Wait for download
            const download = await downloadPromise;
            const downloadPath = path.join(tempDir, download.suggestedFilename());
            await download.saveAs(downloadPath);
            
            // Verify PDF was created
            const stats = await fs.stat(downloadPath);
            expect(stats.size).toBeGreaterThan(10000); // example.svg generates larger PDFs
            
            // Check page count - should fit on reasonable number of pages
            const pdfContent = await fs.readFile(downloadPath, 'utf-8');
            const pageCount = (pdfContent.match(/\/Type\s*\/Page[^s]/g) || []).length;
            console.log(`PDF has ${pageCount} pages without seam allowance`);
            
            // Without seam allowance, it should fit on relatively few pages
            expect(pageCount).toBeLessThanOrEqual(10);
            
        } finally {
            cleanupTempDir(tempDir);
        }
    });
    
    test('With seam allowance - may exceed page boundaries', async ({ page }) => {
        await page.goto('/');
        
        // Upload example.svg
        const filePath = path.join(__dirname, '../../resources/example.svg');
        await page.setInputFiles('#fileInput', filePath);
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set seam allowance to 5mm (default)
        const seamAllowanceInput = page.locator('#seamAllowance');
        await expect(seamAllowanceInput).toHaveValue('5');
        
        // Set scale to 0.1% (typical for example.svg)
        await page.fill('#scaleFactor', '0.1');
        
        // Wait for preview update
        await page.waitForTimeout(1000);
        
        // Check that preview contains seam-allowance paths
        const previewHTML = await page.locator('#svgPreview').innerHTML();
        expect(previewHTML).toContain('seam-allowance');
        
        // Count seam-allowance paths
        const seamAllowanceCount = (previewHTML.match(/class="seam-allowance"/g) || []).length;
        expect(seamAllowanceCount).toBeGreaterThan(0);
        
        console.log(`Found ${seamAllowanceCount} seam allowance paths`);
        
        // Note: We don't generate PDF here because the seam allowance 
        // may cause units to exceed page boundaries, which would prevent PDF generation
        // This is expected behavior for complex patterns with seam allowance
    });
    
    test('Scale adjustment should affect seam allowance visibility', async ({ page }) => {
        await page.goto('/');
        
        // Upload example.svg
        const filePath = path.join(__dirname, '../../resources/example.svg');
        await page.setInputFiles('#fileInput', filePath);
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Test with larger scale (less reduction)
        await page.fill('#scaleFactor', '1');
        
        // Set seam allowance
        await page.fill('#seamAllowance', '5');
        
        // Wait for preview update
        await page.waitForTimeout(1000);
        
        // With larger scale, seam allowance effect should be more visible
        const previewHTML = await page.locator('#svgPreview').innerHTML();
        expect(previewHTML).toContain('seam-allowance');
        
        // Test with very small scale
        await page.fill('#scaleFactor', '0.01');
        await page.waitForTimeout(1000);
        
        // With very small scale, seam allowance might be extremely large relative to pattern
        const updatedHTML = await page.locator('#svgPreview').innerHTML();
        expect(updatedHTML).toContain('seam-allowance');
    });
    
    test('Seam allowance errors should be displayed in UI', async ({ page }) => {
        await page.goto('/');
        
        // Create an SVG with a problematic path (too few points)
        const problematicSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <g>
                    <path class="seam" d="M 10,10 L 20,10 Z"/>
                    <path class="seam" d="M 30,30 L 60,30 L 60,60 L 30,60 Z"/>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'test.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(problematicSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set seam allowance
        await page.fill('#seamAllowance', '10');
        
        // Set up alert handler to check for error message
        let alertMessage = '';
        page.on('dialog', async dialog => {
            alertMessage = dialog.message();
            await dialog.accept();
        });
        
        // Trigger preview update
        await page.locator('#seamAllowance').press('Enter');
        await page.waitForTimeout(1000);
        
        // Check that alert contains seam allowance error
        expect(alertMessage).toContain('path-1');
        
        // Verify that the valid path still gets seam allowance
        const previewHTML = await page.locator('#svgPreview').innerHTML();
        expect(previewHTML).toContain('seam-allowance');
    });
});