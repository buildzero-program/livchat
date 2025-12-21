"use client";

import { useState, useEffect, useRef } from "react";

interface EditableNameProps {
  name: string;
  onSave: (name: string) => void;
  maxLength?: number;
  className?: string;
}

export function EditableName({
  name,
  onSave,
  maxLength = 50,
  className,
}: EditableNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from prop only when backend confirms (name changes)
  useEffect(() => {
    setDisplayName(name);
  }, [name]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = displayName.trim();
    if (trimmed && trimmed !== name) {
      // Optimistic: keep showing new name immediately
      setDisplayName(trimmed);
      onSave(trimmed);
    } else {
      setDisplayName(name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      setDisplayName(name);
      setIsEditing(false);
    }
  };

  // Shared typography
  const typography = "font-semibold text-base leading-7";

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        className={`${typography} h-7 field-sizing-content min-w-20 max-w-full rounded-md border border-input bg-transparent px-2 outline-none transition-colors focus-visible:border-ring ${className ?? ""}`}
      />
    );
  }

  return (
    <h3
      onClick={() => setIsEditing(true)}
      className={`${typography} h-7 truncate cursor-text rounded-md px-2 hover:bg-muted/50 transition-colors ${className ?? ""}`}
      title="Clique para editar"
    >
      {displayName}
    </h3>
  );
}
