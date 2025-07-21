# Sewing SVG to PDF Converter

A web application that converts SVG files output by the Blender Seams to Sewing Pattern plugin into printable PDFs.

## Features

- Drag & drop SVG file loading
- Scale correction (default 1/1000)
- Multiple paper size support (A4, A3, B4, B5)
- Multi-page split printing
- Alignment marks for printing
- Overlap margin settings

## Setup

### Requirements

- Node.js 16+
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Installation

```bash
npm install
```

### Development Server

```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx serve .
```

Access http://localhost:8000 in your browser

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# UI test runner
npm run test:ui
```

## Usage

1. **Load SVG File**
   - Drag & drop or file selection
   - Supports SVG output from Seams to Sewing Pattern plugin

2. **Adjust Settings**
   - Scale factor (default: 0.001)
   - Paper size and orientation
   - Enable/disable split printing
   - Overlap margin size

3. **Generate PDF**
   - Click "Generate PDF" button
   - Automatic download starts

## File Structure

```
sewing-svg-to-pdf/
├── index.html           # Main HTML
├── css/
│   └── style.css       # Stylesheet
├── js/
│   ├── main.js         # Main logic
│   ├── svg-processor.js # SVG processing
│   ├── pdf-generator.js # PDF generation
│   └── ui-controller.js # UI control
├── test/               # Test files
├── resources/
│   └── example.svg     # Sample file
└── CLAUDE.md          # Detailed specification
```

## Limitations

- Limited browser support
- Large SVG files may consume significant memory
- Some SVG features may not be supported due to svg2pdf.js constraints

## License

MIT License