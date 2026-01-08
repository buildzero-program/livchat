import { HeroB2B } from "~/components/b2b/hero-b2b";
import { SocialProofB2B } from "~/components/b2b/social-proof-b2b";
import { DemoSectionB2B } from "~/components/b2b/demo-section-b2b";
import { SolutionB2B } from "~/components/b2b/solution-b2b";
import { FeaturesB2B } from "~/components/b2b/features-b2b";
import { HowItWorksB2B } from "~/components/b2b/how-it-works-b2b";
import { FAQB2B } from "~/components/b2b/faq-b2b";
import { CTAFinalB2B } from "~/components/b2b/cta-final-b2b";

export const metadata = {
  title: "LivChat.ai | API de WhatsApp + Agentes AI para Agências",
  description:
    "Automatize o atendimento de leads das suas campanhas com IA. API de WhatsApp + Agentes AI para agências de marketing. Dev-friendly, sem limite de mensagens, implementação assistida.",
  openGraph: {
    title: "LivChat.ai | API de WhatsApp + Agentes AI para Agências",
    description:
      "Automatize o atendimento de leads das suas campanhas com IA. API de WhatsApp + Agentes AI para agências de marketing.",
    url: "https://livchat.ai",
    siteName: "LivChat.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LivChat.ai | API de WhatsApp + Agentes AI para Agências",
    description:
      "Automatize o atendimento de leads das suas campanhas com IA.",
  },
};

export default function B2BHomePage() {
  return (
    <>
      <HeroB2B />
      <SocialProofB2B />
      <DemoSectionB2B />
      <SolutionB2B />
      <FeaturesB2B />
      <HowItWorksB2B />
      <FAQB2B />
      <CTAFinalB2B />
    </>
  );
}
