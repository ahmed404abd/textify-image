import * as vscode from "vscode";
import { recognizeText } from "./ocrService";

type IncomingMessage =
  | { type: "recognize"; imageBase64: string; language?: string }
  | { type: "copy"; text: string }
  | { type: "insert"; text: string }
  | { type: "ready" };

export class OcrPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "pasteImageOcr.mainView";

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
      localResourceRoots: [this.extensionUri],
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

    this.view.webview.postMessage({ type: "status", status: "working", message: "Running OCR…" });

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
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-pasteImageOcr'`,
      `img-src ${webview.cspSource} data: blob:`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paste Image OCR</title>
  <style>
    :root {
      color-scheme: light dark;
      --gap: 10px;
      --radius: 6px;
      --border: 1px solid var(--vscode-panel-border, #444);
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-button-background);
      --accent-fg: var(--vscode-button-foreground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border, #555);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      gap: var(--gap);
      min-height: 100vh;
    }
    h1 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .dropzone {
      border: 1px dashed var(--input-border);
      border-radius: var(--radius);
      padding: 20px 12px;
      text-align: center;
      background: var(--input-bg);
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .dropzone.dragover,
    .dropzone:focus {
      border-color: var(--accent);
    }
    .dropzone p {
      margin: 4px 0;
      color: var(--muted);
    }
    .dropzone strong { color: var(--fg); }
    .preview {
      display: none;
      max-width: 100%;
      max-height: 160px;
      object-fit: contain;
      border-radius: var(--radius);
      border: var(--border);
      margin: 8px auto 0;
    }
    .preview.visible { display: block; }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    label { color: var(--muted); font-size: 12px; }
    select, button, textarea {
      font: inherit;
      border-radius: var(--radius);
    }
    select {
      background: var(--input-bg);
      color: var(--fg);
      border: 1px solid var(--input-border);
      padding: 4px 8px;
    }
    button {
      background: var(--accent);
      color: var(--accent-fg);
      border: none;
      padding: 6px 12px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.secondary {
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--input-border);
    }
    #status {
      min-height: 1.2em;
      font-size: 12px;
      color: var(--muted);
    }
    #status.error { color: var(--vscode-errorForeground, #f44); }
    textarea {
      width: 100%;
      min-height: 220px;
      flex: 1;
      resize: vertical;
      padding: 8px;
      background: var(--input-bg);
      color: var(--fg);
      border: 1px solid var(--input-border);
      line-height: 1.4;
    }
    .hint {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <h1>Paste Image OCR</h1>
  <div
    id="dropzone"
    class="dropzone"
    tabindex="0"
    role="button"
    aria-label="Paste or drop an image"
  >
    <p><strong>Paste</strong> (Ctrl+V) or <strong>drop</strong> an image here</p>
    <p>or click to choose a file</p>
    <img id="preview" class="preview" alt="Selected image preview" />
  </div>
  <input id="file" type="file" accept="image/*" hidden />

  <div class="row">
    <label for="lang">Language</label>
    <select id="lang" title="OCR language">
      <option value="eng" selected>English</option>
    </select>
    <button id="clear" class="secondary" type="button">Clear</button>
  </div>

  <div id="status">Ready — paste a screenshot to extract text.</div>
  <textarea id="result" placeholder="OCR text will appear here…" spellcheck="false"></textarea>

  <div class="row">
    <button id="copy" type="button" disabled>Copy</button>
    <button id="insert" type="button" disabled>Insert into editor</button>
  </div>
  <p class="hint">Runs fully offline with Tesseract.js. For long text, crop or zoom the image for better accuracy.</p>

  <script nonce="pasteImageOcr">
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

    function setStatus(text, isError) {
      statusEl.textContent = text;
      statusEl.classList.toggle('error', !!isError);
    }

    function setBusy(busy) {
      copyBtn.disabled = busy || !resultEl.value.trim();
      insertBtn.disabled = busy || !resultEl.value.trim();
    }

    function recognize(dataUrl) {
      preview.src = dataUrl;
      preview.classList.add('visible');
      setStatus('Running OCR…');
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
        setStatus('Please paste or drop an image file.', true);
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
        setStatus(resultEl.value.trim() ? 'Done.' : 'No text detected.');
        setBusy(false);
      } else if (msg.type === 'error') {
        setStatus(msg.message || 'OCR failed.', true);
        setBusy(false);
      } else if (msg.type === 'status') {
        setStatus(msg.message || 'Working…');
      }
    });

    dropzone.focus();
  </script>
</body>
</html>`;
  }
}
