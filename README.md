# Paste Image OCR

A simple VS Code / Cursor / Open VSX extension that opens a **dedicated sidebar panel** (Thunder Client–style). Paste or drop an image and extract text with **local OCR** via [Tesseract.js](https://github.com/naptha/tesseract.js).

**No API keys. No cloud. No cost.**

## Features

- Activity-bar icon → **Image to Text** panel
- Paste (`Ctrl+V` / `Cmd+V`), drag-and-drop, or pick a file
- Offline OCR (English by default)
- **Copy** result or **Insert into editor**

## Install

### From Open VSX

Search for **Paste Image OCR** in Cursor / VSCodium, or:

```bash
ovsx get HabibAliAtFolio3.paste-image-ocr
```

### From VSIX

1. Download the `.vsix` from [Releases](https://github.com/HabibAliAtFolio3/paste-image-ocr/releases)
2. VS Code / Cursor → **Extensions: Install from VSIX…**

### From source

```bash
npm install
npm run compile
npx vsce package --no-dependencies
# then Install from VSIX
```

## Usage

1. Click the **Paste Image OCR** icon in the activity bar (or run **Paste Image OCR: Open Panel**).
2. Copy a screenshot / image to the clipboard.
3. Click the drop zone and press **Ctrl+V** (or drop / choose a file).
4. Wait for OCR, then **Copy** or **Insert into editor**.

## Tips

- Zoom or crop large screenshots — accuracy drops on dense / tiny text.
- Prefer high-contrast text.

## License

MIT
