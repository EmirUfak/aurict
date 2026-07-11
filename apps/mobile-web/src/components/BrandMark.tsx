type BrandMarkProps = {
  href?: string;
};

export function BrandMark({ href = "https://aurict.com" }: BrandMarkProps) {
  const content = (
    <>
      <span className="brand-logo-shell" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- local public SVG, no optimizer needed */}
        <img className="brand-logo" alt="" height={25} src="/aurict-logo.svg" width={25} />
      </span>
      <span className="brand-word mono">
        aurict<span className="aur-cursor" style={{ color: "var(--accent)" }}>▊</span>
      </span>
    </>
  );

  return (
    <a className="brand-lockup brand-lockup-nav" href={href}>
      {content}
    </a>
  );
}
