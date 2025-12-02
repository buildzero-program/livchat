# LivChat.ai - Landing Page Design Brief

Create a premium developer-focused landing page for LivChat, a WhatsApp API platform. The design should feel modern, technical, and trustworthy—like a blend of a developer tool (Stripe, Twilio) and a sleek SaaS product (Linear, Vercel). The unique selling point is **zero-friction onboarding**: users can connect their WhatsApp and test the API before creating an account.

---

## Design System Reference

```json
{
  "designSystem": {
    "name": "LivChat Design System",
    "version": "2.0",
    "description": "A modern, developer-first design system. Dark mode aesthetic with electric purple accents. Technical yet approachable."
  },

  "designPrinciples": [
    {
      "name": "Dark-First Premium",
      "description": "Dark backgrounds (#0A0A0A) create a premium, focused developer experience. Light sections used sparingly for contrast."
    },
    {
      "name": "Code-Forward",
      "description": "Always show the technical side. Code snippets, API responses, and terminal-style elements build developer trust."
    },
    {
      "name": "Zero Friction Focus",
      "description": "The QR code is the hero. Everything points to immediate value - test before signup. Remove barriers."
    },
    {
      "name": "Subtle Motion",
      "description": "Animations should feel like natural responses - glow pulses, gentle lifts, smooth transitions. Never bouncy or playful."
    }
  ],

  "colors": {
    "primary": {
      "purple": "#8B5CF6",
      "purpleHover": "#7C3AED",
      "purpleLight": "#A78BFA",
      "purpleGlow": "rgba(139, 92, 246, 0.2)",
      "purpleGlowStrong": "rgba(139, 92, 246, 0.4)",
      "description": "Electric purple - modern, premium, AI-forward. Differentiates from WhatsApp green competitors."
    },
    "secondary": {
      "cyan": "#00D4FF",
      "cyanHover": "#00A8CC",
      "description": "Cyan accent for highlights and secondary elements. Use sparingly."
    },
    "background": {
      "dark": "#0A0A0A",
      "darkAlt": "#111111",
      "surface": "#161616",
      "surfaceHover": "#1A1A1A",
      "surfaceElevated": "#1F1F1F",
      "light": "#FFFFFF",
      "lightAlt": "#F9FAFB",
      "description": "Dark backgrounds dominate. Light sections only for testimonials and contrast."
    },
    "border": {
      "default": "#262626",
      "subtle": "#1F1F1F",
      "hover": "#333333",
      "description": "Subtle borders that don't compete with content."
    },
    "text": {
      "primary": "#FFFFFF",
      "secondary": "#E5E5E5",
      "muted": "#A1A1AA",
      "dim": "#71717A",
      "onLight": "#18181B",
      "onLightMuted": "#6B7280",
      "description": "High contrast on dark. White for headings, grays for body."
    },
    "semantic": {
      "success": "#22C55E",
      "warning": "#EAB308",
      "error": "#EF4444",
      "info": "#3B82F6"
    }
  },

  "typography": {
    "fontFamily": {
      "heading": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      "body": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      "code": "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      "description": "Inter for UI, JetBrains Mono for code. Clean and technical."
    },
    "headings": {
      "display": {
        "size": "clamp(3rem, 6vw, 4.5rem)",
        "weight": "800",
        "lineHeight": "1.1",
        "letterSpacing": "-0.02em",
        "description": "Hero headlines - massive impact"
      },
      "h1": {
        "size": "clamp(2.5rem, 5vw, 3.5rem)",
        "weight": "700",
        "lineHeight": "1.2",
        "letterSpacing": "-0.02em"
      },
      "h2": {
        "size": "clamp(2rem, 4vw, 2.5rem)",
        "weight": "600",
        "lineHeight": "1.3",
        "letterSpacing": "-0.01em"
      },
      "h3": {
        "size": "1.25rem",
        "weight": "600",
        "lineHeight": "1.4"
      }
    },
    "body": {
      "large": { "size": "1.125rem", "lineHeight": "1.7" },
      "base": { "size": "1rem", "lineHeight": "1.6" },
      "small": { "size": "0.875rem", "lineHeight": "1.5" }
    },
    "special": {
      "gradientText": {
        "style": "background: linear-gradient(135deg, #FFFFFF 30%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;",
        "description": "Use on hero headlines for emphasis"
      },
      "codeInline": {
        "background": "#1F1F1F",
        "padding": "2px 8px",
        "borderRadius": "4px",
        "fontFamily": "code"
      }
    }
  },

  "spacing": {
    "section": {
      "paddingY": "clamp(5rem, 12vw, 8rem)",
      "paddingX": "clamp(1.5rem, 5vw, 4rem)",
      "description": "Generous vertical padding. Sections should breathe."
    },
    "container": {
      "maxWidth": "1280px",
      "description": "Comfortable reading width, centered."
    },
    "grid": {
      "gap": "1.5rem",
      "cardGap": "1.5rem"
    },
    "content": {
      "headingToBody": "1.5rem",
      "bodyToCta": "2rem",
      "cardPadding": "1.5rem"
    }
  },

  "components": {
    "buttons": {
      "primary": {
        "background": "#8B5CF6",
        "text": "#FFFFFF",
        "borderRadius": "8px",
        "paddingX": "1.75rem",
        "paddingY": "0.875rem",
        "fontWeight": "600",
        "fontSize": "1rem",
        "border": "none",
        "hover": {
          "background": "#7C3AED",
          "transform": "translateY(-2px)",
          "boxShadow": "0 4px 12px rgba(139, 92, 246, 0.4)"
        },
        "transition": "all 0.2s ease",
        "description": "Purple background, white text. Subtle lift on hover with glow."
      },
      "secondary": {
        "background": "transparent",
        "text": "#FFFFFF",
        "border": "1px solid #262626",
        "borderRadius": "8px",
        "paddingX": "1.75rem",
        "paddingY": "0.875rem",
        "hover": {
          "borderColor": "#8B5CF6",
          "color": "#8B5CF6"
        }
      },
      "ghost": {
        "background": "transparent",
        "text": "#8B5CF6",
        "hover": { "textDecoration": "underline" }
      }
    },

    "cards": {
      "default": {
        "background": "#161616",
        "borderRadius": "16px",
        "padding": "1.5rem",
        "border": "1px solid #262626",
        "hover": {
          "borderColor": "rgba(139, 92, 246, 0.3)",
          "transform": "translateY(-4px)",
          "boxShadow": "0 8px 32px rgba(0, 0, 0, 0.3)"
        },
        "transition": "all 0.3s ease"
      },
      "feature": {
        "background": "#111111",
        "borderRadius": "12px",
        "padding": "1.5rem",
        "border": "1px solid #1F1F1F",
        "accentLine": {
          "height": "3px",
          "background": "#8B5CF6",
          "position": "top",
          "borderRadius": "12px 12px 0 0"
        }
      },
      "elevated": {
        "background": "#1A1A1A",
        "borderRadius": "20px",
        "padding": "2rem",
        "boxShadow": "0 8px 32px rgba(0, 0, 0, 0.4)",
        "border": "1px solid #262626"
      },
      "testimonial": {
        "background": "#FFFFFF",
        "borderRadius": "16px",
        "padding": "1.5rem",
        "border": "1px solid #E5E7EB",
        "boxShadow": "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      }
    },

    "codeBlock": {
      "container": {
        "background": "#0D0D0D",
        "borderRadius": "12px",
        "border": "1px solid #262626",
        "overflow": "hidden"
      },
      "header": {
        "background": "#161616",
        "padding": "12px 16px",
        "borderBottom": "1px solid #262626",
        "dots": {
          "colors": ["#EF4444", "#EAB308", "#22C55E"],
          "size": "12px",
          "gap": "8px"
        }
      },
      "content": {
        "padding": "20px",
        "fontFamily": "'JetBrains Mono', monospace",
        "fontSize": "14px",
        "lineHeight": "1.6"
      },
      "tabs": {
        "background": "#111111",
        "activeTab": {
          "background": "#1F1F1F",
          "color": "#8B5CF6",
          "borderBottom": "2px solid #8B5CF6"
        },
        "inactiveTab": { "color": "#71717A" }
      }
    },

    "badges": {
      "primary": {
        "background": "rgba(139, 92, 246, 0.1)",
        "text": "#8B5CF6",
        "borderRadius": "9999px",
        "paddingX": "1rem",
        "paddingY": "0.375rem",
        "fontSize": "0.75rem",
        "fontWeight": "500",
        "textTransform": "uppercase",
        "letterSpacing": "0.05em"
      },
      "outline": {
        "background": "transparent",
        "border": "1px solid #262626",
        "text": "#A1A1AA",
        "borderRadius": "9999px"
      }
    },

    "icons": {
      "library": "Lucide Icons",
      "strokeWidth": "1.5-2",
      "sizes": {
        "small": "1.25rem",
        "medium": "1.5rem",
        "large": "2rem",
        "feature": "2.5rem"
      },
      "container": {
        "size": "3rem",
        "background": "rgba(139, 92, 246, 0.1)",
        "borderRadius": "12px",
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center"
      }
    },

    "inputs": {
      "background": "#161616",
      "border": "1px solid #262626",
      "borderRadius": "8px",
      "padding": "12px 16px",
      "color": "#FFFFFF",
      "placeholder": "#71717A",
      "focus": {
        "borderColor": "#8B5CF6",
        "boxShadow": "0 0 0 3px rgba(139, 92, 246, 0.1)"
      }
    },

    "navigation": {
      "height": "72px",
      "background": "rgba(10, 10, 10, 0.8)",
      "backdropFilter": "blur(12px)",
      "borderBottom": "1px solid #1F1F1F",
      "linkColor": "#A1A1AA",
      "linkHoverColor": "#FFFFFF",
      "linkFontWeight": "500"
    },

    "qrCode": {
      "size": "280px",
      "container": {
        "background": "#161616",
        "borderRadius": "20px",
        "padding": "32px",
        "border": "1px solid #262626",
        "boxShadow": "0 0 60px rgba(139, 92, 246, 0.2)"
      },
      "pulseAnimation": {
        "borderColor": ["#8B5CF6", "transparent"],
        "duration": "2s",
        "iteration": "infinite"
      }
    },

    "testPanel": {
      "container": {
        "background": "#161616",
        "borderRadius": "20px",
        "border": "1px solid #262626",
        "boxShadow": "0 20px 60px rgba(0, 0, 0, 0.3)",
        "overflow": "hidden"
      },
      "header": {
        "background": "#111111",
        "padding": "16px 20px",
        "borderBottom": "1px solid #262626"
      },
      "tabs": {
        "background": "#0D0D0D",
        "padding": "4px",
        "borderRadius": "8px",
        "gap": "4px"
      },
      "tab": {
        "padding": "8px 16px",
        "borderRadius": "6px",
        "fontSize": "14px",
        "active": {
          "background": "#8B5CF6",
          "color": "#FFFFFF"
        },
        "inactive": {
          "background": "transparent",
          "color": "#A1A1AA"
        }
      },
      "splitView": {
        "left": "40%",
        "right": "60%",
        "divider": "1px solid #262626"
      },
      "response": {
        "success": {
          "badge": "#22C55E",
          "text": "200 OK"
        }
      },
      "statusBar": {
        "background": "#111111",
        "padding": "16px 20px",
        "borderTop": "1px solid #262626"
      }
    },

    "arrows": {
      "style": "Geometric, clean lines",
      "color": "#8B5CF6",
      "glowColor": "rgba(139, 92, 246, 0.3)",
      "animation": {
        "type": "bounce",
        "distance": "5px",
        "duration": "1.5s"
      }
    }
  },

  "effects": {
    "shadows": {
      "sm": "0 1px 3px rgba(0, 0, 0, 0.3)",
      "md": "0 4px 12px rgba(0, 0, 0, 0.4)",
      "lg": "0 10px 40px rgba(0, 0, 0, 0.5)",
      "xl": "0 20px 60px rgba(0, 0, 0, 0.6)",
      "glow": "0 0 40px rgba(139, 92, 246, 0.25)",
      "glowStrong": "0 0 60px rgba(139, 92, 246, 0.4)"
    },
    "gradients": {
      "heroText": "linear-gradient(135deg, #FFFFFF 30%, #8B5CF6 100%)",
      "purpleFade": "linear-gradient(90deg, #8B5CF6, #7C3AED)",
      "darkFade": "linear-gradient(180deg, #0A0A0A 0%, #111111 100%)",
      "radialGlow": "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15) 0%, transparent 70%)"
    },
    "patterns": {
      "grid": {
        "image": "linear-gradient(#1F1F1F 1px, transparent 1px), linear-gradient(90deg, #1F1F1F 1px, transparent 1px)",
        "size": "60px 60px",
        "opacity": "0.3"
      },
      "dots": {
        "image": "radial-gradient(#262626 1px, transparent 1px)",
        "size": "24px 24px"
      }
    },
    "transitions": {
      "fast": "all 0.15s ease",
      "default": "all 0.2s ease",
      "smooth": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      "bounce": "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
    },
    "hover": {
      "lift": "translateY(-4px)",
      "liftSmall": "translateY(-2px)",
      "scale": "scale(1.02)",
      "glow": "box-shadow: 0 0 20px rgba(139, 92, 246, 0.2)"
    }
  },

  "patterns": {
    "sectionRhythm": {
      "sequence": ["dark", "dark-alt", "dark", "light", "dark"],
      "description": "Mostly dark sections. Light section for testimonials creates visual break."
    },
    "contentHierarchy": {
      "pattern": "Badge → Headline (gradient) → Description → CTA/Component",
      "description": "Consistent information architecture."
    }
  },

  "responsive": {
    "breakpoints": {
      "sm": "640px",
      "md": "768px",
      "lg": "1024px",
      "xl": "1280px"
    },
    "mobile": [
      "Single column layouts",
      "QR code stacks below text",
      "Full-width buttons",
      "Reduced section padding",
      "Hamburger navigation"
    ]
  },

  "imagery": {
    "style": "Dark, tech-focused, code-centric with purple accents",
    "mockups": {
      "phone": "iPhone mockup, dark bezel, showing WhatsApp interface",
      "dashboard": "Dark UI with purple accents, charts, metrics",
      "browser": "Chrome-like, dark theme, showing code"
    },
    "decorative": {
      "arrows": "Geometric arrows pointing to QR code",
      "glowOrbs": "Blurred purple gradients behind key elements",
      "floatingIcons": "Small tech icons (⚡ 💬 🔗) at 60% opacity"
    },
    "avoid": "Stock photos, bright illustrations, generic imagery"
  }
}
```

