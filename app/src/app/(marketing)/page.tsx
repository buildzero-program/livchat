import { Hero } from "~/components/marketing/hero";
import { SocialProof } from "~/components/marketing/social-proof";
import { Metrics } from "~/components/marketing/metrics";
import { Features } from "~/components/marketing/features";
import { Integration } from "~/components/marketing/integration";
import { Pricing } from "~/components/marketing/pricing";
import { Testimonials } from "~/components/marketing/testimonials";
import { CtaFinal } from "~/components/marketing/cta-final";

export default function HomePage() {
  return (
    <>
      <Hero />
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
