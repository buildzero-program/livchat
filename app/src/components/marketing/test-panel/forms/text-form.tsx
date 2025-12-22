"use client";

interface TextFormProps {
  message: string;
  onMessageChange: (value: string) => void;
}

export function TextForm({ message, onMessageChange }: TextFormProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">Mensagem</label>
      <textarea
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        className="w-full h-28 px-3 py-2 bg-background border border-input rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Digite sua mensagem..."
      />
    </div>
  );
}
