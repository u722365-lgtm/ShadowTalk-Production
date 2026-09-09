import { useState, useCallback, lazy, Suspense, useRef, useEffect } from "react";
import {
  Play, Copy, Check, RotateCcw, Maximize2, Minimize2,
  Terminal, X, Code, Download, Loader2, Bug, Eye,
  PanelLeft, Trash2, Save, FileCode, Layout,
  Plus, FolderOpen, Search, Settings, Sparkles,
  FileText, File, ChevronRight, ChevronDown,
  Columns, Monitor, Smartphone, Tablet,
  Palette, Zap, GitBranch, Package, RefreshCw,
  ExternalLink, Split, ArrowRight, Wand2, Bot, Share2
} from "lucide-react";
import { JulesPanel } from "@/components/ide/JulesPanel";
import type { ParsedFileChange } from "@/lib/jules/types";
import { Button } from "@/components/ui/button";
// Tabs removed - using conditional rendering for full-height panels
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { runLocalIdeAssist } from "@/lib/ide/localIdeAssist";

const Editor = lazy(() => import("@monaco-editor/react"));

// ─── Types ───────────────────────────────────────────────────────────────────

interface IDEFile {
  id: string;
  name: string;
  language: string;
  content: string;
  isModified: boolean;
}

interface ConsoleLog {
  type: "log" | "error" | "warn" | "info" | "system";
  message: string;
  timestamp: Date;
}

export interface IDEInitialProject {
  title?: string;
  platform?: "web" | "mobile";
  files: Array<{ name: string; language: string; content: string }>;
}

interface PersonalIDEProps {
  initialCode?: string;
  language?: string;
  /** Full multi-file project from App Builder */
  initialProject?: IDEInitialProject;
  onClose: () => void;
  /** Which bottom panel to show first (e.g. preview for HTML from chat). */
  defaultOutputPanel?: "console" | "preview" | "terminal" | "jules";
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  js: "javascript", ts: "typescript", py: "python", html: "html",
  css: "css", jsx: "javascript", tsx: "typescript", json: "json",
  md: "markdown", sql: "sql", sh: "shell", bash: "shell",
  xml: "xml", yaml: "yaml", scss: "scss", less: "less",
  php: "php", rb: "ruby", go: "go", rs: "rust", java: "java",
};

const EXT_MAP: Record<string, string> = {
  javascript: "js", typescript: "ts", python: "py", html: "html",
  css: "css", json: "json", markdown: "md", sql: "sql",
};

const FILE_ICONS: Record<string, string> = {
  html: "🌐", css: "🎨", javascript: "⚡", typescript: "💎",
  python: "🐍", json: "📋", markdown: "📝", sql: "🗄️",
  default: "📄",
};

const THEMES = [
  { id: "vs-dark", label: "Dark (Default)" },
  { id: "vs-light", label: "Light" },
  { id: "hc-black", label: "High Contrast" },
];

const VIEWPORT_PRESETS = [
  { id: "desktop", icon: Monitor, width: "100%", label: "Desktop" },
  { id: "tablet", icon: Tablet, width: "768px", label: "Tablet" },
  { id: "mobile", icon: Smartphone, width: "375px", label: "Mobile" },
];

const PROJECT_TEMPLATES = [
  {
    id: "blank", label: "Blank Project",
    files: [{ name: "index.html", language: "html", content: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>My Project</title>\n  <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src=\"app.js\"></script>\n</body>\n</html>" },
      { name: "style.css", language: "css", content: "* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: #0f172a;\n  color: #e2e8f0;\n}\n\nh1 {\n  font-size: 3rem;\n  background: linear-gradient(135deg, #6366f1, #a855f7);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}" },
      { name: "app.js", language: "javascript", content: "// Your JavaScript code here\nconsole.log('Hello from ShadowTalk IDE!');\n\ndocument.addEventListener('DOMContentLoaded', () => {\n  console.log('DOM ready');\n});" }],
  },
];

