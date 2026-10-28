/**
 * Document Intelligence — local text extraction for PDF, DOCX, TXT, MD, CSV, JSON.
 *
 * Extracts text entirely in the browser — no document content is uploaded to
 * any external service for extraction. The extracted text is then sent to the
 * user's configured BYOK provider as a normal chat message.
 *
 * Supported formats:
 *   - PDF (pdfjs-dist, page-by-page, page boundaries preserved)
 *   - DOCX (mammoth, paragraph + heading extraction)
 *   - TXT / MD / CSV / JSON / code files (plain text read)
 *
 * Limits:
 *   - Max file size: 25 MB
 *   - Max extracted text: 500,000 chars (~125K tokens) — if exceeded, the text
 *     is chunked and only the first chunk is sent, with a clear notice
 *   - Max PDF pages processed: 200 (beyond that, a notice is shown)
 *
 * Scanned PDFs (image-only, no text layer) return a clear "no extractable text"
 * error — OCR is not implemented (would require a vision model call, which is
 * a separate explicit step the user can trigger via image analysis).
 */

export interface ExtractedDocument {
  /** The extracted text content, ready to send to a chat model. */
  text: string;
  /** The filename, preserved for metadata. */
  filename: string;
  /** The detected format. */
  format: "pdf" | "docx" | "txt" | "md" | "csv" | "json" | "code" | "unknown";
  /** Number of pages (PDF only). */
  pageCount?: number;
  /** Whether the text was truncated due to size limits. */
  truncated: boolean;
  /** Whether the document had no extractable text (e.g., scanned PDF). */
  empty: boolean;
  /** A human-readable notice about the extraction (e.g., truncation). */
  notice?: string;
}

export interface DocumentExtractionOptions {
  /** Max file size in bytes (default 25MB). */
  maxFileSize?: number;
  /** Max extracted text length in chars (default 500,000). */
  maxTextLength?: number;
  /** Max PDF pages to process (default 200). */
  maxPdfPages?: number;
}

const DEFAULTS: Required<DocumentExtractionOptions> = {
  maxFileSize: 25 * 1024 * 1024,
  maxTextLength: 500_000,
  maxPdfPages: 200,
};

