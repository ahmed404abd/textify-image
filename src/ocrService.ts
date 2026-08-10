import { createWorker, type Worker } from "tesseract.js";

let worker: Worker | undefined;
let workerLang: string | undefined;

async function getWorker(language: string): Promise<Worker> {
  if (worker && workerLang === language) {
    return worker;
  }
  if (worker) {
    await worker.terminate();
    worker = undefined;
    workerLang = undefined;
  }
  worker = await createWorker(language);
  workerLang = language;
  return worker;
}

export async function recognizeText(image: Buffer, language = "eng"): Promise<string> {
  const w = await getWorker(language);
  const {
    data: { text },
  } = await w.recognize(image);
  return (text || "").trim();
}

export async function disposeOcrWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = undefined;
    workerLang = undefined;
  }
}
