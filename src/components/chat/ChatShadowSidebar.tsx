import { useNavigate } from "react-router-dom";
import { motion, LayoutGroup } from "framer-motion";
import {
  Menu,
  Plus,
  MessageSquare,
  Trash2,
  Archive,
  Settings,
  Sparkles,
  Command,
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { settingsHapticTick } from "@/lib/settingsFeedback";
import { CHAT_SIDEBAR_WIDTH_COLLAPSED, CHAT_SIDEBAR_WIDTH_EXPANDED } from "@/lib/chatSidebarNav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InstalledAgentsPanel } from "@/components/marketplace/InstalledAgentsPanel";
import { ChatSidebarNavList } from "@/components/chat/ChatSidebarNavList";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  archived_at?: string | null;
}

interface ChatShadowSidebarProps {
  userInitials: string;
  userDisplayName: string;
  onNewChat: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileDrawer?: boolean;
  forceExpanded?: boolean;
  onNavigate?: () => void;

  conversations?: Conversation[];
  currentConversationId?: string | null;
  isArchived?: (conversation: Conversation) => boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onOpenSettings?: () => void;
}

function cleanProfileName(raw: string): string {
  if (!raw || raw.trim() === "" || raw.toLowerCase() === "there") {
    return "User";
  }
  const first = raw.trim().split(" ")[0].split("@")[0];
  const cleaned = first.replace(/\d+$/, "");
  const target = cleaned.length >= 2 ? cleaned : first;
  return target.charAt(0).toUpperCase() + target.slice(1);
}

const SIDEBAR_EASE = [0.2, 0.8, 0.2, 1] as const;

