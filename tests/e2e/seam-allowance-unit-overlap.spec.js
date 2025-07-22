import { test, expect } from '@playwright/test';

test.describe('Seam Allowance Unit Overlap Detection', () => {
    test('should fail when units with seam allowance overlap', async ({ page }) => {
        await page.goto('/');
        
        // Create SVG with two units that are exactly adjacent (no gap)
        // With seam allowance, they will overlap
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200mm" height="100mm">
                <defs>
                    <style>
                        .seam {
                            stroke: #000;
                            stroke-width: 1px;
                            fill: none;
                        }
                    </style>
                </defs>
                <!-- First unit: 90x90 square at (5,5) -->
                <g class="pattern-unit">
                    <path class="seam" d="M 5,5 L 95,5 L 95,95 L 5,95 Z"/>
                    <text x="50" y="50" text-anchor="middle" font-size="8">Unit 1</text>
                </g>
                <!-- Second unit: 90x90 square at (95,5) - exactly adjacent, no gap -->
                <g class="pattern-unit">
                    <path class="seam" d="M 95,5 L 185,5 L 185,95 L 95,95 Z"/>
                    <text x="140" y="50" text-anchor="middle" font-size="8">Unit 2</text>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'adjacent-units.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set seam allowance to 10mm
        await page.fill('#seamAllowance', '10');
        
        // Set scale to 1 (no scaling)
        await page.fill('#scaleFactor', '1');
        
        // Set paper size to A3 to ensure both units could fit if properly spaced
        await page.selectOption('#paperSize', 'a3');
        
        // Trigger preview update
        await page.locator('#scaleFactor').press('Enter');
        await page.waitForTimeout(1000);
        
        // Get page info
        const pageInfo = await page.locator('#pageInfo').textContent();
        console.log('Page info:', pageInfo);
        
        // Debug: Get console logs from the page
        page.on('console', msg => console.log('Page console:', msg.text()));
        
        // With 10mm seam allowance:
        // - Unit 1: 5,5 to 95,95 becomes -5,-5 to 105,105 (110x110)
        // - Unit 2: 95,5 to 185,95 becomes 85,-5 to 195,105 (110x110)
        // These overlap from x=85 to x=105 (20mm overlap)
        
        // The system should either:
        // 1. Place them on separate pages
        // 2. Adjust their positions to avoid overlap
        
        if (pageInfo.includes('1 pages')) {
            // If on one page, check that preview shows adjusted positions
            const previewHTML = await page.locator('#svgPreview').innerHTML();
            
            // Look for transform attributes that would indicate repositioning
            const transforms = previewHTML.match(/transform="([^"]+)"/g) || [];
            console.log('Found transforms:', transforms);
            
            // This test expects the units to be repositioned or on separate pages
            // If they're still at original positions with seam allowance, they overlap
            expect(pageInfo).toContain('2 pages'); // Should fail if overlap not handled
        }
    });
    
    test('should place overlapping units on separate pages', async ({ page }) => {
        await page.goto('/');
        
        // Create SVG with two large units that would overlap with seam allowance
        const testSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400mm" height="200mm">
                <defs>
                    <style>
                        .seam {
                            stroke: #000;
                            stroke-width: 1px;
                            fill: none;
                        }
                    </style>
                </defs>
                <!-- Two 180x180 units side by side with 20mm gap -->
                <g class="pattern-unit">
                    <path class="seam" d="M 10,10 L 190,10 L 190,190 L 10,190 Z"/>
                    <text x="100" y="100" text-anchor="middle" font-size="12">Large Unit 1</text>
                </g>
                <g class="pattern-unit">
                    <path class="seam" d="M 210,10 L 390,10 L 390,190 L 210,190 Z"/>
                    <text x="300" y="100" text-anchor="middle" font-size="12">Large Unit 2</text>
                </g>
            </svg>
        `;
        
        // Upload the file
        await page.locator('#fileInput').setInputFiles({
            name: 'large-units-overlap.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from(testSVG)
        });
        
        // Wait for file to be loaded
        await page.waitForSelector('.file-info', { state: 'visible' });
        
        // Set seam allowance to 20mm
        await page.fill('#seamAllowance', '20');
        
        // Set scale to 1
        await page.fill('#scaleFactor', '1');
        
        // Set paper size to A3 (297x420mm)
        await page.selectOption('#paperSize', 'a3');
        await page.selectOption('#orientation', 'landscape'); // 420x297mm
        
        // Trigger preview update
        await page.locator('#scaleFactor').press('Enter');
        await page.waitForTimeout(1000);
        
        // With 20mm seam allowance:
        // - Unit 1: 10,10 to 190,190 becomes -10,-10 to 210,210 (220x220)
        // - Unit 2: 210,10 to 390,190 becomes 190,-10 to 410,210 (220x220)
        // These overlap from x=190 to x=210 (20mm overlap)
        
        // Even with A3 landscape (420x297mm), both units can't fit side by side
        // because -10 to 410 = 420mm total width, which exceeds printable area
        
        const pageInfo = await page.locator('#pageInfo').textContent();
        console.log('Page info with large units:', pageInfo);
        
        // Should be on 2 pages due to overlap
        expect(pageInfo).toContain('2 pages');
    });
});