// AI assist actions for context menu
const AI_ACTIONS = [
  { id: "explain", label: "Explain Code", icon: "💡", prompt: "Explain this code in detail, line by line:" },
  { id: "refactor", label: "Refactor", icon: "♻️", prompt: "Refactor this code for better readability and performance:" },
  { id: "optimize", label: "Optimize", icon: "⚡", prompt: "Optimize this code for better performance:" },
  { id: "fix", label: "Fix Bugs", icon: "🐛", prompt: "Find and fix any bugs in this code:" },
  { id: "test", label: "Write Tests", icon: "🧪", prompt: "Write comprehensive unit tests for this code:" },
  { id: "document", label: "Add Docs", icon: "📝", prompt: "Add JSDoc documentation comments to this code:" },
  { id: "convert", label: "Convert to TS", icon: "💎", prompt: "Convert this JavaScript code to TypeScript with proper types:" },
  { id: "security", label: "Security Check", icon: "🔒", prompt: "Review this code for security vulnerabilities and fix them:" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createFile = (name: string, language: string, content: string): IDEFile => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); })),
  name,
  language: LANG_MAP[language.toLowerCase()] || language.toLowerCase(),
  content,
  isModified: false,
});

const getFileIcon = (lang: string) => FILE_ICONS[lang] || FILE_ICONS.default;

// ─── Component ───────────────────────────────────────────────────────────────

