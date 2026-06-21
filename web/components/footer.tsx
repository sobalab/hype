import { Icon } from "@/components/icon";
import { Dataset } from "@/lib/data";

type Props = { data: Dataset };

export function Footer({ data }: Props) {
  return (
    <footer
      className="relative z-[1] mt-10 border-t border-border"
      style={{
        padding:
          "clamp(3.5rem, 8vw, 6rem) clamp(1.5rem, 4vw, 3rem) clamp(2rem, 4vw, 2.5rem)",
      }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-20 sm:gap-24">
        {/* Wordmark + tagline — tight pair, Chakra Petch for both */}
        <div className="flex flex-col gap-3">
          <span
            className="font-display font-black leading-[0.95] tracking-[0.02em] text-ink"
            style={{ fontSize: "clamp(2.5rem, 6.5vw, 4rem)" }}
          >
            HYP3
          </span>
          <span
            className="font-display font-black uppercase leading-[1.1] tracking-[0.04em] text-ink-2"
            style={{ fontSize: "clamp(1.125rem, 2.2vw, 1.75rem)" }}
          >
            Built for the underdogs.
          </span>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 sm:gap-16">
          <Column label="Product">
            <FootLink href="/divergent">The Divergent</FootLink>
            <FootLink href="/scatter">The Scatter</FootLink>
            <FootLink href="/timeline">The Timeline</FootLink>
            <FootLink href="/bracket">The Bracket</FootLink>
          </Column>
          <Column label="Data">
            <FootLink href="/#faqs">Methodology</FootLink>
            <FootLink href="mailto:sophbaedesign@gmail.com?subject=HYP3%20correction">
              Submit correction
              <Icon name="upright-arrow" size={12} className="ml-1.5" />
            </FootLink>
            <FootLink href="https://github.com/baes358/hype" external>
              Changelog
              <Icon name="upright-arrow" size={12} className="ml-1.5" />
            </FootLink>
          </Column>
        </div>

        {/* Hairline divider above copyright */}
        <div className="border-t border-border pt-12">
          <div
            className="font-sans uppercase leading-[1.5] tracking-[0.04em] text-ink-2"
            style={{ fontSize: "clamp(0.875rem, 1.4vw, 1.0625rem)" }}
          >
            <div>Sophia Bae © HYP3 {data.metadata.tournament_year}</div>
            <div>All rights reserved.</div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Column({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-7">
      <div
        className="font-display font-black uppercase leading-none tracking-[0.04em] text-ink-2"
        style={{ fontSize: "clamp(1rem, 1.6vw, 1.25rem)" }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

function FootLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center font-sans leading-snug text-ink-1 transition-colors hover:text-ink"
      style={{ fontSize: "clamp(1rem, 1.4vw, 1.125rem)" }}
    >
      {children}
    </a>
  );
}
