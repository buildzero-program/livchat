"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, ArrowDown } from "lucide-react";
import MediaThemeSutro from "@player.style/sutro/react";
import Hls from "hls.js";

interface DemoVideoProps {
  playbackId: string;
}

export function DemoVideo({ playbackId }: DemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Setup HLS.js for Mux streaming
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const src = `https://stream.mux.com/${playbackId}.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = src;
    }
  }, [playbackId]);

  return (
    <section className="py-24 px-6 bg-[#111111] border-y border-border relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            DEMONSTRAÇÃO
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold">
            Veja como funciona na{" "}
            <span className="bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              prática
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Em 2 minutos você entende todo o fluxo de integração.
          </p>
        </div>

        {/* Arrows pointing down */}
        <div className="flex justify-center gap-8 mb-6">
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="text-primary"
          >
            <ArrowDown className="h-5 w-5" />
          </motion.div>

          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
            <Play className="h-4 w-4 text-primary fill-primary" />
            <span className="text-sm font-medium text-primary">
              Assista agora
            </span>
          </div>

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.2 }}
            className="text-primary"
          >
            <ArrowDown className="h-5 w-5" />
          </motion.div>
        </div>

        {/* Video container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/20 blur-3xl opacity-20 -z-10 scale-110" />

          {/* Video card with Sutro theme */}
          <div
            className="rounded-xl overflow-hidden shadow-2xl border border-border"
            style={{
              // Sutro theme CSS variables
              ["--media-primary-color" as string]: "#ffffff",
              ["--media-secondary-color" as string]: "#141414",
              ["--media-accent-color" as string]: "#8B5CF6",
            }}
          >
            <MediaThemeSutro style={{ width: "100%", aspectRatio: "16/9" }}>
              <video
                ref={videoRef}
                slot="media"
                playsInline
                crossOrigin="anonymous"
                poster={`https://image.mux.com/${playbackId}/thumbnail.webp?time=0`}
                suppressHydrationWarning
              />
            </MediaThemeSutro>
          </div>
        </motion.div>

        {/* Bottom caption */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Conecte, teste e integre em minutos — sem complicação
        </motion.p>
      </div>
    </section>
  );
}