---

## Landing Page Sections

---

### Section 1: Hero (QR Code Centralizado)

**Layout:** QR Code como elemento central hero
**Background:** #0A0A0A with subtle grid pattern overlay
**Decoration:** Radial purple glow behind QR, animated arrows pointing to it

**Content Structure:**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│                         [Badge: "⚡ Usado por +500 devs"]                                │
│                                                                                          │
│                         Conecte seu WhatsApp                                            │
│                         em 30 segundos.                                                 │
│                         Sem cadastro.                           (gradient text)         │
│                                                                                          │
│                   "Escaneie o QR e comece a testar agora."                              │
│                                                                                          │
│     ┌─────────┐                                            ┌─────────┐                  │
│     │  📱     │        ↘                    ↙              │    💬   │                  │
│     │ Phone   │            ╔════════════╗                  │  Chat   │                  │
│     │ Mockup  │     →      ║  QR CODE   ║      ←           │ Mockup  │                  │
│     │         │            ║  (280px)   ║                  │         │                  │
│     │         │     →      ║            ║      ←           │         │                  │
│     │         │            ╚════════════╝                  │         │                  │
│     └─────────┘        ↗                    ↖              └─────────┘                  │
│                                                                                          │
│                         ◉ ◉ ◉ Aguardando conexão...                                     │
│                         [📱 Ou use código de pareamento]                                │
│                                                                                          │
│     ┌────────────────────────────────────────────────────────────────────────┐          │
│     │  ✓ Teste antes de criar conta    ✓ 50 msgs grátis/dia                  │          │
│     │  ✓ Sem cartão de crédito         ✓ Desconecte quando quiser            │          │
│     └────────────────────────────────────────────────────────────────────────┘          │
│                                                                                          │
│                🔒 Conexão segura • [Termos] e [Privacidade]                              │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Hero Elements Specification:**

