import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Seam Allowance with Unit Placement', () => {
    test('units with seam allowance should not overlap', async ({ page }) => {
        await page.goto('/');
        
        // Create SVG with 4 units that should fit on 2 pages with seam allowance
        // With 10mm seam allowance: 60x60 becomes 80x80mm
        // Total needed between units: 20mm (seam allowance x2) + 2mm margin = 22mm
        // A4 page (190x277mm printable) can fit 2 units per page
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200mm" height="200mm">
                <defs>
                    <style>
                        .seam {
                            stroke: #000;
                            stroke-width: 1px;
                            fill: none;
                        }
                    </style>
                </defs>
                <!-- First unit: 60x60 square at (20,20) -->
                <g>
                    <path class="seam" d="M 20,20 L 80,20 L 80,80 L 20,80 Z"/>
                    <text x="50" y="50" text-anchor="middle" font-size="8">Unit 1</text>
                </g>
                <!-- Second unit: 60x60 square at (120,20) - 40mm gap without seam allowance -->
                <g>
                    <path class="seam" d="M 120,20 L 180,20 L 180,80 L 120,80 Z"/>
                    <text x="150" y="50" text-anchor="middle" font-size="8">Unit 2</text>
                </g>
                <!-- Third unit: 60x60 square at (20,120) -->
                <g>
                    <path class="seam" d="M 20,120 L 80,120 L 80,180 L 20,180 Z"/>
                    <text x="50" y="150" text-anchor="middle" font-size="8">Unit 3</text>
                </g>
                <!-- Fourth unit: 60x60 square at (120,120) -->
                <g>
                    <path class="seam" d="M 120,120 L 180,120 L 180,180 L 120,180 Z"/>
                    <text x="150" y="150" text-anchor="middle" font-size="8">Unit 4</text>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'multi-unit-test.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set seam allowance to 10mm
        await page.fill('#seamAllowance', '10');
        
        // Set scale to 100% (no scaling) for easier calculation
        await page.fill('#scaleFactor', '100');
        
        // Trigger preview update
        await page.locator('#scaleFactor').press('Enter');
        await page.waitForTimeout(1000);
        
        // Multi-page mode is enabled by default (splitPages: true)
        
        // Get the preview HTML
        const previewHTML = await page.locator('#svgPreview').innerHTML();
        
        // Parse the preview to check unit positions
        // With 10mm seam allowance, each 60x60 unit becomes 80x80
        // Two units (80x80) with 22mm margin = 182mm width, fits within 190mm page width
        
        // Check that seam-allowance paths are created
        // Since preview now shows only first page when multiple pages, we should see exactly 2 paths
        const seamAllowancePaths = previewHTML.match(/class="seam-allowance"/g) || [];
        expect(seamAllowancePaths.length).toBe(2); // Exactly 2 seam allowance paths for first page
        
        // Check that page navigation is visible and shows correct info
        const pageNavigation = await page.locator('#pageNavigation');
        await expect(pageNavigation).toBeVisible();
        
        const pageIndicator = await page.locator('#pageIndicator').textContent();
        expect(pageIndicator).toBe('ページ 1 / 2');
        
        // Log the preview HTML to see the structure
        console.log('Preview HTML structure:', previewHTML.substring(0, 500));
        
        // Extract unit positions from the preview
        // Units might be in separate SVG elements or transformed groups
        const unitElements = await page.locator('g[data-pattern-symbol]').all();
        console.log('Number of unit elements found:', unitElements.length);
        
        // Check page count - with seam allowance, units should need 2 pages
        const pageInfo = await page.locator('#pageInfo').textContent();
        console.log('Page info:', pageInfo);
        
        // Assert that exactly 2 pages are created
        expect(pageInfo).toContain('2 pages');
        
        // Additional validation: ensure it's exactly 2 pages, not more
        const match = pageInfo.match(/(\d+)\s+pages/);
        if (match) {
            const pageCount = parseInt(match[1]);
            expect(pageCount).toBe(2);
        } else {
            throw new Error('Could not extract page count from page info');
        }
    });
    
    test('should place units on separate pages when seam allowance causes overlap', async ({ page }) => {
        await page.goto('/');
        
        // Create SVG with two units that fit on one page without seam allowance
        // but need separate pages with seam allowance due to overlap
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 265" width="200mm" height="265mm">
                <defs>
                    <style>
                        .seam {
                            stroke: #000;
                            stroke-width: 1px;
                            fill: none;
                        }
                    </style>
                </defs>
                <!-- First unit: 120x120 -->
                <g>
                    <path class="seam" d="M 40,10 L 160,10 L 160,130 L 40,130 Z"/>
                    <text x="100" y="70" text-anchor="middle" font-size="12">Unit 1</text>
                </g>
                <!-- Second unit: 120x120 positioned below with small gap -->
                <g>
                    <path class="seam" d="M 40,135 L 160,135 L 160,255 L 40,255 Z"/>
                    <text x="100" y="195" text-anchor="middle" font-size="12">Unit 2</text>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'overlapping-units-test.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set paper size to A4
        await page.selectOption('#paperSize', 'a4');
        
        // Set seam allowance to 15mm
        await page.fill('#seamAllowance', '15');
        
        // Set scale to 1
        await page.fill('#scaleFactor', '1');
        
        // Multi-page mode is enabled by default
        
        // Trigger preview update
        await page.locator('#scaleFactor').press('Enter');
        await page.waitForTimeout(1000);
        
        // Check page count
        const pageInfo = await page.locator('#pageInfo').textContent();
        console.log('Page info:', pageInfo);
        
        // With 15mm seam allowance, each 120x120 unit becomes 150x150
        // Gap between units is 5mm (135-130), but need 30mm for seam allowances
        expect(pageInfo).toContain('2 pages');
    });
    
    test('page navigation should work for multi-page layouts', async ({ page }) => {
        await page.goto('/');
        
        // Create SVG with 4 units that will be split across 2 pages
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200mm" height="200mm">
                <defs>
                    <style>
                        .seam {
                            stroke: #000;
                            stroke-width: 1px;
                            fill: none;
                        }
                    </style>
                </defs>
                <!-- First unit: 60x60 square at (20,20) -->
                <g>
                    <path class="seam" d="M 20,20 L 80,20 L 80,80 L 20,80 Z"/>
                    <text x="50" y="50" text-anchor="middle" font-size="8">Unit 1</text>
                </g>
                <!-- Second unit: 60x60 square at (120,20) -->
                <g>
                    <path class="seam" d="M 120,20 L 180,20 L 180,80 L 120,80 Z"/>
                    <text x="150" y="50" text-anchor="middle" font-size="8">Unit 2</text>
                </g>
                <!-- Third unit: 60x60 square at (20,120) -->
                <g>
                    <path class="seam" d="M 20,120 L 80,120 L 80,180 L 20,180 Z"/>
                    <text x="50" y="150" text-anchor="middle" font-size="8">Unit 3</text>
                </g>
                <!-- Fourth unit: 60x60 square at (120,120) -->
                <g>
                    <path class="seam" d="M 120,120 L 180,120 L 180,180 L 120,180 Z"/>
                    <text x="150" y="150" text-anchor="middle" font-size="8">Unit 4</text>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'multi-unit-navigation-test.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set seam allowance to 10mm
        await page.fill('#seamAllowance', '10');
        
        // Trigger preview update
        await page.locator('#seamAllowance').press('Enter');
        await page.waitForTimeout(1000);
        
        // Check that page navigation is visible
        const pageNavigation = await page.locator('#pageNavigation');
        await expect(pageNavigation).toBeVisible();
        
        // Check initial state
        const pageIndicator = await page.locator('#pageIndicator');
        await expect(pageIndicator).toHaveText('ページ 1 / 2');
        
        const prevBtn = await page.locator('#prevPageBtn');
        const nextBtn = await page.locator('#nextPageBtn');
        
        // Previous button should be disabled on first page
        await expect(prevBtn).toBeDisabled();
        await expect(nextBtn).toBeEnabled();
        
        // Check that first page has 2 units
        let previewHTML = await page.locator('#svgPreview').innerHTML();
        let unitTexts = previewHTML.match(/>Unit \d</g) || [];
        expect(unitTexts.length).toBe(2);
        
        // Navigate to page 2
        await nextBtn.click();
        await page.waitForTimeout(500);
        
        // Check page 2 state
        await expect(pageIndicator).toHaveText('ページ 2 / 2');
        await expect(prevBtn).toBeEnabled();
        await expect(nextBtn).toBeDisabled();
        
        // Check that second page has 2 different units
        previewHTML = await page.locator('#svgPreview').innerHTML();
        unitTexts = previewHTML.match(/>Unit \d</g) || [];
        expect(unitTexts.length).toBe(2);
        
        // Navigate back to page 1
        await prevBtn.click();
        await page.waitForTimeout(500);
        
        // Check we're back to page 1
        await expect(pageIndicator).toHaveText('ページ 1 / 2');
        await expect(prevBtn).toBeDisabled();
        await expect(nextBtn).toBeEnabled();
    });
});