"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { forwardRef, useState } from "react";
import { faceUrl } from "@/lib/client/api";

type Variant = "primary" | "secondary" | "plain" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background,transform,box-shadow,color] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-accent-soft text-accent-ink hover:bg-[#dcebfb]",
  plain: "bg-fill text-ink hover:bg-fill-2",
  danger: "bg-[#fdeceb] text-bad hover:bg-[#fbdedc]"
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-6 text-[15px]",
  lg: "h-[52px] px-8 text-[17px]"
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" light={variant === "primary"} />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={clsx(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

export function Card({
  className,
  children,
  as: As = "div"
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article";
}) {
  return <As className={clsx("card", className)}>{children}</As>;
}

export function Spinner({ className, light }: { className?: string; light?: boolean }) {
  return (
    <svg className={clsx("animate-spin", className || "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke={light ? "rgba(255,255,255,.35)" : "#e5e5ea"} strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke={light ? "#fff" : "#0071e3"} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({
  username,
  hasFace,
  size = 44,
  version,
  className,
  online
}: {
  username: string;
  hasFace?: boolean;
  size?: number;
  version?: number;
  className?: string;
  online?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const initials = username.slice(0, 2).toUpperCase();
  const hue = [...username.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className={clsx("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {hasFace && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faceUrl(username, version)}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: `hsl(${hue} 45% 62%)`, fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      )}
      {online !== undefined && (
        <span
          className={clsx(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            online ? "bg-[#34c759]" : "bg-ink-4"
          )}
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      )}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          "h-12 w-full rounded-2xl border border-line bg-white px-4 text-[16px] text-ink placeholder:text-ink-4",
          "transition-shadow focus:border-accent focus:shadow-ring focus:outline-none",
          className
        )}
        {...rest}
      />
    );
  }
);

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "good"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-3 text-[14px]",
        tone === "error" && "bg-[#fdeceb] text-bad",
        tone === "good" && "bg-[#e9f7ee] text-good",
        tone === "info" && "bg-fill text-ink-2"
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div>
        <h1 className="display text-[34px] leading-[1.08] md:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[17px] text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <p className="text-[17px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[15px] text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Flag({ code }: { code: string }) {
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const flag = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  return (
    <span aria-label={code} title={code}>
      {flag}
    </span>
  );
}
