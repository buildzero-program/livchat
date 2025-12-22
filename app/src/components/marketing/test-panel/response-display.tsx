"use client";

import { Loader2 } from "lucide-react";

interface SendResponse {
  success: boolean;
  messageId: string;
  timestamp: number;
}

interface ResponseDisplayProps {
  response: SendResponse | null;
  error: string | null;
  isLoading: boolean;
}

export function ResponseDisplay({ response, error, isLoading }: ResponseDisplayProps) {
  if (!response && !error && !isLoading) return null;

  return (
    <div className="bg-[#0a0a0a] rounded-xl overflow-hidden shrink-0">
      <div className="px-4 py-2.5 bg-muted/10 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Response</span>
        {!isLoading && response && (
          <>
            <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
              200 OK
            </span>
          </>
        )}
        {!isLoading && error && (
          <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
            Error
          </span>
        )}
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Enviando...</span>
          </div>
        ) : error ? (
          <pre className="text-xs font-mono text-red-400/90 whitespace-pre-wrap">
            {JSON.stringify({ error }, null, 2)}
          </pre>
        ) : response ? (
          <pre className="text-xs font-mono text-green-400/90 whitespace-pre-wrap">
            {JSON.stringify(response, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
