"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { cn } from "~/lib/utils";
import type { MessageType } from "./type-selector";

type CodeLanguage = "curl" | "javascript" | "python";

const CODE_LANGUAGES = [
  { id: "curl" as const, label: "cURL" },
  { id: "javascript" as const, label: "JavaScript" },
  { id: "python" as const, label: "Python" },
];

interface CodePreviewProps {
  messageType: MessageType;
  phone: string;
  message: string;
  apiKey: string;
  jid?: string;
  isRevealed: boolean;
  onToggleReveal: () => void;
  apiBaseUrl: string;
}

// Mascara o token mantendo mesmo comprimento
function maskToken(token: string): string {
  if (!token || token.length < 20) return token;
  const prefixMatch = token.match(/^(lc_\w+_)/);
  const prefix = prefixMatch?.[1] ?? "";
  const withoutPrefix = token.slice(prefix.length);
  if (withoutPrefix.length < 8) return prefix + "*".repeat(withoutPrefix.length);
  const first4 = withoutPrefix.slice(0, 4);
  const last4 = withoutPrefix.slice(-4);
  const maskedLength = Math.max(0, withoutPrefix.length - 8);
  return prefix + first4 + "*".repeat(maskedLength) + last4;
}

export function CodePreview({
  messageType,
  phone,
  message,
  apiKey,
  jid,
  isRevealed,
  onToggleReveal,
  apiBaseUrl,
}: CodePreviewProps) {
  const [language, setLanguage] = useState<CodeLanguage>("curl");
  const [copied, setCopied] = useState(false);

  const displayToken = isRevealed ? apiKey : maskToken(apiKey);
  const cleanPhone = phone.replace(/\D/g, "") || "5511999999999";
  const fromNumber = jid || "5511999999999";

  // Trunca mensagem para exibição
  const truncatedMessage = (message || "Hello from LivChat!").slice(0, 50) +
    ((message || "").length > 50 ? "..." : "");

  const getCode = () => {
    if (language === "curl") {
      if (messageType === "text") {
        return `curl -X POST ${apiBaseUrl}/v1/messages/send \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${fromNumber}",
    "phone": "${cleanPhone}",
    "body": "${truncatedMessage}"
  }'`;
      }
      return `curl -X POST ${apiBaseUrl}/v1/messages/send/image \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${fromNumber}",
    "phone": "${cleanPhone}",
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "caption": "Confira esta imagem!"
  }'`;
    }

    if (language === "javascript") {
      if (messageType === "text") {
        return `const response = await fetch(
  "${apiBaseUrl}/v1/messages/send",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${displayToken}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "${fromNumber}",
      phone: "${cleanPhone}",
      body: "${truncatedMessage}"
    })
  }
);

const data = await response.json();`;
      }
      return `const response = await fetch(
  "${apiBaseUrl}/v1/messages/send/image",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${displayToken}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "${fromNumber}",
      phone: "${cleanPhone}",
      image: "data:image/jpeg;base64,/9j/4AAQ...",
      caption: "Confira esta imagem!"
    })
  }
);

const data = await response.json();`;
    }

    // Python
    if (messageType === "text") {
      return `import requests

response = requests.post(
    "${apiBaseUrl}/v1/messages/send",
    headers={
        "Authorization": "Bearer ${displayToken}",
        "Content-Type": "application/json"
    },
    json={
        "from": "${fromNumber}",
        "phone": "${cleanPhone}",
        "body": "${truncatedMessage}"
    }
)

print(response.json())`;
    }
    return `import requests

response = requests.post(
    "${apiBaseUrl}/v1/messages/send/image",
    headers={
        "Authorization": "Bearer ${displayToken}",
        "Content-Type": "application/json"
    },
    json={
        "from": "${fromNumber}",
        "phone": "${cleanPhone}",
        "image": "data:image/jpeg;base64,/9j/4AAQ...",
        "caption": "Confira esta imagem!"
    }
)

print(response.json())`;
  };

  // Código para copiar (sempre com token real)
  const getCodeForCopy = () => {
    const realToken = apiKey || "seu_token_aqui";
    return getCode().replace(displayToken, realToken);
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(getCodeForCopy());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0a0a0a] rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/10 shrink-0">
        <div className="flex gap-1">
          {CODE_LANGUAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setLanguage(id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded transition-colors",
                language === id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleReveal}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title={isRevealed ? "Esconder token" : "Revelar token"}
          >
            {isRevealed ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Copiar código"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 p-4 overflow-y-auto">
        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {getCode()}
        </pre>
      </div>
    </div>
  );
}