function ChatShadowSidebarInner({
  userInitials,
  userDisplayName,
  onNewChat,
  collapsed = false,
  onToggleCollapse,
  mobileDrawer = false,
  forceExpanded = false,
  onNavigate,
  conversations = [],
  currentConversationId,
  isArchived = () => false,
  onSelect,
  onDelete,
  onArchive,
  onOpenSettings,
}: ChatShadowSidebarProps) {
  const navigate = useNavigate();
  const isCollapsed = forceExpanded ? false : collapsed;
  const width = isCollapsed ? CHAT_SIDEBAR_WIDTH_COLLAPSED : CHAT_SIDEBAR_WIDTH_EXPANDED;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const formattedName = useMemo(() => cleanProfileName(userDisplayName), [userDisplayName]);
  const activeConversations = conversations.filter((c) => !isArchived(c));

  // Grouping logic
  const grouped = activeConversations.reduce((acc, conv) => {
    const date = new Date(conv.created_at);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    let group = "Earlier";
    if (days === 0) group = "Today";
    else if (days === 1) group = "Yesterday";
    else if (days < 7) group = "Previous 7 Days";
    else if (days < 30) group = "Previous 30 Days";

    if (!acc[group]) acc[group] = [];
    acc[group].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Earlier"];

  return (
    <TooltipProvider delayDuration={250}>
      <motion.aside
        initial={false}
        animate={{ width }}
        transition={{ duration: 0.28, ease: SIDEBAR_EASE }}
        className={cn(
          "shrink-0 flex flex-col relative z-30 overflow-hidden select-none will-change-[width]",
          mobileDrawer
            ? "flex h-full min-h-0 bg-[#070912]"
            : "hidden md:flex h-full min-h-0 bg-[#070a12]/95 border-r border-white/[0.08] backdrop-blur-2xl shadow-[4px_0_24px_rgba(0,0,0,0.4)]"
        )}
      >
        {/* Top Header: Hamburger, Brand Title & Pro Badge */}
        <div className="flex h-[60px] shrink-0 items-center px-3.5 gap-2.5 border-b border-white/[0.04] overflow-hidden">
          {onToggleCollapse && !mobileDrawer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    settingsHapticTick();
                    onToggleCollapse();
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-white/5 active:scale-95 transition-all"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <Menu className="h-4.5 w-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
            </Tooltip>
          )}

          <motion.div
            animate={{
              opacity: isCollapsed ? 0 : 1,
              x: isCollapsed ? -8 : 0,
            }}
            transition={{ duration: 0.2, ease: SIDEBAR_EASE }}
            className={cn(
              "flex items-center gap-2 overflow-hidden flex-1 whitespace-nowrap min-w-0",
              isCollapsed && "pointer-events-none"
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 via-indigo-500/20 to-purple-600/20 border border-cyan-500/30">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <span className="text-[16px] font-bold bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-transparent tracking-tight">
              ShadowTalk
            </span>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Pro
            </span>
          </motion.div>
        </div>

        {/* Action: New Chat Button */}
        <div className="px-3 pt-3 pb-2 shrink-0 overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                type="button"
                onClick={() => {
                  settingsHapticTick();
                  onNewChat();
                }}
                animate={{
                  width: isCollapsed ? 42 : "100%",
                }}
                transition={{ duration: 0.25, ease: SIDEBAR_EASE }}
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 0 20px rgba(6,182,212,0.2)",
                  borderColor: "rgba(6,182,212,0.4)",
                }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "group relative flex items-center rounded-xl overflow-hidden h-10 mx-auto",
                  "bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-purple-500/15",
                  "border border-cyan-500/30 text-cyan-200 hover:text-white",
                  isCollapsed ? "justify-center px-0" : "px-3.5 justify-between"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Plus className="h-4 w-4 shrink-0 text-cyan-400 group-hover:rotate-90 transition-transform duration-200" />
                  <motion.span
                    animate={{
                      opacity: isCollapsed ? 0 : 1,
                      width: isCollapsed ? 0 : "auto",
                    }}
                    transition={{ duration: 0.18, ease: SIDEBAR_EASE }}
                    className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-left"
                  >
                    New chat
                  </motion.span>
                </div>
                {!isCollapsed && (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/30 border border-white/10 text-[10px] text-cyan-300/70 font-mono">
                    <Command className="h-2.5 w-2.5" />K
                  </kbd>
                )}
              </motion.button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">New chat (⌘K)</TooltipContent>}
          </Tooltip>
        </div>

        {/* Scrollable Navigation & Recents List */}
        <ScrollArea className="flex-1 px-1.5 custom-scrollbar">
          <div className="pb-4 space-y-3">
            {/* Installed Agents Panel: smoothly collapses height & opacity */}
            <motion.div
              initial={false}
              animate={{
                opacity: isCollapsed ? 0 : 1,
                height: isCollapsed ? 0 : "auto",
              }}
              transition={{ duration: 0.22, ease: SIDEBAR_EASE }}
              className="overflow-hidden px-1.5 shrink-0"
              style={{ pointerEvents: isCollapsed ? "none" : "auto" }}
            >
              <InstalledAgentsPanel compact />
            </motion.div>

            {/* Primary Real-Feature Navigation — ALWAYS single mounted instance */}
            <div className="py-1">
              <ChatSidebarNavList collapsed={isCollapsed} onItemClick={onNavigate} />
            </div>

            {/* Recent Chats Section: smoothly collapses height & opacity */}
            {activeConversations.length > 0 && (
              <motion.div
                initial={false}
                animate={{
                  opacity: isCollapsed ? 0 : 1,
                  height: isCollapsed ? 0 : "auto",
                }}
                transition={{ duration: 0.22, ease: SIDEBAR_EASE }}
                className="overflow-hidden space-y-2 pt-1"
                style={{ pointerEvents: isCollapsed ? "none" : "auto" }}
              >
                <div className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400/50 whitespace-nowrap">
                  Recent Conversations
                </div>

                <LayoutGroup id="sidebar-history">
                  {groupOrder.map((group) => {
                    const items = grouped[group];
                    if (!items?.length) return null;
                    return (
                      <div key={group} className="space-y-0.5">
                        <div className="px-3 py-1 text-[10px] font-semibold text-slate-500/70 whitespace-nowrap">{group}</div>
                        {items.map((conv) => {
                          const isActive = currentConversationId === conv.id;
                          const isHovered = hoveredId === conv.id;
                          return (
                            <div
                              key={conv.id}
                              onMouseEnter={() => setHoveredId(conv.id)}
                              onMouseLeave={() => setHoveredId(null)}
                              className="relative px-1"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  settingsHapticTick();
                                  onSelect?.(conv.id);
                                }}
                                className={cn(
                                  "relative w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 group overflow-hidden",
                                  isActive
                                    ? "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 font-medium"
                                    : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]"
                                )}
                              >
                                <MessageSquare
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0 transition-colors",
                                    isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-cyan-300"
                                  )}
                                />
                                <span className="flex-1 text-[12.5px] truncate pr-4 whitespace-nowrap">{conv.title || "Untitled chat"}</span>

                                <div
                                  className={cn(
                                    "absolute right-2 flex items-center gap-1 opacity-0 transition-opacity",
                                    (isHovered || isActive) && "opacity-100"
                                  )}
                                >
                                  <button
                                    type="button"
                                    className="p-1 rounded-md hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onArchive?.(conv.id);
                                    }}
                                    title="Archive"
                                  >
                                    <Archive className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-1 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDelete?.(conv.id);
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </LayoutGroup>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Profile & Settings Bar */}
        <div className="shrink-0 p-2.5 flex flex-col gap-1 border-t border-white/[0.06] bg-[#070a12]/95 backdrop-blur-md overflow-hidden">
          {/* Settings Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  settingsHapticTick();
                  onOpenSettings ? onOpenSettings() : navigate("/settings");
                }}
                className={cn(
                  "flex items-center rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-white/5 active:scale-98 transition-colors h-10 overflow-hidden",
                  isCollapsed ? "w-10 justify-center mx-auto px-0" : "w-full px-2.5 gap-2.5"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <motion.span
                  animate={{
                    opacity: isCollapsed ? 0 : 1,
                    width: isCollapsed ? 0 : "auto",
                  }}
                  transition={{ duration: 0.18, ease: SIDEBAR_EASE }}
                  className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-left"
                >
                  Settings
                </motion.span>
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Settings</TooltipContent>}
          </Tooltip>

          {/* User Profile Card */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  settingsHapticTick();
                  navigate("/profile");
                  onNavigate?.();
                }}
                className={cn(
                  "flex items-center rounded-xl hover:bg-white/5 active:scale-98 transition-colors h-10 overflow-hidden",
                  isCollapsed ? "w-10 justify-center mx-auto px-0" : "w-full px-2 gap-2.5"
                )}
              >
                <div className="relative shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 text-[11px] font-bold text-white shadow-sm ring-1 ring-white/20">
                    {userInitials || "U"}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#070a12]" />
                </div>
                <motion.div
                  animate={{
                    opacity: isCollapsed ? 0 : 1,
                    width: isCollapsed ? 0 : "auto",
                  }}
                  transition={{ duration: 0.18, ease: SIDEBAR_EASE }}
                  className="min-w-0 flex-1 text-left whitespace-nowrap overflow-hidden"
                >
                  <p className="text-[13px] font-medium text-slate-200 truncate">{formattedName}</p>
                  <p className="text-[10px] text-cyan-400/70 truncate font-mono">Pro Plan Active</p>
                </motion.div>
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">{userDisplayName || "Profile & Account"}</TooltipContent>}
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

export const ChatShadowSidebar = React.memo(ChatShadowSidebarInner);
