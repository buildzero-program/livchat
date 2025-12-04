"use client";

import { motion } from "framer-motion";
import {
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  Webhook,
  Wifi,
  CheckCheck,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { mockRecentActivity, formatRelativeTime } from "~/lib/mock-dashboard";

const activityIcons = {
  message_sent: ArrowUpRight,
  message_received: ArrowDownLeft,
  webhook_triggered: Webhook,
  connected: Wifi,
} as const;

const activityColors = {
  message_sent: "text-chart-1 bg-chart-1/10",
  message_received: "text-chart-2 bg-chart-2/10",
  webhook_triggered: "text-chart-4 bg-chart-4/10",
  connected: "text-green-500 bg-green-500/10",
} as const;

const statusIcons = {
  delivered: CheckCheck,
  read: CheckCheck,
  sent: Check,
  success: Check,
} as const;

const statusColors = {
  delivered: "text-blue-500",
  read: "text-blue-500",
  sent: "text-muted-foreground",
  success: "text-green-500",
} as const;

export function ActivityWidget() {
  const activities = mockRecentActivity;

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Atividade Recente
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {activities.length} eventos
        </span>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon =
                activityIcons[activity.type] ?? ArrowUpRight;
              const iconColorClass =
                activityColors[activity.type] ?? "text-muted-foreground bg-muted";
              const StatusIcon = statusIcons[activity.status];
              const statusColorClass =
                statusColors[activity.status] ?? "text-muted-foreground";

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Avatar or Icon */}
                  {activity.type === "webhook_triggered" ||
                  activity.type === "connected" ? (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconColorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  ) : (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-muted">
                        {activity.contactInitials}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {activity.contact}
                      </span>
                      <Icon
                        className={`h-3 w-3 shrink-0 ${
                          activity.type === "message_sent"
                            ? "text-chart-1"
                            : activity.type === "message_received"
                              ? "text-chart-2"
                              : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.message}
                    </p>
                  </div>

                  {/* Time and Status */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                    {StatusIcon && (
                      <StatusIcon className={`h-3.5 w-3.5 ${statusColorClass}`} />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