/** Detect the document format from the filename + MIME type. */
export function detectDocumentFormat(filename: string, mimeType: string): ExtractedDocument["format"] {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "txt" || mimeType === "text/plain") return "txt";
  if (ext === "md" || mimeType === "text/markdown") return "md";
  if (ext === "csv" || mimeType === "text/csv") return "csv";
  if (ext === "json" || mimeType === "application/json") return "json";
  // Code file extensions
  if (["js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "css", "html", "xml", "yml", "yaml", "sh", "sql"].includes(ext)) return "code";
  return "unknown";
}

/** Validate file size before processing. */
export function validateFileSize(file: { size: number }, maxBytes: number = DEFAULTS.maxFileSize): { ok: boolean; error?: string } {
  if (file.size > maxBytes) {
    return { ok: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${maxBytes / 1024 / 1024} MB.` };
  }
  return { ok: true };
}

/**
 * Extract text from a PDF using pdfjs-dist.
 * Runs entirely in the browser — no upload.
 */
async function extractPdf(
  dataUrl: string,
  opts: Required<DocumentExtractionOptions>,
): Promise<{ text: string; pageCount: number; truncated: boolean; empty: boolean; notice?: string }> {
  // pdfjs-dist needs to be loaded with a worker. We use the legacy build path
  // that works without a separate worker file (runs on main thread).
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  // Set the worker source to a CDN that matches the installed version, or
  // disable the worker (runs on main thread, slower but no CORS issues).
  // @ts-expect-error — GlobalWorkerOptions exists on the pdfjs module
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  // Convert data URL to Uint8Array
  const base64 = dataUrl.split(",")[1] || "";
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pagesToProcess = Math.min(totalPages, opts.maxPdfPages);

  const pageTexts: string[] = [];
  let totalChars = 0;
  let truncated = false;

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (item as { str?: string }).str || "")
      .join(" ")
      .trim();
    if (pageText) {
      pageTexts.push(`--- Page ${i} ---\n${pageText}`);
      totalChars += pageText.length;
      if (totalChars > opts.maxTextLength) {
        truncated = true;
        break;
      }
    }
  }

  const text = pageTexts.join("\n\n");
  const empty = text.length === 0;

  let notice: string | undefined;
  if (truncated) {
    notice = `Document was truncated at ${opts.maxTextLength.toLocaleString()} characters. ${pagesToProcess} of ${totalPages} pages processed.`;
  } else if (pagesToProcess < totalPages) {
    notice = `Only the first ${pagesToProcess} of ${totalPages} pages were processed (limit).`;
  } else if (empty) {
    notice = "This PDF appears to be scanned (image-only) with no extractable text layer. Try uploading page screenshots as images for vision-based analysis.";
  }

  return { text, pageCount: totalPages, truncated, empty, notice };
}

/**
 * Extract text from a DOCX using mammoth.
 * Runs entirely in the browser — no upload.
 */
async function extractDocx(
  dataUrl: string,
  opts: Required<DocumentExtractionOptions>,
): Promise<{ text: string; truncated: boolean; empty: boolean; notice?: string }> {
  const mammoth = await import("mammoth/mammoth.browser");
  // Convert data URL to ArrayBuffer
  const base64 = dataUrl.split(",")[1] || "";
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
  let text = result.value || "";
  const empty = text.trim().length === 0;
  let truncated = false;
  let notice: string | undefined;

  if (text.length > opts.maxTextLength) {
    text = text.slice(0, opts.maxTextLength);
    truncated = true;
    notice = `Document was truncated at ${opts.maxTextLength.toLocaleString()} characters.`;
  }
  if (empty) {
    notice = "This DOCX appears to be empty or contains no extractable text.";
  }

  return { text, truncated, empty, notice };
}

/**
 * Extract text from a plain-text file (TXT, MD, CSV, JSON, code).
 */
function extractPlainText(dataUrl: string, opts: Required<DocumentExtractionOptions>): { text: string; truncated: boolean; empty: boolean; notice?: string } {
  // data URL format: data:<mime>;base64,<data>
  const base64 = dataUrl.split(",")[1] || "";
  let text: string;
  try {
    // Decode base64 as UTF-8
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    text = new TextDecoder("utf-8").decode(bytes);
  } catch {
    return { text: "", truncated: false, empty: true, notice: "Could not decode the file as UTF-8 text." };
  }

  const empty = text.trim().length === 0;
  let truncated = false;
  let notice: string | undefined;

  if (text.length > opts.maxTextLength) {
    text = text.slice(0, opts.maxTextLength);
    truncated = true;
    notice = `Document was truncated at ${opts.maxTextLength.toLocaleString()} characters.`;
  }
  if (empty) {
    notice = "This file is empty.";
  }

  return { text, truncated, empty, notice };
}

/**
 * Main entry point — extract text from a supported document.
 * @param dataUrl The file as a data URL (base64)
 * @param filename The original filename
 * @param mimeType The MIME type
 * @param opts Extraction options
 */
export async function extractDocument(
  dataUrl: string,
  filename: string,
  mimeType: string,
  opts: DocumentExtractionOptions = {},
): Promise<ExtractedDocument> {
  const fullOpts = { ...DEFAULTS, ...opts };
  const format = detectDocumentFormat(filename, mimeType);

  if (format === "unknown") {
    return {
      text: "",
      filename,
      format,
      truncated: false,
      empty: true,
      notice: `Unsupported file format: ${filename}. Supported: PDF, DOCX, TXT, MD, CSV, JSON, and code files.`,
    };
  }

  try {
    if (format === "pdf") {
      const result = await extractPdf(dataUrl, fullOpts);
      return { text: result.text, filename, format, pageCount: result.pageCount, ...result };
    }
    if (format === "docx") {
      const result = await extractDocx(dataUrl, fullOpts);
      return { text: result.text, filename, format, ...result };
    }
    // Plain text formats
    const result = extractPlainText(dataUrl, fullOpts);
    return { text: result.text, filename, format, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      text: "",
      filename,
      format,
      truncated: false,
      empty: true,
      notice: `Failed to extract text from ${filename}: ${message}`,
    };
  }
}

/**
 * Format the extracted document as a chat message prefix.
 * This is prepended to the user's question so the model has the document context.
 */
export function formatDocumentForChat(doc: ExtractedDocument): string {
  const meta: string[] = [`File: ${doc.filename}`, `Format: ${doc.format.toUpperCase()}`];
  if (doc.pageCount) meta.push(`Pages: ${doc.pageCount}`);
  if (doc.truncated) meta.push("⚠️ Truncated");
  if (doc.empty) meta.push("⚠️ No extractable text");

  const header = `[Document Analysis]\n${meta.join(" · ")}\n${doc.notice ? `Note: ${doc.notice}\n` : ""}\n--- Document Content ---\n`;
  return header + (doc.text || "[No text extracted]");
}

/** Check if a file is a supported document format. */
export function isSupportedDocument(filename: string, mimeType: string): boolean {
  return detectDocumentFormat(filename, mimeType) !== "unknown";
}
