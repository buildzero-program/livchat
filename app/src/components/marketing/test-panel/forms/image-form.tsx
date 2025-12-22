"use client";

import { useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Input } from "~/components/ui/input";

interface ImageFormProps {
  imageFile: File | null;
  imagePreview: string | null;
  caption: string;
  onImageChange: (file: File | null, preview: string | null) => void;
  onCaptionChange: (value: string) => void;
}

export function ImageForm({
  imageFile,
  imagePreview,
  caption,
  onImageChange,
  onCaptionChange,
}: ImageFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageChange(file, event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    onImageChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">Imagem</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        {!imagePreview ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Clique para selecionar</p>
            <p className="text-xs text-muted-foreground/70 mt-1">JPG, PNG ou WebP até 5MB</p>
          </button>
        ) : (
          <div className="relative">
            <div className="w-full h-28 bg-muted/50 rounded-lg overflow-hidden flex items-center justify-center">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              )}
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-background/90 rounded-full hover:bg-background transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">
          Legenda <span className="text-muted-foreground/50">(opcional)</span>
        </label>
        <Input
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Adicione uma legenda..."
        />
      </div>
    </div>
  );
}
