import * as vscode from "vscode";
import { OcrPanelProvider } from "./ocrPanelProvider";
import { disposeOcrWorker } from "./ocrService";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new OcrPanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(OcrPanelProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("textifyImage.openPanel", async () => {
      await vscode.commands.executeCommand("textifyImage.mainView.focus");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("textifyImage.insertResult", async () => {
      const text = provider.getLastResult();
      const editor = vscode.window.activeTextEditor;
      if (!text) {
        vscode.window.showInformationMessage("No OCR result yet. Paste an image in the Textify Image panel first.");
        return;
      }
      if (!editor) {
        vscode.window.showInformationMessage("Open a text editor to insert the OCR result.");
        return;
      }
      await editor.edit((eb) => eb.insert(editor.selection.active, text));
    })
  );
}

export async function deactivate(): Promise<void> {
  await disposeOcrWorker();
}
