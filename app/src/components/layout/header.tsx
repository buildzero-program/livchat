"use client";

import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { AiChatTrigger } from "~/components/ai-chat";
import { useHeader } from "./header-context";
import { Fragment } from "react";

/**
 * App Header Component (Dynamic)
 *
 * Features:
 * - SidebarTrigger for collapsing sidebar
 * - Dynamic breadcrumb from HeaderContext
 * - Custom actions from HeaderContext
 * - AI Chat trigger (optional via context)
 */
export function Header() {
  const { config } = useHeader();
  const { breadcrumbs = [{ label: "Dashboard" }], actions, showAiChat = true } = config;

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
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={index}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast || !item.href ? (
                      <BreadcrumbPage className="font-medium">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={item.href}>{item.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right side: Custom actions + AI Chat */}
      <div className="flex items-center gap-2 px-4">
        {actions}
        {showAiChat && <AiChatTrigger />}
      </div>
    </header>
  );
}
