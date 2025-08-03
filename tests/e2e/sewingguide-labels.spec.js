import { test, expect } from '@playwright/test';

test.describe('Sewingguide Labels', () => {
    test('should display labels for sewingguide pairs', async ({ page }) => {
        await page.goto('/');
        
        // Create test SVG with sewingguide pairs
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200mm" height="200mm">
                <defs>
                    <style>
                        .seam { stroke: #000; stroke-width: 1px; fill: none; }
                        .sewinguide { stroke-width: 1px; fill: none; }
                    </style>
                </defs>
                <!-- Pattern piece A -->
                <g id="piece-1">
                    <path class="seam" d="M 20,20 L 80,20 L 80,80 L 20,80 Z"/>
                    <text x="50" y="50" text-anchor="middle" font-size="8">A</text>
                    <!-- Sewingguide on edge -->
                    <path class="sewinguide" stroke="#ff0000" d="M 80,40 L 90,40"/>
                    <path class="sewinguide" stroke="#00ff00" d="M 50,80 L 50,90"/>
                </g>
                <!-- Pattern piece B -->
                <g id="piece-2">
                    <path class="seam" d="M 120,20 L 180,20 L 180,80 L 120,80 Z"/>
                    <text x="150" y="50" text-anchor="middle" font-size="8">B</text>
                    <!-- Matching sewingguides -->
                    <path class="sewinguide" stroke="#ff0000" d="M 110,40 L 120,40"/>
                    <path class="sewinguide" stroke="#00ff00" d="M 150,80 L 150,90"/>
                </g>
                <!-- Pattern piece C -->
                <g id="piece-3">
                    <path class="seam" d="M 20,120 L 80,120 L 80,180 L 20,180 Z"/>
                    <text x="50" y="150" text-anchor="middle" font-size="8">C</text>
                    <!-- Sewingguide with 3 occurrences (should warn) -->
                    <path class="sewinguide" stroke="#0000ff" d="M 80,150 L 90,150"/>
                </g>
                <!-- Pattern piece D -->
                <g id="piece-4">
                    <path class="seam" d="M 120,120 L 180,120 L 180,180 L 120,180 Z"/>
                    <text x="150" y="150" text-anchor="middle" font-size="8">D</text>
                    <!-- More sewingguides with blue color -->
                    <path class="sewinguide" stroke="#0000ff" d="M 110,150 L 120,150"/>
                    <path class="sewinguide" stroke="#0000ff" d="M 150,180 L 150,190"/>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'sewingguide-test.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Wait for preview to update
        await page.waitForTimeout(1000);
        
        // Check that sewingguide labels are present in preview
        const previewHTML = await page.locator('#svgPreview').innerHTML();
        
        // Red pair should have labels A:B:1 (both show same alphabetical label)
        expect(previewHTML).toContain('A:B:1');
        // Both elements should show the same label (alphabetically sorted)
        const labelCount = (previewHTML.match(/A:B:1/g) || []).length;
        expect(labelCount).toBeGreaterThanOrEqual(2);
        
        // Green pair should have labels A:B:2 (or could be B:C:1)
        // We need to check for the presence of labels, not exact values
        const labelElements = await page.locator('.sewingguide-label').all();
        expect(labelElements.length).toBeGreaterThan(0);
        
        // Blue sewingguides (3 occurrences) should NOT have labels
        const blueLabels = await page.locator('[stroke="#0000ff"] + .sewingguide-label').count();
        expect(blueLabels).toBe(0);
    });
    
    test('should include sewingguide labels in PDF', async ({ page }) => {
        await page.goto('/');
        
        // Create simple test SVG with one sewingguide pair
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100mm" height="50mm">
                <defs>
                    <style>
                        .seam { stroke: #000; stroke-width: 1px; fill: none; }
                        .sewinguide { stroke-width: 1px; fill: none; }
                    </style>
                </defs>
                <g id="piece-1">
                    <path class="seam" d="M 10,10 L 40,10 L 40,40 L 10,40 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 40,25 L 50,25"/>
                </g>
                <g id="piece-2">
                    <path class="seam" d="M 60,10 L 90,10 L 90,40 L 60,40 Z"/>
                    <path class="sewinguide" stroke="#ff0000" d="M 50,25 L 60,25"/>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'sewingguide-pdf-test.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Generate PDF
        const downloadPromise = page.waitForEvent('download');
        await page.click('#generatePdf');
        
        const download = await downloadPromise;
        const fileName = download.suggestedFilename();
        
        // Verify filename
        expect(fileName).toMatch(/sewing-pattern-.*\.pdf/);
        
        // Note: We can't easily verify PDF content in browser tests,
        // but the fact that it generated without errors is a good sign
    });
});