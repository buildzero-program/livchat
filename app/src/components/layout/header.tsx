"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { AiChatTrigger } from "~/components/ai-chat";

/**
 * App Header Component (Inset Layout Style)
 *
 * Features:
 * - SidebarTrigger for collapsing sidebar (with tooltip)
 * - Breadcrumb navigation
 * - AI Chat trigger on the right
 * - Transitions smoothly with sidebar state
 */
export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/40 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      {/* Left side: Trigger + Breadcrumb */}
      <div className="flex items-center gap-2 px-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="-ml-1" />
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start">
            Toggle Sidebar <kbd className="ml-2 text-xs">⌘B</kbd>
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right side: AI Chat */}
      <div className="flex items-center px-4">
        <AiChatTrigger />
      </div>
    </header>
  );
}
