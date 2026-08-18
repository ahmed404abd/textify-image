import * as vscode from "vscode";
import { recognizeText } from "./ocrService";

type IncomingMessage =
  | { type: "recognize"; imageBase64: string; language?: string }
  | { type: "copy"; text: string }
  | { type: "insert"; text: string }
  | { type: "ready" };

export class OcrPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "textifyImage.mainView";

  private view?: vscode.WebviewView;
  private lastResult = "";

  constructor(private readonly extensionUri: vscode.Uri) {}

  public getLastResult(): string {
    return this.lastResult;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: IncomingMessage) => {
      switch (message.type) {
        case "recognize":
          await this.handleRecognize(message.imageBase64, message.language ?? "eng");
          break;
        case "copy":
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage("OCR text copied to clipboard.");
          break;
        case "insert": {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showInformationMessage("Open a text editor to insert the OCR result.");
            return;
          }
          await editor.edit((eb) => eb.insert(editor.selection.active, message.text));
          break;
        }
        default:
          break;
      }
    });
  }

  private async handleRecognize(imageBase64: string, language: string): Promise<void> {
    if (!this.view) {
      return;
    }

    this.view.webview.postMessage({ type: "status", status: "working", message: "Scanning image…" });

    try {
      const match = /^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/.exec(imageBase64);
      const base64 = match ? match[1] : imageBase64;
      const buffer = Buffer.from(base64, "base64");
      const text = await recognizeText(buffer, language);
      this.lastResult = text;
      this.view.webview.postMessage({ type: "result", text });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.view.webview.postMessage({ type: "error", message });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const coverUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "cover.png"));
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "icon.png"));
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-textifyImage'`,
      `img-src ${webview.cspSource} data: blob:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Textify Image</title>
  <style>
    :root {
      --bg: #07090c;
      --bg-elev: #0d1117;
      --bg-input: #10151c;
      --cyan: #5ec8ff;
      --cyan-dim: #3aa8dd;
      --red: #e23d48;
      --red-soft: #ff6b73;
      --text: #eaf6ff;
      --muted: #7d8c9a;
      --line: rgba(94, 200, 255, 0.22);
      --radius: 10px;
      --gap: 12px;
    }
    * { box-sizing: border-box; }
    html, body {
      height: 100%;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: "Segoe UI", Inter, system-ui, sans-serif;
      font-size: 12.5px;
      color: var(--text);
      background:
        radial-gradient(1200px 280px at 50% -80px, rgba(94, 200, 255, 0.08), transparent 60%),
        radial-gradient(700px 240px at 90% 120%, rgba(226, 61, 72, 0.08), transparent 55%),
        var(--bg);
      display: flex;
      flex-direction: column;
      gap: var(--gap);
      min-height: 100%;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand img {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--line);
      box-shadow: 0 0 18px rgba(94, 200, 255, 0.18);
      object-fit: cover;
    }
    .brand h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.01em;
      line-height: 1.1;
    }
    .brand h1 span { color: var(--cyan); }
    .brand p {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 11px;
    }
    .cover {
      width: 100%;
      max-height: 148px;
      object-fit: cover;
      object-position: center top;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      display: block;
      box-shadow: 0 0 24px rgba(226, 61, 72, 0.08), 0 0 18px rgba(94, 200, 255, 0.08);
    }
    .dropzone {
      position: relative;
      border: 1px dashed rgba(94, 200, 255, 0.35);
      border-radius: var(--radius);
      padding: 22px 12px 18px;
      text-align: center;
      background: linear-gradient(180deg, rgba(94, 200, 255, 0.05), rgba(13, 17, 23, 0.9));
      cursor: pointer;
      outline: none;
      overflow: hidden;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .dropzone::before,
    .dropzone::after {
      content: "";
      position: absolute;
      width: 14px;
      height: 14px;
      border: 2px solid var(--cyan);
      pointer-events: none;
    }
    .dropzone::before {
      top: 8px;
      left: 8px;
      border-right: 0;
      border-bottom: 0;
    }
    .dropzone::after {
      top: 8px;
      right: 8px;
      border-left: 0;
      border-bottom: 0;
    }
    .dropzone .corners {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .dropzone .corners span {
      position: absolute;
      width: 14px;
      height: 14px;
      border: 2px solid var(--cyan);
    }
    .dropzone .corners span:nth-child(1) {
      bottom: 8px;
      left: 8px;
      border-right: 0;
      border-top: 0;
    }
    .dropzone .corners span:nth-child(2) {
      bottom: 8px;
      right: 8px;
      border-left: 0;
      border-top: 0;
    }
    .scanline {
      position: absolute;
      left: 6%;
      right: 6%;
      height: 2px;
      background: var(--red);
      box-shadow: 0 0 12px var(--red), 0 0 24px rgba(226, 61, 72, 0.55);
      opacity: 0;
      top: 50%;
      pointer-events: none;
    }
    .dropzone.working .scanline {
      opacity: 1;
      animation: scan 1.4s ease-in-out infinite;
    }
    @keyframes scan {
      0% { top: 18%; }
      50% { top: 78%; }
      100% { top: 18%; }
    }
    .dropzone.dragover,
    .dropzone:focus {
      border-color: var(--cyan);
      box-shadow: 0 0 0 1px rgba(94, 200, 255, 0.25), 0 0 22px rgba(94, 200, 255, 0.12);
    }
    .dropzone p {
      margin: 4px 0;
      color: var(--muted);
    }
    .dropzone strong { color: var(--cyan); }
    .preview {
      display: none;
      max-width: 100%;
      max-height: 140px;
      object-fit: contain;
      border-radius: 8px;
      border: 1px solid var(--line);
      margin: 10px auto 0;
    }
    .preview.visible { display: block; }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    label { color: var(--muted); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
    select, button, textarea {
      font: inherit;
      border-radius: 8px;
    }
    select {
      background: var(--bg-input);
      color: var(--text);
      border: 1px solid var(--line);
      padding: 6px 8px;
    }
    button {
      background: linear-gradient(180deg, var(--cyan), var(--cyan-dim));
      color: #041018;
      border: none;
      padding: 7px 12px;
      cursor: pointer;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    button:hover:not(:disabled) {
      filter: brightness(1.08);
    }
    button:disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }
    button.secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--line);
      font-weight: 600;
    }
    button.ghost-red {
      background: transparent;
      color: var(--red-soft);
      border: 1px solid rgba(226, 61, 72, 0.45);
    }
    #status {
      min-height: 1.2em;
      font-size: 11.5px;
      color: var(--muted);
    }
    #status.working { color: var(--cyan); }
    #status.error { color: var(--red-soft); }
    textarea {
      width: 100%;
      min-height: 200px;
      flex: 1;
      resize: vertical;
      padding: 10px;
      background: var(--bg-input);
      color: var(--text);
      border: 1px solid var(--line);
      line-height: 1.45;
      box-shadow: inset 0 0 0 1px rgba(94, 200, 255, 0.04);
    }
    textarea::placeholder { color: #5a6976; }
    .hint {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="brand">
    <img src="${iconUri}" alt="Textify Image" />
    <div>
      <h1><span>Textify</span> Image</h1>
      <p>Local OCR · no API · no cloud</p>
    </div>
  </div>
  <img class="cover" src="${coverUri}" alt="Textify Image cover" />

  <div
    id="dropzone"
    class="dropzone"
    tabindex="0"
    role="button"
    aria-label="Paste or drop an image"
  >
    <div class="corners"><span></span><span></span></div>
    <div class="scanline"></div>
    <p><strong>Paste</strong> (Ctrl+V) or <strong>drop</strong> an image</p>
    <p>or click to choose a file</p>
    <img id="preview" class="preview" alt="Selected image preview" />
  </div>
  <input id="file" type="file" accept="image/*" hidden />

  <div class="row">
    <label for="lang">Language</label>
    <select id="lang" title="OCR language">
      <option value="eng" selected>English</option>
    </select>
    <button id="clear" class="ghost-red" type="button">Clear</button>
  </div>

  <div id="status">Ready — paste a screenshot to extract text.</div>
  <textarea id="result" placeholder="Scanned text will appear here…" spellcheck="false"></textarea>

  <div class="row">
    <button id="copy" type="button" disabled>Copy</button>
    <button id="insert" class="secondary" type="button" disabled>Insert into editor</button>
  </div>
  <p class="hint">Runs fully offline with Tesseract.js. Crop or zoom dense screenshots for better accuracy.</p>

  <script nonce="textifyImage">
    const vscode = acquireVsCodeApi();
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file');
    const preview = document.getElementById('preview');
    const statusEl = document.getElementById('status');
    const resultEl = document.getElementById('result');
    const langEl = document.getElementById('lang');
    const copyBtn = document.getElementById('copy');
    const insertBtn = document.getElementById('insert');
    const clearBtn = document.getElementById('clear');

    function setStatus(text, kind) {
      statusEl.textContent = text;
      statusEl.classList.remove('error', 'working');
      if (kind) statusEl.classList.add(kind);
    }

    function setBusy(busy) {
      dropzone.classList.toggle('working', busy);
      copyBtn.disabled = busy || !resultEl.value.trim();
      insertBtn.disabled = busy || !resultEl.value.trim();
    }

    function recognize(dataUrl) {
      preview.src = dataUrl;
      preview.classList.add('visible');
      setStatus('Scanning image…', 'working');
      setBusy(true);
      resultEl.value = '';
      vscode.postMessage({
        type: 'recognize',
        imageBase64: dataUrl,
        language: langEl.value
      });
    }

    function readFile(file) {
      if (!file || !file.type.startsWith('image/')) {
        setStatus('Please paste or drop an image file.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => recognize(String(reader.result));
      reader.readAsDataURL(file);
    }

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        readFile(fileInput.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      readFile(file);
    });

    window.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          readFile(file);
          return;
        }
      }
    });

    copyBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'copy', text: resultEl.value });
    });
    insertBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'insert', text: resultEl.value });
    });
    clearBtn.addEventListener('click', () => {
      resultEl.value = '';
      preview.removeAttribute('src');
      preview.classList.remove('visible');
      fileInput.value = '';
      setStatus('Ready — paste a screenshot to extract text.');
      setBusy(false);
      copyBtn.disabled = true;
      insertBtn.disabled = true;
    });
    resultEl.addEventListener('input', () => {
      const has = !!resultEl.value.trim();
      copyBtn.disabled = !has;
      insertBtn.disabled = !has;
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'result') {
        resultEl.value = msg.text || '';
        setStatus(resultEl.value.trim() ? 'Scan complete.' : 'No text detected.');
        setBusy(false);
      } else if (msg.type === 'error') {
        setStatus(msg.message || 'OCR failed.', 'error');
        setBusy(false);
      } else if (msg.type === 'status') {
        setStatus(msg.message || 'Working…', 'working');
      }
    });

    dropzone.focus();
  </script>
</body>
</html>`;
  }
}
