import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import {
  AboutSection,
  ApiSection,
  FAQSection,
  GapPreviewSection,
  SourcesSection,
} from "@/components/home-sections";
import { TopNav } from "@/components/top-nav";
import { dataset } from "@/lib/data";

export default function Home() {
  return (
    <>
      <TopNav dataset={dataset} />
      <Hero data={dataset} />
      <GapPreviewSection data={dataset} />
      <AboutSection data={dataset} />
      <ApiSection />
      <SourcesSection />
      <FAQSection />
      <Footer data={dataset} />
    </>
  );
}