1. **Badge (top):**
   - Style: `badges.primary`
   - Text: "⚡ Usado por +500 devs e agências"
   - Position: Centered above headline

2. **Headline h1:**
   - Text: "Conecte seu WhatsApp em 30 segundos. Sem cadastro."
   - Style: `typography.headings.display` with `special.gradientText`
   - Max-width: 800px, centered

3. **Subtitle:**
   - Text: "Escaneie o QR code e comece a testar agora. Zero atrito, do jeito que dev gosta."
   - Style: `text.muted`, 1.125rem
   - Max-width: 600px, centered

4. **QR Code Container (CENTER - HERO ELEMENT):**
   - Style: `components.qrCode`
   - Size: 280px × 280px
   - Container: `cards.elevated` with purple glow shadow
   - Animation: Border pulse (purple → transparent, 2s loop)
   - Behind: Radial glow gradient

5. **Animated Arrows (4 arrows pointing to QR):**
   - Style: `components.arrows`
   - Position: 4 corners, diagonal pointing inward
   - Animation: Bounce (translateY -5px, 1.5s)
   - Color: #8B5CF6 with glow

6. **Phone Mockup (Left side):**
   - Content: iPhone showing WhatsApp "Aparelhos Conectados" screen
   - Style: Dark bezel, slight 3D rotation (-5deg)
   - Shadow: `shadows.xl`
   - Position: Floating left of QR

