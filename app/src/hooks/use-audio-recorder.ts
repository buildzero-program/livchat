"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseAudioRecorderReturn {
  /** Se está gravando atualmente */
  isRecording: boolean;
  /** Duração da gravação em segundos */
  duration: number;
  /** Blob do áudio gravado (null se não gravou ainda) */
  audioBlob: Blob | null;
  /** URL para preview do áudio (null se não gravou ainda) */
  audioUrl: string | null;
  /** MIME type do áudio gravado */
  mimeType: string | null;
  /** Erro de permissão ou gravação */
  error: string | null;
  /** Inicia a gravação */
  startRecording: () => Promise<void>;
  /** Para a gravação */
  stopRecording: () => void;
  /** Cancela a gravação (descarta o áudio) */
  cancelRecording: () => void;
  /** Limpa o estado após enviar */
  clearRecording: () => void;
}

/**
 * Formatos suportados pelo Gemini em ordem de preferência.
 * OGG é suportado por Chrome/Firefox e pelo Gemini.
 * WebM NÃO é suportado pelo Gemini, então é última opção.
 */
const PREFERRED_MIME_TYPES = [
  "audio/ogg;codecs=opus", // Suportado pelo Gemini e browsers modernos
  "audio/ogg", // Fallback OGG
  "audio/mp4", // Safari
  "audio/webm;codecs=opus", // WebM - NÃO suportado pelo Gemini (precisa conversão)
  "audio/webm", // Fallback WebM
];

/**
 * Encontra o melhor MIME type suportado pelo browser.
 */
function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Hook para gravação de áudio usando MediaRecorder API.
 *
 * @example
 * ```tsx
 * const { isRecording, duration, audioBlob, startRecording, stopRecording } = useAudioRecorder();
 *
 * return (
 *   <div>
 *     {isRecording ? (
 *       <button onClick={stopRecording}>Stop ({duration}s)</button>
 *     ) : (
 *       <button onClick={startRecording}>Record</button>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup URL quando audioUrl mudar
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Cleanup quando o componente desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Verifica suporte
      const supportedMimeType = getSupportedMimeType();
      if (!supportedMimeType) {
        setError("Gravação de áudio não suportada neste navegador");
        return;
      }

      // Solicita permissão do microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Cria o MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      setMimeType(supportedMimeType);

      // Coleta os chunks de áudio
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Quando parar, cria o blob
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: supportedMimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // Para as tracks do stream
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      // Inicia gravação
      mediaRecorder.start(1000); // Coleta dados a cada 1s
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Timer para atualizar duração
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 100);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Permissão do microfone negada");
        } else if (err.name === "NotFoundError") {
          setError("Microfone não encontrado");
        } else {
          setError(`Erro ao gravar: ${err.message}`);
        }
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    // Para a gravação se estiver gravando
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    // Para o stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Para o timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Limpa o estado
    setIsRecording(false);
    setDuration(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    chunksRef.current = [];
  }, [isRecording, audioUrl]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setDuration(0);
    setMimeType(null);
    chunksRef.current = [];
  }, [audioUrl]);

  return {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    mimeType,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  };
}
