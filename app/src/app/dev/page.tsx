import { Hero } from "~/components/marketing/hero";
import { DemoVideo } from "~/components/marketing/demo-video";
import { SocialProof } from "~/components/marketing/social-proof";
import { Metrics } from "~/components/marketing/metrics";
import { Features } from "~/components/marketing/features";
import { Integration } from "~/components/marketing/integration";
import { Pricing } from "~/components/marketing/pricing";
import { Testimonials } from "~/components/marketing/testimonials";
import { CtaFinal } from "~/components/marketing/cta-final";

const MUX_PLAYBACK_ID = "jYlviX5igNszbi9AyVKXuLdPE96QHoenGOi014Gy5YI00";

export default function HomePage() {
  return (
    <>
      <Hero />
      <DemoVideo playbackId={MUX_PLAYBACK_ID} />
      <SocialProof />
      <Metrics />
      <Features />
      <Integration />
      <Pricing />
      <Testimonials />
      <CtaFinal />
    </>
  );
}