export const PersonalIDE = ({
  initialCode,
  language,
  initialProject,
  onClose,
  defaultOutputPanel = "preview",
}: PersonalIDEProps) => {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Determine initial files
  const getInitialFiles = (): IDEFile[] => {
    if (initialProject?.files?.length) {
      return initialProject.files.map((f) =>
        createFile(f.name, f.language, f.content),
      );
    }
    if (initialCode && language) {
      const lang = LANG_MAP[language.toLowerCase()] || language.toLowerCase();
      return [createFile(`main.${EXT_MAP[lang] || "txt"}`, lang, initialCode)];
    }
    return PROJECT_TEMPLATES[0].files.map(f => createFile(f.name, f.language, f.content));
  };

  const [files, setFiles] = useState<IDEFile[]>(getInitialFiles);
  const [activeFileId, setActiveFileId] = useState(files[0]?.id || "");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showExplorer, setShowExplorer] = useState(false);
  const [outputPanel, setOutputPanel] = useState<"console" | "preview" | "terminal" | "jules">(
    defaultOutputPanel,
  );
  const [theme, setTheme] = useState("vs-dark");
  const [previewHtml, setPreviewHtml] = useState("");
  const [viewportPreset, setViewportPreset] = useState(
    initialProject?.platform === "mobile" ? "mobile" : "desktop",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!initialCode && !initialProject?.files?.length);
  const [isAIAssisting, setIsAIAssisting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showAIMenu, setShowAIMenu] = useState(false);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  const activeFile = files.find(f => f.id === activeFileId);

  // ─── File Operations ──────────────────────────────────────────────────────

  const updateFileContent = useCallback((fileId: string, content: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content, isModified: true } : f));
  }, []);

  const addNewFile = useCallback(() => {
    const ext = prompt("File name (e.g. utils.js):");
    if (!ext) return;
    const lang = LANG_MAP[ext.split(".").pop() || ""] || "plaintext";
    const newFile = createFile(ext, lang, `// ${ext}\n`);
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, []);

  const closeFile = useCallback((fileId: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      if (activeFileId === fileId && updated.length > 0) {
        setActiveFileId(updated[0].id);
      }
      return updated;
    });
  }, [activeFileId]);

  const deleteFile = useCallback((fileId: string) => {
    if (files.length <= 1) {
      toast({ title: "Cannot delete the last file", variant: "destructive" });
      return;
    }
    closeFile(fileId);
  }, [files.length, closeFile, toast]);

  // ─── Console ──────────────────────────────────────────────────────────────

  const addLog = useCallback((type: ConsoleLog["type"], message: string) => {
    setConsoleLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  }, []);

  const clearConsole = useCallback(() => setConsoleLogs([]), []);

  const applyJulesChanges = useCallback((changes: ParsedFileChange[]) => {
    setFiles((prev) => {
      const next = [...prev];
      for (const change of changes) {
        const basename = change.path.split("/").pop() ?? change.path;
        const idx = next.findIndex((f) => f.name === change.path || f.name === basename);
        if (idx >= 0) {
          next[idx] = { ...next[idx], content: change.content, isModified: true };
        } else {
          const lang = LANG_MAP[basename.split(".").pop() || ""] || "plaintext";
          next.push(createFile(basename, lang, change.content));
        }
      }
      return next;
    });
    addLog("system", `✅ Jules applied ${changes.length} file change${changes.length === 1 ? "" : "s"}`);
    toast({ title: `Jules applied ${changes.length} file${changes.length === 1 ? "" : "s"}` });
  }, [addLog, toast]);

  // ─── Execution ────────────────────────────────────────────────────────────

  const handleRun = useCallback(() => {
    setIsRunning(true);
    clearConsole();
    addLog("system", "▶ Building project...");

    setTimeout(() => {
      // Find HTML entry point
      const htmlFile = files.find(f => f.language === "html") || files.find(f => f.name === "index.html");
      const cssFiles = files.filter(f => f.language === "css");
      const jsFiles = files.filter(f => ["javascript", "typescript"].includes(f.language));

      if (htmlFile) {
        let html = htmlFile.content;

        // Inject CSS files
        cssFiles.forEach(css => {
          const linkTag = `<link rel="stylesheet" href="${css.name}">`;
          if (html.includes(linkTag)) {
            html = html.replace(linkTag, `<style>/* ${css.name} */\n${css.content}</style>`);
          } else if (!html.includes(css.content)) {
            html = html.replace("</head>", `<style>/* ${css.name} */\n${css.content}</style>\n</head>`);
          }
        });

        // Inject JS files
        jsFiles.forEach(js => {
          if (js.id === htmlFile.id) return; // Skip if same file
          const scriptTag = `<script src="${js.name}"></script>`;
          if (html.includes(scriptTag)) {
            html = html.replace(scriptTag, `<script>/* ${js.name} */\n${js.content}</script>`);
          } else if (!html.includes(js.content)) {
            html = html.replace("</body>", `<script>/* ${js.name} */\n${js.content}</script>\n</body>`);
          }
        });

        setPreviewHtml(html);
        setOutputPanel("preview");
        addLog("system", "✅ Build successful");
        addLog("info", `📄 Entry: ${htmlFile.name} | CSS: ${cssFiles.length} files | JS: ${jsFiles.length} files`);
      } else if (jsFiles.length > 0) {
        // Execute JS directly
        const code = jsFiles.map(f => f.content).join("\n\n");
        const mockConsole = {
          log: (...args: unknown[]) => addLog("log", args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")),
          error: (...args: unknown[]) => addLog("error", args.map(a => String(a)).join(" ")),
          warn: (...args: unknown[]) => addLog("warn", args.map(a => String(a)).join(" ")),
          info: (...args: unknown[]) => addLog("info", args.map(a => String(a)).join(" ")),
        };
        try {
          const fn = new Function("console", code);
          const result = fn(mockConsole);
          if (result !== undefined) addLog("log", `→ ${JSON.stringify(result, null, 2)}`);
          addLog("system", "✅ Execution complete");
        } catch (error) {
          addLog("error", error instanceof Error ? error.message : "Unknown error");
        }
        setOutputPanel("console");
      } else {
        addLog("warn", "No runnable files found. Add an HTML or JS file.");
      }

      setIsRunning(false);
    }, 300);
  }, [files, addLog, clearConsole]);

  // ─── AI Code Assist ───────────────────────────────────────────────────────

  const runAIAction = useCallback(async (instruction: string, isCodeAction = true) => {
    if (!activeFile) return;

    setIsAIAssisting(true);
    setShowAIMenu(false);
    addLog("system", `🤖 On-device AI: "${instruction}"`);

    try {
      const workspaceFiles = files.map((f) => ({
        name: f.name,
        content: f.content,
        language: f.language,
      }));

      let cleanResult = (
        await runLocalIdeAssist(instruction, workspaceFiles, activeFile.name, isCodeAction)
      ).trim();
      const fenceMatch = cleanResult.match(/^```\w*\n([\s\S]*)\n```$/);
      if (fenceMatch) cleanResult = fenceMatch[1];

      if (isCodeAction && cleanResult) {
        updateFileContent(activeFile.id, cleanResult);
        addLog("system", "✅ AI code applied successfully");
        toast({ title: "AI code applied" });
      } else if (cleanResult) {
        addLog("info", cleanResult);
        setOutputPanel("console");
        toast({ title: "AI response ready — see console" });
      }
    } catch (error) {
      addLog("error", `AI failed: ${error instanceof Error ? error.message : "Unknown"}`);
      toast({ title: "AI assist failed", variant: "destructive" });
    } finally {
      setIsAIAssisting(false);
    }
  }, [activeFile, files, addLog, updateFileContent, toast]);

  const handleAIAssist = useCallback(async () => {
    if (!activeFile) return;
    const instruction = prompt("What should the AI do with this code?");
    if (!instruction) return;
    runAIAction(instruction);
  }, [activeFile, runAIAction]);

  // ─── Terminal Emulator ────────────────────────────────────────────────────

  const handleTerminalCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    
    setTerminalHistory(prev => [...prev, `$ ${trimmed}`]);
    
    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case "help":
        setTerminalHistory(prev => [...prev, "Available commands: ls, cat, touch, rm, clear, echo, pwd, whoami, date, node, npm, help"]);
        break;
      case "ls":
        setTerminalHistory(prev => [...prev, files.map(f => f.name).join("  ")]);
        break;
      case "cat":
        const file = files.find(f => f.name === args[0]);
        if (file) setTerminalHistory(prev => [...prev, file.content.slice(0, 500) + (file.content.length > 500 ? "\n..." : "")]);
        else setTerminalHistory(prev => [...prev, `cat: ${args[0]}: No such file`]);
        break;
      case "touch": {
        if (args[0]) {
          const lang = LANG_MAP[args[0].split(".").pop() || ""] || "plaintext";
          const newFile = createFile(args[0], lang, `// ${args[0]}\n`);
          setFiles(prev => [...prev, newFile]);
          setTerminalHistory(prev => [...prev, `Created ${args[0]}`]);
        } else setTerminalHistory(prev => [...prev, "Usage: touch <filename>"]);
        break;
      }
      case "rm": {
        if (args[0]) {
          const target = files.find(f => f.name === args[0]);
          if (target && files.length > 1) {
            closeFile(target.id);
            setTerminalHistory(prev => [...prev, `Removed ${args[0]}`]);
          } else if (!target) setTerminalHistory(prev => [...prev, `rm: ${args[0]}: No such file`]);
          else setTerminalHistory(prev => [...prev, "Cannot remove the last file"]);
        }
        break;
      }
      case "clear":
        setTerminalHistory([]);
        break;
      case "echo":
        setTerminalHistory(prev => [...prev, args.join(" ")]);
        break;
      case "pwd":
        setTerminalHistory(prev => [...prev, "/home/shadowtalk/project"]);
        break;
      case "whoami":
        setTerminalHistory(prev => [...prev, "shadowtalk-developer"]);
        break;
      case "date":
        setTerminalHistory(prev => [...prev, new Date().toString()]);
        break;
      case "node":
      case "npm":
        setTerminalHistory(prev => [...prev, `${command}: Use the Run button (Ctrl+S) to execute code in the browser`]);
        break;
      default:
        setTerminalHistory(prev => [...prev, `${command}: command not found. Type 'help' for available commands.`]);
    }
  }, [files, closeFile]);

  // ─── Template Loading ─────────────────────────────────────────────────────

  const loadTemplate = useCallback((templateId: string) => {
    const template = PROJECT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const newFiles = template.files.map(f => createFile(f.name, f.language, f.content));
    setFiles(newFiles);
    setActiveFileId(newFiles[0].id);
    setShowTemplates(false);
    clearConsole();
    setPreviewHtml("");
    toast({ title: `Loaded: ${template.label}` });
  }, [clearConsole, toast]);

  // ─── Download Project ─────────────────────────────────────────────────────

  const downloadProject = useCallback(() => {
    files.forEach(file => {
      const blob = new Blob([file.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
    toast({ title: `Downloaded ${files.length} files` });
  }, [files, toast]);

  // ─── Copy All ─────────────────────────────────────────────────────────────

  const copyActiveFile = useCallback(async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    toast({ title: "Copied!" });
    setTimeout(() => setCopied(false), 2000);
  }, [activeFile, toast]);

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        addNewFile();
      }
      if (e.key === "Escape") {
        if (showSearch) setShowSearch(false);
        else if (showSettings) setShowSettings(false);
        else if (showTemplates) setShowTemplates(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRun, addNewFile, showSearch, showSettings, showTemplates]);

  // ─── Log Styling ──────────────────────────────────────────────────────────

  const getLogStyle = (type: ConsoleLog["type"]) => {
    switch (type) {
      case "error": return "text-red-400 bg-red-500/10";
      case "warn": return "text-yellow-400 bg-yellow-500/10";
      case "info": return "text-blue-400 bg-blue-500/10";
      case "system": return "text-emerald-400 bg-emerald-500/10";
      default: return "text-foreground/80";
    }
  };

  const getLogIcon = (type: ConsoleLog["type"]) => {
    switch (type) {
      case "error": return "❌";
      case "warn": return "⚠️";
      case "info": return "ℹ️";
      case "system": return "⚙️";
      default: return "›";
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const viewport = VIEWPORT_PRESETS.find(v => v.id === viewportPreset)!;

  return (
    <div className={cn(
      "fixed bg-background z-50 flex flex-col overflow-hidden border border-border shadow-2xl transition-all duration-300",
      isFullscreen ? "inset-0" : "inset-3 rounded-xl"
    )}>
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80 cursor-pointer hover:bg-red-500" onClick={onClose} />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 cursor-pointer hover:bg-yellow-500" onClick={() => setIsFullscreen(!isFullscreen)} />
            <div className="w-3 h-3 rounded-full bg-green-500/80 cursor-pointer hover:bg-green-500" onClick={handleRun} />
          </div>
          <Code className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">ShadowTalk IDE</span>
          <Badge variant="secondary" className="text-[10px] h-5">Pro</Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={outputPanel === "jules" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setOutputPanel("jules")}
            className="h-7 px-2 gap-1 text-xs text-violet-400"
            title="On-device code agent — zero cloud upload"
          >
            <Bot className="h-3 w-3" />
            <span className="hidden sm:inline">Agent</span>
          </Button>

          {/* AI Assist with dropdown */}
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={handleAIAssist} disabled={isAIAssisting} className="h-7 px-2 gap-1 text-xs">
              {isAIAssisting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              <span className="hidden sm:inline">AI</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAIMenu(!showAIMenu)} className="h-7 px-1 text-xs">
              <ChevronDown className="h-3 w-3" />
            </Button>
            <AnimatePresence>
              {showAIMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 w-48 py-1"
                >
                  {AI_ACTIONS.map(action => (
                    <button
                      key={action.id}
                      onClick={() => runAIAction(action.prompt, action.id !== "explain")}
                      disabled={isAIAssisting}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left"
                    >
                      <span>{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="w-px h-4 bg-border mx-0.5" />

          <Button variant="default" size="sm" onClick={handleRun} disabled={isRunning} className="h-7 px-3 gap-1 text-xs">
            <Play className={cn("h-3 w-3", isRunning && "animate-pulse")} />
            {isRunning ? "Building..." : "Run"}
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button variant="ghost" size="sm" onClick={() => setShowExplorer(!showExplorer)} className="h-7 px-2">
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSearch(!showSearch)} className="h-7 px-2">
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={copyActiveFile} className="h-7 px-2">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadProject} className="h-7 px-2">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const text = encodeURIComponent("I'm building an app autonomously with ShadowTalk AI! Try it out:");
            const url = encodeURIComponent("https://www.shadowtalk-ai.com/");
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}&via=shadowtalk_ai`, '_blank');
          }} className="h-7 px-2 text-blue-400 hover:text-blue-500 hover:bg-blue-500/10">
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="h-7 px-2">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTemplates(true)} className="h-7 px-2">
            <Layout className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="h-7 px-2">
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Search Bar ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search in files... (Ctrl+F)"
                className="h-7 text-sm flex-1"
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={() => setShowSearch(false)} className="h-7 px-2">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Settings Panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border overflow-hidden"
          >
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Theme:</span>
                {THEMES.map(t => (
                  <Button key={t.id} variant={theme === t.id ? "secondary" : "ghost"} size="sm" onClick={() => setTheme(t.id)} className="h-6 px-2 text-[11px]">
                    {t.label}
                  </Button>
                ))}
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Preview:</span>
                {VIEWPORT_PRESETS.map(v => (
                  <Button key={v.id} variant={viewportPreset === v.id ? "secondary" : "ghost"} size="sm" onClick={() => setViewportPreset(v.id)} className="h-6 px-2 text-[11px] gap-1">
                    <v.icon className="h-3 w-3" />
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">

          {/* ─── File Explorer ──────────────────────────────────────────── */}
          {showExplorer && (
            <>
              <ResizablePanel defaultSize={15} minSize={12} maxSize={25}>
                <div className="h-full flex flex-col bg-muted/20">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
                    <Button variant="ghost" size="sm" onClick={addNewFile} className="h-6 w-6 p-0">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="py-1">
                      {files.map(file => (
                        <div
                          key={file.id}
                          onClick={() => setActiveFileId(file.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm group transition-colors",
                            activeFileId === file.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <span className="text-xs">{getFileIcon(file.language)}</span>
                          <span className="flex-1 truncate text-xs">{file.name}</span>
                          {file.isModified && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => { e.stopPropagation(); deleteFile(file.id); }}
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Quick Info */}
                  <div className="border-t border-border px-3 py-2">
                    <div className="text-[10px] text-muted-foreground space-y-1">
                      <div className="flex justify-between"><span>Files</span><span>{files.length}</span></div>
                      <div className="flex justify-between"><span>Lines</span><span>{files.reduce((a, f) => a + f.content.split("\n").length, 0)}</span></div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* ─── Editor Panel ───────────────────────────────────────────── */}
          <ResizablePanel defaultSize={showExplorer ? 40 : 50} minSize={25}>
            <div className="h-full flex flex-col">
              {/* File Tabs */}
              <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
                {files.map(file => (
                  <div
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border cursor-pointer transition-colors group shrink-0",
                      activeFileId === file.id ? "bg-background text-foreground border-b-2 border-b-primary" : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="text-[10px]">{getFileIcon(file.language)}</span>
                    <span>{file.name}</span>
                    {file.isModified && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    {files.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); closeFile(file.id); }}
                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addNewFile} className="px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full bg-background">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading editor...</span>
                  </div>
                }>
                  {activeFile && (
                    <Editor
                      key={activeFile.id}
                      height="100%"
                      language={activeFile.language}
                      value={activeFile.content}
                      onChange={value => updateFileContent(activeFile.id, value || "")}
                      theme={theme}
                      options={{
                        minimap: { enabled: true, scale: 2 },
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontLigatures: true,
                        lineNumbers: "on",
                        wordWrap: "on",
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        tabSize: 2,
                        padding: { top: 12, bottom: 12 },
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        folding: true,
                        foldingHighlight: true,
                        showFoldingControls: "always",
                        suggest: { showMethods: true, showFunctions: true, showConstructors: true, showFields: true, showVariables: true, showClasses: true, showStructs: true, showInterfaces: true, showModules: true, showProperties: true, showEvents: true, showOperators: true, showUnits: true, showValues: true, showConstants: true, showEnums: true, showEnumMembers: true, showKeywords: true, showWords: true, showColors: true, showFiles: true, showReferences: true, showFolders: true, showTypeParameters: true, showSnippets: true },
                        quickSuggestions: { other: true, comments: false, strings: true },
                        parameterHints: { enabled: true },
                        formatOnPaste: true,
                        formatOnType: true,
                      }}
                    />
                  )}
                </Suspense>
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between px-3 py-1 bg-primary/10 border-t border-border text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>{activeFile?.language || "plaintext"}</span>
                  <span>UTF-8</span>
                  <span>Spaces: 2</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Ln {activeFile?.content.split("\n").length || 0}</span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> ShadowTalk IDE
                  </span>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ─── Output / Preview Panel ──────────────────────────────────── */}
          <ResizablePanel defaultSize={showExplorer ? 45 : 50} minSize={20}>
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-1">
                  <Button variant={outputPanel === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setOutputPanel("preview")} className="text-xs gap-1 h-6 px-2">
                    <Eye className="h-3 w-3" /> Preview
                  </Button>
                  <Button variant={outputPanel === "console" ? "secondary" : "ghost"} size="sm" onClick={() => setOutputPanel("console")} className="text-xs gap-1 h-6 px-2">
                    <Bug className="h-3 w-3" /> Console
                    {consoleLogs.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">{consoleLogs.length}</Badge>
                    )}
                  </Button>
                  <Button variant={outputPanel === "terminal" ? "secondary" : "ghost"} size="sm" onClick={() => setOutputPanel("terminal")} className="text-xs gap-1 h-6 px-2">
                    <Terminal className="h-3 w-3" /> Terminal
                  </Button>
                  <Button variant={outputPanel === "jules" ? "secondary" : "ghost"} size="sm" onClick={() => setOutputPanel("jules")} className="text-xs gap-1 h-6 px-2 text-emerald-400">
                    <Bot className="h-3 w-3" /> Agent
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  {outputPanel === "preview" && previewHtml && (
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => {
                      const w = window.open("", "_blank");
                      if (w) { w.document.write(previewHtml); w.document.close(); }
                    }}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { clearConsole(); setPreviewHtml(""); setTerminalHistory([]); }} className="h-6 px-2">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRun} className="h-6 px-2">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {outputPanel === "preview" && (
                  <div className="h-full w-full overflow-hidden">
                    {previewHtml ? (
                      <iframe
                        ref={iframeRef}
                        srcDoc={previewHtml}
                        className="w-full h-full bg-white border-0"
                        style={{ width: viewport.width, maxWidth: "100%" }}
                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
                        title="Preview"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background">
                        <Monitor className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm font-medium">No preview available</p>
                        <p className="text-xs mt-1 opacity-70">Click <strong>Run</strong> or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+S</kbd> to build</p>
                      </div>
                    )}
                  </div>
                )}

                {outputPanel === "console" && (
                  <ScrollArea className="h-full bg-zinc-950">
                    <div className="p-3 font-mono text-xs space-y-0.5">
                      {consoleLogs.length === 0 ? (
                        <div className="text-muted-foreground text-center py-12">
                          <Bug className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">Console output will appear here</p>
                          <p className="text-xs mt-1 opacity-70">Run your project to see output</p>
                        </div>
                      ) : consoleLogs.map((log, i) => (
                        <div key={i} className={cn("flex items-start gap-2 px-2 py-1 rounded", getLogStyle(log.type))}>
                          <span className="shrink-0">{getLogIcon(log.type)}</span>
                          <pre className="whitespace-pre-wrap break-all flex-1">{log.message}</pre>
                          <span className="text-[9px] opacity-40 shrink-0">{log.timestamp.toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {outputPanel === "terminal" && (
                  <div className="h-full flex flex-col">
                    <ScrollArea className="flex-1 bg-zinc-950">
                      <div className="p-3 font-mono text-xs space-y-0.5">
                        <div className="text-emerald-400 mb-2">ShadowTalk Terminal v1.0 — Type 'help' for commands</div>
                        {terminalHistory.map((line, i) => (
                          <div key={i} className={cn("px-1", line.startsWith("$") ? "text-sky-400" : "text-foreground/80")}>
                            {line}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-zinc-950 font-mono text-xs">
                      <span className="text-emerald-400 shrink-0">$</span>
                      <input
                        ref={terminalInputRef}
                        value={terminalInput}
                        onChange={e => setTerminalInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            handleTerminalCommand(terminalInput);
                            setTerminalInput("");
                          }
                        }}
                        placeholder="Type a command..."
                        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}

                {outputPanel === "jules" && (
                  <JulesPanel
                    files={files.map((f) => ({ name: f.name, content: f.content, language: f.language }))}
                    activeFileName={activeFile?.name}
                    onApplyChanges={applyJulesChanges}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ─── Template Picker Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-sm z-10 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Start a New Project</h3>
                  <p className="text-sm text-muted-foreground">Choose a template or start from scratch</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PROJECT_TEMPLATES.map(template => {
                  const icons: Record<string, string> = { blank: "📄", react: "⚛️", dashboard: "📊", landing: "🚀", saas: "💼", ecommerce: "🛒", portfolio: "🎨", api: "🔌" };
                  return (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template.id)}
                      className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
                    >
                      <div className="text-2xl mb-2">{icons[template.id] || "📄"}</div>
                      <p className="font-medium text-sm">{template.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{template.files.length} file{template.files.length > 1 ? "s" : ""}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  ⌨️ Shortcuts: <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+S</kbd> Run · <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+N</kbd> New File · <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+F</kbd> Search
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PersonalIDE;
