import type { LucideIcon } from "lucide-react";
import {
  Home,
  MessageSquare,
  Brain,
  Network,
  Sparkles,
  Lock,
  Code2,
  BookOpen,
  User,
} from "lucide-react";

export interface ChatSidebarNavItem {
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
  section: "workspace" | "explore";
  badge?: string;
}

export const CHAT_SIDEBAR_NAV: ChatSidebarNavItem[] = [
  // Workspace section
  { label: "Chatbot", icon: MessageSquare, to: "/chatbot", end: true, section: "workspace" },
  { label: "Home", icon: Home, to: "/home", end: true, section: "workspace" },

  // Explore section — only pages with active routes
  { label: "Shadow Twin", icon: Brain, to: "/shadow-twin", section: "explore" },
  { label: "Knowledge Graph", icon: Network, to: "/knowledge-graph", section: "explore" },
  { label: "Private AI Hub", icon: Lock, to: "/private-ai", section: "explore" },
  { label: "Developer API", icon: Code2, to: "/developers", section: "explore" },
  { label: "Pricing & Plans", icon: Sparkles, to: "/pricing", section: "explore" },
  { label: "Docs & Guides", icon: BookOpen, to: "/docs", section: "explore" },
  { label: "Founder Story", icon: User, to: "/founder", section: "explore" },
];

export const CHAT_SIDEBAR_WIDTH_EXPANDED = 268;
export const CHAT_SIDEBAR_WIDTH_COLLAPSED = 76;
