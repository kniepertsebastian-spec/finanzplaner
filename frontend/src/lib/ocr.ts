import Tesseract from 'tesseract.js';

// Runs client-side OCR on a receipt photo (German-language traineddata, since the app is
// German-only). tesseract.js fetches its WASM core/worker/language data from a CDN on first use,
// so this needs the user's device to be online; the image itself is processed entirely in the
// browser and never sent to our own backend for this step.
export async function recognizeReceiptText(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const result = await Tesseract.recognize(file, 'deu', {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  return result.data.text;
}
