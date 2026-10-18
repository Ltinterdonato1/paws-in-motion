import Link from "next/link";

type BrandProps = {
  className?: string;
  subtitle?: string;
};

export default function Brand({ className = "brand", subtitle = "THOUGHTFUL PET CARE · SEATTLE" }: BrandProps) {
  return (
    <Link href="/" className={className} aria-label="Paws in Motion home">
      <span className="brand-mark" aria-hidden="true">
        p<span>✳</span>
      </span>
      <span className="brand-name">
        paws in motion
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}
