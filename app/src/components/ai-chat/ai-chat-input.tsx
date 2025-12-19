"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { ArrowUp, Plus, X, Loader2, Mic, Square, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NextImage from "next/image";
import { Button } from "~/components/ui/button";
import { useAiChat } from "./ai-chat-provider";
import { useAudioRecorder } from "~/hooks/use-audio-recorder";
import { cn } from "~/lib/utils";

interface AiChatInputProps {
  autoFocus?: boolean;
}

export function AiChatInput({ autoFocus = true }: AiChatInputProps) {
  const [value, setValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, isLoading, isOpen } = useAiChat();

  // Audio recorder
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    mimeType,
    error: audioError,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useAudioRecorder();

  // Auto-focus when chat opens
  useEffect(() => {
    if (autoFocus && isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Tipo não suportado. Use JPG, PNG, GIF ou WebP.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("Arquivo muito grande. Máximo: 20MB.");
      return;
    }

    setUploadError(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
    setUploadError(null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ivy/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error instanceof Error ? error.message : "Erro ao fazer upload"
      );
      return null;
    }
  };

  const uploadAudio = async (blob: Blob, mime: string): Promise<string | null> => {
    const formData = new FormData();
    // Determine extension from mime type
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
    formData.append("file", blob, `audio.${ext}`);

    try {
      const response = await fetch("/api/ivy/upload-audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Audio upload error:", error);
      setUploadError(
        error instanceof Error ? error.message : "Erro ao fazer upload do áudio"
      );
      return null;
    }
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    // Precisa de texto OU áudio para enviar
    const hasText = value.trim().length > 0;
    const hasAudio = audioBlob !== null;

    if ((!hasText && !hasAudio) || isLoading || isUploading) return;

    setIsUploading(true);

    let imageUrl: string | undefined;
    let audioUrlUploaded: string | undefined;

    // Upload image if selected
    if (selectedImage) {
      const url = await uploadImage(selectedImage);
      if (!url) {
        setIsUploading(false);
        return;
      }
      imageUrl = url;
    }

    // Upload audio if recorded
    if (audioBlob && mimeType) {
      const url = await uploadAudio(audioBlob, mimeType);
      if (!url) {
        setIsUploading(false);
        return;
      }
      audioUrlUploaded = url;
    }

    setIsUploading(false);

    const message = hasText ? value : ""; // Áudio pode não ter texto
    const images = imageUrl ? [imageUrl] : undefined;

    setValue("");
    handleRemoveImage();
    clearRecording();
    await sendMessage(message, images, audioUrlUploaded);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Pode enviar se tem texto OU áudio gravado
  const canSend = (value.trim().length > 0 || audioBlob !== null) && !isLoading && !isUploading && !isRecording;

  return (
    <div className="border-t border-border/50 bg-background px-3 pb-3 pt-2">
      {/* Image Preview - INSIDE container */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2"
          >
            <div className="relative inline-block">
              <NextImage
                src={imagePreview}
                alt="Preview"
                width={80}
                height={80}
                className="rounded-lg object-cover"
                style={{ maxHeight: 80, width: "auto" }}
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full border border-border shadow-sm"
                onClick={handleRemoveImage}
                disabled={isUploading}
              >
                <X className="h-3 w-3" />
              </Button>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Preview */}
      <AnimatePresence>
        {audioUrl && !isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2"
          >
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
              <audio src={audioUrl} controls className="h-8 flex-1" />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={clearRecording}
                disabled={isUploading}
                title="Remover áudio"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {(uploadError || audioError) && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-2 text-xs text-destructive"
          >
            {uploadError || audioError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Unified Input Container - ChatGPT style two-row layout */}
      <div
        className={cn(
          "relative flex flex-col gap-1",
          "rounded-2xl border border-border bg-muted/40 p-2",
          "shadow-sm",
          "focus-within:border-border focus-within:ring-2 focus-within:ring-ring/20"
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />

        {/* Row 1: Textarea (full width) */}
        {!isRecording && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedImage
                ? "Descreva a imagem..."
                : audioBlob
                  ? "Adicione uma mensagem (opcional)..."
                  : "Pergunte algo..."
            }
            disabled={isLoading || isUploading}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent py-1 px-1",
              "text-sm leading-relaxed",
              "placeholder:text-muted-foreground/60",
              "focus:outline-none",
              "min-h-[24px] max-h-[150px]",
              "scrollbar-thin scrollbar-thumb-muted"
            )}
          />
        )}

        {/* Recording Mode: Replace textarea with recording UI */}
        {isRecording && (
          <div className="flex items-center gap-2 py-1 px-1">
            <motion.div
              className="h-3 w-3 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatDuration(duration)}
            </span>
            <span className="text-sm text-muted-foreground">Gravando...</span>

            <Button
              size="icon"
              variant="ghost"
              className="ml-auto h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
              onClick={cancelRecording}
              title="Cancelar gravação"
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 shrink-0 rounded-lg"
              onClick={stopRecording}
              title="Parar gravação"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          </div>
        )}

        {/* Row 2: Buttons - Plus left, Mic+Send right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 rounded-lg",
                "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading || !!selectedImage || isRecording}
              title="Anexar imagem"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 rounded-lg",
                "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={startRecording}
              disabled={isLoading || isUploading || !!audioBlob || isRecording}
              title="Gravar áudio"
            >
              <Mic className="h-5 w-5" />
            </Button>

            <motion.div
              initial={false}
              animate={{
                scale: canSend ? 1 : 0.95,
                opacity: canSend ? 1 : 0.4,
              }}
              transition={{ duration: 0.1 }}
            >
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!canSend}
                className={cn(
                  "h-8 w-8 rounded-lg transition-colors",
                  canSend
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Keyboard hint - more subtle */}
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
        <kbd className="font-sans">Enter</kbd> enviar · <kbd className="font-sans">Shift+Enter</kbd> nova linha
      </p>
    </div>
  );
}