7. **Chat Mockup (Right side):**
   - Content: WhatsApp Web style chat with messages
   - Style: Dark theme, rounded corners
   - Position: Floating right of QR
   - Rotation: Slight 3D tilt (+5deg)

8. **Connection Status:**
   - Text: "◉ ◉ ◉ Aguardando conexão..."
   - Animation: Dots pulsing
   - Below: Ghost button "📱 Ou use código de pareamento"

9. **Features Row:**
   - Layout: 2×2 grid or inline
   - Items with purple checkmarks:
     - "Teste antes de criar conta"
     - "50 msgs grátis/dia"
     - "Sem cartão de crédito"
     - "Desconecte quando quiser"

10. **Trust Footer:**
    - Icon: 🔒 Lock
    - Text: "Conexão segura e criptografada"
    - Links: [Termos de Uso] [Política de Privacidade]

---

### Section 1B: Test Panel (After QR Connection)

**When user connects, QR transforms into interactive test panel:**

**Layout:** Full-width interactive component
**Background:** Same as hero (#0A0A0A)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  🟢 Conectado! Agora teste sua primeira mensagem.                                  │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ ┌──────────────────────────────────────────────────────────────────────────────┐   │ │
│  │ │ [📱 MENSAGEM] [🖼️ MÍDIA] [👥 GRUPOS] [🔗 WEBHOOK] [📖 DOCS]                  │   │ │
│  │ └──────────────────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                                     │ │
│  │  ┌─────────────────────────┬───────────────────────────────────────────────────┐   │ │
│  │  │                         │                                                   │   │ │
│  │  │   PARÂMETROS            │   [cURL] [Node.js] [Python] [PHP]                │   │ │
│  │  │                         │   ┌───────────────────────────────────────────┐  │   │ │
│  │  │   Para:                 │   │ // ● ● ●                                  │  │   │ │
│  │  │   ┌─────────────────┐   │   │                                           │  │   │ │
│  │  │   │+55 11 99999-9999│   │   │ curl -X POST \                            │  │   │ │
│  │  │   └─────────────────┘   │   │   https://api.livchat.ai/v1/send \        │  │   │ │
│  │  │                         │   │   -H "Authorization: Bearer lc_xxx" \     │  │   │ │
│  │  │   Mensagem:             │   │   -d '{"to":"...", "message":"..."}'      │  │   │ │
│  │  │   ┌─────────────────┐   │   │                                           │  │   │ │
│  │  │   │ Olá! Teste 🚀  │   │   └───────────────────────────────────────────┘  │   │ │
│  │  │   └─────────────────┘   │                                    [📋 Copiar]  │   │ │
│  │  │                         │                                                   │   │ │
│  │  │        [▶ ENVIAR]       │   Response:                                      │   │ │
│  │  │                         │   🟢 200 OK (347ms)                              │   │ │
│  │  │                         │   ┌───────────────────────────────────────────┐  │   │ │
│  │  │                         │   │ {                                         │  │   │ │
│  │  │                         │   │   "success": true,                        │  │   │ │
│  │  │                         │   │   "messageId": "msg_abc123"               │  │   │ │
│  │  │                         │   │ }                                         │  │   │ │
│  │  │                         │   └───────────────────────────────────────────┘  │   │ │
│  │  │                         │                                                   │   │ │
│  │  └─────────────────────────┴───────────────────────────────────────────────────┘   │ │
│  │                                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  📱 +55 11 9xxxx-xxxx  │  🔑 lc_anon_xxx...  │  📊 47/50 msgs restantes    │  │ │
│  │  │                                                                              │  │ │
│  │  │  [🔓 Criar conta para salvar sessão]                   [🔌 Desconectar]     │  │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Test Panel Specification:**

1. **Success Banner:**
   - Background: rgba(34, 197, 94, 0.1)
   - Border-left: 4px solid #22C55E
   - Text: "🟢 Conectado! Agora teste sua primeira mensagem."

2. **Main Container:**
   - Style: `components.testPanel.container`
   - Shadow: `shadows.xl`

3. **Feature Tabs:**
   - Style: `components.testPanel.tabs`
   - Active: `testPanel.tab.active` (purple bg, white text)
   - Tabs: MENSAGEM, MÍDIA, GRUPOS, WEBHOOK, DOCS

4. **Split View (40/60):**
   - Left: Parameters form
   - Right: Code preview + response
   - Divider: 1px solid #262626

5. **Parameters Section:**
   - Input fields: `components.inputs`
   - Labels: `text.muted`, small caps
   - Send button: `buttons.primary`

6. **Code Preview:**
   - Style: `components.codeBlock`
   - Language tabs: cURL, Node.js, Python, PHP
   - Copy button: Ghost style

7. **Response Section:**
   - Status badge: Green (#22C55E) for 200 OK
   - Latency: "(347ms)"
   - JSON response in code block

8. **Status Bar (bottom):**
   - Style: `components.testPanel.statusBar`
   - Shows: Phone number, API key (masked), message count
   - CTAs: "Criar conta" (secondary), "Desconectar" (ghost/danger)

---

### Section 2: Social Proof & Logos

**Layout:** Full width, single row
**Background:** #111111
**Border:** 1px solid #1F1F1F (top and bottom)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│   Estamos em grandes projetos:                                                          │
│                                                                                          │
│   [Logo]  [Logo]  [Logo]  [Logo]  [Logo]  [Logo]  [Logo]  →                             │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Specification:**
- Label: "Estamos em grandes projetos:" - `text.muted`
- Logos: Grayscale/white, 32px height, 60% opacity
- Animation: Infinite horizontal scroll
- Gap: 48px between logos

---

### Section 3: Metrics

**Layout:** 2 columns (text left, metrics right)
**Background:** #0A0A0A

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│   Processando e atendendo                              +5M              +1.000          │
│   milhões de clientes.                            mensagens/mês       devs ativos       │
│   ════════════════════                                                                  │
│        (purple underline)                                                               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Specification:**
- Headline: `typography.h2` with purple underline decoration
- Numbers: `typography.display`, color #8B5CF6
- Labels: `text.muted`, small

---

### Section 4: Features Grid (Por que LivChat?)

**Layout:** Centered title + 4-column card grid
**Background:** #111111

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│                    [Badge: "RECURSOS"]                                                  │
│                                                                                          │
│              Por que devs escolhem LivChat?                                             │
│                                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│   │ ═══ purple  │  │ ═══ purple  │  │ ═══ purple  │  │ ═══ purple  │                   │
│   │    ⚡       │  │    💳       │  │    🔗       │  │    🤖       │                   │
│   │             │  │             │  │             │  │             │                   │
│   │ Integração  │  │ Sem cartão  │  │ Webhooks    │  │ AI Ready    │                   │
│   │ em 5 min    │  │ de crédito  │  │ em tempo    │  │             │                   │
│   │             │  │             │  │ real        │  │ LangChain,  │                   │
│   │ Copy-paste  │  │ 50 msgs     │  │             │  │ n8n, Make   │                   │
│   │ e pronto.   │  │ grátis/dia  │  │ Retry auto  │  │ Zapier      │                   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│   │ ═══ purple  │  │ ═══ purple  │  │ ═══ purple  │  │ ═══ purple  │                   │
│   │    📊       │  │    🔒       │  │    🔗       │  │    💰       │                   │
│   │             │  │             │  │             │  │             │                   │
│   │ Analytics   │  │ Segurança   │  │ QR codes    │  │ Preço       │                   │
│   │ realtime    │  │ Enterprise  │  │ dinâmicos   │  │ transparente│                   │
│   │             │  │             │  │             │  │             │                   │
│   │ Dashboards  │  │ HMAC, LGPD  │  │ Gere links  │  │ R$89/inst   │                   │
│   │ ou via API  │  │ compliant   │  │ wa.me       │  │ ilimitado   │                   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Card Specification:**
- Style: `components.cards.feature`
- Accent line: 3px purple at top
- Icon: In container (`components.icons.container`)
- Title: `typography.h3`
- Description: `text.muted`, small
- Hover: `effects.hover.lift`

**8 Feature Cards:**

1. **Integração em 5 minutos** (Zap icon)
   "Copy-paste o código, configure webhook, pronto."

2. **Sem cartão de crédito** (CreditCard icon)
   "50 mensagens grátis por dia. Upgrade quando quiser."

3. **Webhooks em tempo real** (Webhook icon)
   "Retry automático com backoff exponencial."

4. **Feito para AI Agents** (Bot icon)
   "Integre com LangChain, CrewAI, n8n, Make, Zapier."

5. **Analytics em tempo real** (BarChart3 icon)
   "Dashboards prontos ou via API para seu BI."

6. **Segurança Enterprise** (Shield icon)
   "HMAC signing, LGPD compliant, criptografia E2E."

7. **Links e QR codes** (QrCode icon)
   "Gere links wa.me programaticamente."

8. **Preço transparente** (DollarSign icon)
   "R$ 89/instância. Mensagens ilimitadas."

---

### Section 5: Code Integration

**Layout:** Centered with large code block
**Background:** #0A0A0A with grid pattern

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│                    [Badge: "INTEGRAÇÃO"]                                                │
│                                                                                          │
│              Integre como quiser!                                                       │
│              Code, vibe-code, no-code.                (gradient text)                   │
│                                                                                          │
│   Integre com a nossa REST API em menos de 3 linhas de código.                          │
│                                                                                          │
│                         [Ver documentação →]                                            │
│                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │  [Node.js] [Python] [cURL] [PHP] [Go]                                            │  │
│   │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│   │  │ // ● ● ●                                                                   │  │  │
│   │  │                                                                            │  │  │
│   │  │ import { LivChat } from '@livchat/sdk';                                   │  │  │
│   │  │                                                                            │  │  │
│   │  │ const client = new LivChat({                                              │  │  │
│   │  │   apiKey: process.env.LIVCHAT_API_KEY                                     │  │  │
│   │  │ });                                                                        │  │  │
│   │  │                                                                            │  │  │
│   │  │ await client.send({                                                       │  │  │
│   │  │   to: '5511999999999',                                                    │  │  │
│   │  │   message: 'Olá! Seu pedido foi confirmado 🎉'                            │  │  │
│   │  │ });                                                                        │  │  │
│   │  │                                                                            │  │  │
│   │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                              [📋 Copiar código]  │  │
│   └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│   Quero integrar com:  ○ API/SDK  ○ n8n/Make  ○ AI Agent  ○ Zapier                     │
│                                                                                          │
│   SDKs: [Node.js] [Python] [Go] [PHP] [Ruby] [Java] [C#] [Rust]                        │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Specification:**
- Code block: `components.codeBlock`
- Language tabs: Switch code on click
- Copy button: Top right of code block
- SDK badges: `badges.outline`

---

### Section 6: Video Demo

**Layout:** Centered, full width
**Background:** #111111

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│                         [Badge: "DEMO"]                                                 │
│                                                                                          │
│              Do zero à primeira mensagem em 2 minutos                                   │
│                                                                                          │
│        ┌─────────────────────────────────────────────────────────────────────┐          │
│        │                                                                      │          │
│        │                              ▶                                      │          │
│        │                                                                      │          │
│        │   [Thumbnail: QR code + code + message flow]                        │          │
│        │                                                                      │          │
│        │                                                           2:15      │          │
│        └─────────────────────────────────────────────────────────────────────┘          │
│                                                                                          │
│              [Experimentar agora →]    [Ver documentação]                               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Specification:**
- Video container: `cards.elevated`, 16:9 aspect ratio
- Play button: Large, centered, subtle glow on hover
- Duration badge: Bottom right corner
- Thumbnail: Show product flow (QR → code → message)

---

### Section 7: Use Cases

**Layout:** Horizontal scroll cards
**Background:** #0A0A0A

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│              [Badge: "USE CASES"]                                                       │
│                                                                                          │
│              Uma suite de soluções para o seu negócio                                   │
│              ═══════════════════════════════════════                                    │
│                                                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  →             │
│   │   🔐     │  │   🔔     │  │   📢     │  │   🛒     │  │   🤖     │                 │
│   │          │  │          │  │          │  │          │  │          │                 │
│   │ OTP/2FA  │  │ Notific. │  │ Campaigns│  │ Carrinho │  │ AI Bots  │                 │
│   │          │  │ Transac. │  │          │  │ Abandon. │  │          │                 │
│   │ 98%      │  │ Realtime │  │ 89% open │  │ Shopify  │  │ GPT-4    │                 │
│   │ entrega  │  │ webhooks │  │ rate     │  │ VTEX     │  │ Claude   │                 │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘                 │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Card Specification:**
- Style: `cards.default`
- Scroll: Horizontal with fade edges
- Icon: Large, purple color
- Tag: Small badge for target audience

---

### Section 8: Pricing

**Layout:** Accent section + card grid
**Background:** Top half #8B5CF6 gradient, bottom half #0A0A0A

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ ████████████████████████████████████████████████████████████████████████████████████████│
│ ██                                                                                   ██ │
│ ██   Não importa se é R$10 ou R$1 milhão.                                           ██ │
│ ██   Nossos clientes pagam apenas R$89 por instância.                               ██ │
│ ██                                                                                   ██ │
│ ██   Por instância, não por mensagem. Escale sem medo.                              ██ │
│ ██                                                                                   ██ │
│ ██                      [Começar grátis →]                                           ██ │
│ ██                                                                                   ██ │
│ ████████████████████████████████████████████████████████████████████████████████████████│
│                                                                                          │
│   Simulador:                                                                            │
│   ○──────────●────────────────────○     Total: R$ 267/mês                              │
│   1          5                   20+            (3 × R$ 89)                              │
│                                                                                          │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                         │
│   │      FREE       │  │  ⭐ STARTER     │  │     SCALE       │                         │
│   │    R$ 0/mês     │  │   R$ 445/mês    │  │   Sob consulta  │                         │
│   │                 │  │                 │  │                 │                         │
│   │  • 1 instância  │  │  • 5 instâncias │  │  • 20+ instânc. │                         │
│   │  • 50 msgs/dia  │  │  • Ilimitadas   │  │  • SLA dedicado │                         │
│   │  • Teste/dev    │  │  • Dashboard    │  │  • White-label  │                         │
│   │                 │  │  • Webhooks     │  │                 │                         │
│   │ [Começar grátis]│  │ [Assinar →]     │  │ [Falar c/ time] │                         │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                         │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Specification:**
- Accent header: Purple gradient background
- Slider: Interactive pricing calculator
- Middle card: Highlighted with purple border/glow
- FAQ accordion below cards

---

### Section 9: Testimonials

**Layout:** Card grid
**Background:** #F9FAFB (LIGHT - contrast section)
**Text color:** Dark

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│              Histórias reais de quem usa LivChat                                        │
│                                                                                          │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                         │
│   │ 😊 João Silva   │  │ 😊 Maria Santos │  │ 😊 Pedro Costa  │                         │
│   │ Backend Dev     │  │ CTO @SaaSBrasil │  │ Indie Hacker    │                         │
│   │                 │  │                 │  │                 │                         │
│   │ "10 minutos do  │  │ "Finalmente uma │  │ "Saí do Twilio. │                         │
│   │  npm install    │  │  API que não    │  │  Metade preço,  │                         │
│   │  até produção." │  │  precisa PhD."  │  │  dobro simples."│                         │
│   │                 │  │                 │  │                 │                         │
│   │ [Dev]           │  │ [Dev]           │  │ [Dev]           │                         │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                         │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Specification:**
- Cards: `cards.testimonial` (white bg)
- Avatar: 48px circle
- Name: Bold
- Role/Company: `text.muted`
- Quote: Italic
- Tag badge: Bottom of card

---

### Section 10: Support CTA

**Layout:** 2 columns
**Background:** #0A0A0A

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│   ┌──────────────────────────┐    ┌──────────────────────────────────────────────┐      │
│   │                          │    │                                              │      │
│   │   [Photo: person with    │    │   E tudo isso com um suporte                │      │
│   │    laptop, smiling]      │    │   que não te deixa na mão.                  │      │
│   │                          │    │                                              │      │
│   │                          │    │   Time brasileiro, resposta em minutos.     │      │
│   │                          │    │                                              │      │
│   │                          │    │   [Entrar no Discord →]                     │      │
│   │                          │    │                                              │      │
│   └──────────────────────────┘    └──────────────────────────────────────────────┘      │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Section 11: FAQ

**Layout:** Accordion, narrow container
**Background:** #111111

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│              Tem dúvidas? Relaxa, nós temos as respostas.                               │
│                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │  ▼  O que é a LivChat.ai?                                                        │  │
│   ├──────────────────────────────────────────────────────────────────────────────────┤  │
│   │  ▶  Qual a diferença para API oficial?                                           │  │
│   ├──────────────────────────────────────────────────────────────────────────────────┤  │
│   │  ▶  É seguro conectar meu WhatsApp?                                              │  │
│   ├──────────────────────────────────────────────────────────────────────────────────┤  │
│   │  ▶  Quantas mensagens posso enviar?                                              │  │
│   └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│                         [Ir para o Discord →]                                           │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**FAQ Content:**

1. **O que é a LivChat.ai?**
   API de WhatsApp para devs e marketers. Envie mensagens, crie chatbots, automatize.

2. **Qual a diferença para API oficial?**
   API oficial requer aprovação Facebook e cobra por mensagem. LivChat conecta instantâneo, preço por instância.

3. **Posso usar meu número pessoal?**
   Sim! Qualquer número funciona.

4. **É seguro?**
   Sim. Criptografia E2E, LGPD compliant, não armazenamos mensagens.

5. **Quantas mensagens/dia?**
   Free: 50/dia. Pagos: ilimitadas (rate limit 10/seg).

6. **Integra com o quê?**
   n8n, Make, Zapier, LangChain, HubSpot, RD Station.

7. **E se for banido?**
   Responsabilidade do usuário, mas damos suporte para boas práticas.

8. **Quanto tempo para integrar?**
   5 minutos para Hello World.

---

### Section 12: Final CTA

**Layout:** Centered
**Background:** #0A0A0A with radial purple glow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│                    Você chegou no fim da página.                                        │
│                                                                                          │
│         Se você leu até aqui, é porque precisa de uma API que funciona.                │
│                               Bora?                                                     │
│                                                                                          │
│                      ┌────────────────────────────┐                                     │
│                      │    [🚀 Começar agora →]    │                                     │
│                      └────────────────────────────┘                                     │
│                                                                                          │
│                    Vai, clica. Você sabe que quer.                                      │
│                                                                                          │
│              ✓ 50 msgs grátis/dia    ✓ Setup em 30 segundos                            │
│              ✓ Sem cartão            ✓ Cancele quando quiser                            │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Section 13: Footer

**Layout:** Multi-column
**Background:** #0A0A0A
**Border:** 1px solid #1F1F1F (top)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│   ⚡ LivChat.ai                                                                          │
│   WhatsApp API para devs                                                                │
│                                                                                          │
│   ─────────────────────────────────────────────────────────────────────────────────     │
│                                                                                          │
│   Produto          Recursos          Empresa          Legal                             │
│   Features         Docs              Sobre            Termos                            │
│   Pricing          SDKs              Blog             Privacidade                       │
│   Changelog        Discord           Careers          LGPD                              │
│   Status           GitHub            Contato                                            │
│                                                                                          │
│   ─────────────────────────────────────────────────────────────────────────────────     │
│                                                                                          │
│   [Twitter]  [GitHub]  [Discord]  [LinkedIn]                                            │
│                                                                                          │
│   © 2024 LivChat.ai • Feito com 💙 no Brasil                                            │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Image Generation Instructions

### Hero Phone Mockup (Left):
```
Modern iPhone 15 Pro mockup, dark titanium frame, showing WhatsApp app open on
"Linked Devices" screen. Slight 3D rotation (-5 degrees). Dark background.
Floating slightly with subtle shadow underneath.
```

### Hero Chat Mockup (Right):
```
WhatsApp Web style chat window mockup. Dark theme (#1F1F1F background).
Show 3-4 chat messages with green sent indicators. Include typing indicator at bottom.
Rounded corners (16px). Slight 3D rotation (+5 degrees).
```

### Dashboard Mockup:
```
Dark-themed analytics dashboard. Background #0A0A0A. Show: line chart with purple
gradient fill, metric cards ("5.2M messages", "99.9% uptime", "347ms latency"),
message list. Use #8B5CF6 as accent color throughout.
```

### Support Section Photo:
```
Professional photo of a smiling developer/tech worker using a MacBook in a
modern home office. Natural lighting. Casual but professional. Neutral colors
(grays, whites) so it doesn't clash with purple brand color.
```

---

## Important Notes for Generation

1. **Primary Color: Purple (#8B5CF6)** - NOT green. Differentiates from competitors.

2. **QR Code is the Hero** - Centered, large, with animated arrows pointing to it.

3. **Dark Mode First** - Background #0A0A0A is default. Light section only for testimonials.

4. **Show Code** - Always display code snippets. Developers trust what they can read.

5. **Test Panel is Key** - The interactive API playground should feel like a real tool.

6. **Generous Spacing** - Sections should breathe. Use `spacing.section.paddingY`.

7. **Subtle Animations** - Glow pulses, gentle lifts, smooth transitions. Never bouncy.

8. **Mobile Responsive** - Stack columns, full-width buttons, reduced padding.

The landing page should convey:
- **Technical Trust** - Code, metrics, security badges
- **Zero Friction** - QR code prominent, test before signup
- **Modern Premium** - Dark mode, purple accents, clean design
- **Brazilian Identity** - Casual tone, BRL pricing, "Feito no Brasil"
