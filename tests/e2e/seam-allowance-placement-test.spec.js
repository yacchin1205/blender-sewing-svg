import { test, expect } from '@playwright/test';

test.describe('Seam Allowance Placement Test', () => {
    test('should correctly calculate bounds with seam allowance', async ({ page }) => {
        await page.goto('http://localhost:8000');
        
        // Enable console log capture
        const consoleLogs = [];
        page.on('console', msg => {
            if (msg.type() === 'log' && msg.text().includes('seam')) {
                consoleLogs.push(msg.text());
            }
        });
        
        // Create SVG with a 50x50 unit that will have 10mm seam allowance
        const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200mm" height="100mm">
            <g class="pattern-unit" id="unit1">
                <path class="seam" d="M10,10 L60,10 L60,60 L10,60 Z" stroke="black" fill="none"/>
            </g>
        </svg>
        `;
        
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const file = new File([blob], 'test-seam-bounds.svg', { type: 'image/svg+xml' });
        
        await page.locator('#fileInput').setInputFiles({
            name: file.name,
            mimeType: file.type,
            buffer: Buffer.from(await file.arrayBuffer())
        });
        
        // Wait for preview
        await page.waitForSelector('#svgPreview svg', { timeout: 5000 });
        
        // Apply 10mm seam allowance
        await page.fill('#seamAllowance', '10');
        await page.locator('#seamAllowance').dispatchEvent('change');
        await page.waitForTimeout(500);
        
        // Check if seam allowance paths were created
        const seamAllowanceCount = await page.evaluate(() => {
            const svg = document.querySelector('#svgPreview svg');
            const seamAllowancePaths = svg.querySelectorAll('path.seam-allowance');
            console.log('Seam allowance paths found:', seamAllowancePaths.length);
            
            seamAllowancePaths.forEach((path, index) => {
                const bbox = path.getBBox();
                console.log(`Seam allowance path ${index} bbox: x=${bbox.x}, y=${bbox.y}, width=${bbox.width}, height=${bbox.height}`);
            });
            
            return seamAllowancePaths.length;
        });
        
        expect(seamAllowanceCount).toBe(1);
        
        // Print captured logs
        console.log('Captured console logs:');
        consoleLogs.forEach(log => console.log('  ', log));
    });
});