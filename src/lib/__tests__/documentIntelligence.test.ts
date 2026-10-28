/**
 * Tests for Document Intelligence module.
 * Tests text extraction for PDF, DOCX, TXT, and edge cases.
 * PDF/DOCX tests use small inline fixtures — no real provider calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pdfjs-dist + mammoth so tests don't need real binaries
vi.mock("pdfjs-dist/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  version: "6.4.299",
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: (n: number) => Promise.resolve({
        getTextContent: () => Promise.resolve({
          items: [{ str: `Page ${n} content here. ` }, { str: "More text." }],
        }),
      }),
    }),
  })),
}));

vi.mock("mammoth/mammoth.browser", () => ({
  extractRawText: vi.fn(() => Promise.resolve({
    value: "DOCX extracted text. This is paragraph one. This is paragraph two.",
  })),
}));

import { detectDocumentFormat, validateFileSize, extractDocument, formatDocumentForChat, isSupportedDocument } from "../documentIntelligence";

describe("Document Intelligence", () => {
  describe("detectDocumentFormat", () => {
    it("detects PDF by extension", () => {
      expect(detectDocumentFormat("report.pdf", "application/pdf")).toBe("pdf");
    });
    it("detects DOCX by extension", () => {
      expect(detectDocumentFormat("doc.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    });
    it("detects TXT", () => {
      expect(detectDocumentFormat("notes.txt", "text/plain")).toBe("txt");
    });
    it("detects Markdown", () => {
      expect(detectDocumentFormat("readme.md", "text/markdown")).toBe("md");
    });
    it("detects CSV", () => {
      expect(detectDocumentFormat("data.csv", "text/csv")).toBe("csv");
    });
    it("detects JSON", () => {
      expect(detectDocumentFormat("config.json", "application/json")).toBe("json");
    });
    it("detects code files", () => {
      expect(detectDocumentFormat("app.ts", "")).toBe("code");
      expect(detectDocumentFormat("main.py", "")).toBe("code");
      expect(detectDocumentFormat("style.css", "")).toBe("code");
    });
    it("returns unknown for unsupported formats", () => {
      expect(detectDocumentFormat("file.xyz", "application/octet-stream")).toBe("unknown");
    });
  });

  describe("validateFileSize", () => {
    it("passes for files under the limit", () => {
      expect(validateFileSize({ size: 1024 }, 1024 * 1024).ok).toBe(true);
    });
    it("fails for files over the limit", () => {
      const result = validateFileSize({ size: 2 * 1024 * 1024 }, 1024 * 1024);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("too large");
    });
  });

  describe("isSupportedDocument", () => {
    it("returns true for PDF", () => {
      expect(isSupportedDocument("file.pdf", "application/pdf")).toBe(true);
    });
    it("returns true for DOCX", () => {
      expect(isSupportedDocument("file.docx", "")).toBe(true);
    });
    it("returns false for unknown", () => {
      expect(isSupportedDocument("file.xyz", "")).toBe(false);
    });
  });

  describe("extractDocument", () => {
    it("extracts text from a TXT file", async () => {
      const text = "Hello, this is a test document.";
      const dataUrl = `data:text/plain;base64,${btoa(text)}`;
      const result = await extractDocument(dataUrl, "test.txt", "text/plain");
      expect(result.format).toBe("txt");
      expect(result.text).toContain("Hello, this is a test document.");
      expect(result.empty).toBe(false);
      expect(result.truncated).toBe(false);
    });

    it("handles empty TXT files", async () => {
      const dataUrl = `data:text/plain;base64,${btoa("")}`;
      const result = await extractDocument(dataUrl, "empty.txt", "text/plain");
      expect(result.empty).toBe(true);
      expect(result.notice).toContain("empty");
    });

    it("extracts text from a PDF (mocked)", async () => {
      const dataUrl = "data:application/pdf;base64,JVBERi0xLjQKJcfsj6I="; // minimal
      const result = await extractDocument(dataUrl, "test.pdf", "application/pdf");
      expect(result.format).toBe("pdf");
      expect(result.pageCount).toBe(3);
      expect(result.text).toContain("Page 1 content");
      expect(result.text).toContain("Page 2 content");
      expect(result.text).toContain("Page 3 content");
    });

    it("extracts text from a DOCX (mocked)", async () => {
      const dataUrl = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBA==";
      const result = await extractDocument(dataUrl, "test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(result.format).toBe("docx");
      expect(result.text).toContain("DOCX extracted text");
    });

    it("returns error for unsupported format", async () => {
      const result = await extractDocument("data:application/octet-stream;base64,", "file.xyz", "application/octet-stream");
      expect(result.format).toBe("unknown");
      expect(result.empty).toBe(true);
      expect(result.notice).toContain("Unsupported file format");
    });

    it("truncates long text", async () => {
      const longText = "A".repeat(600000);
      const dataUrl = `data:text/plain;base64,${btoa(longText)}`;
      const result = await extractDocument(dataUrl, "big.txt", "text/plain", { maxTextLength: 100000 });
      expect(result.truncated).toBe(true);
      expect(result.notice).toContain("truncated");
      expect(result.text.length).toBeLessThanOrEqual(100000);
    });
  });

  describe("formatDocumentForChat", () => {
    it("formats a document with metadata", () => {
      const doc = {
        text: "Document content here.",
        filename: "report.pdf",
        format: "pdf" as const,
        pageCount: 5,
        truncated: false,
        empty: false,
      };
      const formatted = formatDocumentForChat(doc);
      expect(formatted).toContain("[Document Analysis]");
      expect(formatted).toContain("File: report.pdf");
      expect(formatted).toContain("Format: PDF");
      expect(formatted).toContain("Pages: 5");
      expect(formatted).toContain("Document content here.");
    });

    it("includes notice when present", () => {
      const doc = {
        text: "",
        filename: "scanned.pdf",
        format: "pdf" as const,
        truncated: false,
        empty: true,
        notice: "Scanned PDF — no text layer.",
      };
      const formatted = formatDocumentForChat(doc);
      expect(formatted).toContain("Scanned PDF — no text layer.");
    });
  });
});
