import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

export function GhostIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 11a7 7 0 1114 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L7 20V11z" />
      <circle cx="9.5" cy="11" r="0.6" fill="currentColor" />
      <circle cx="14.5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function SwordsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 17.5L20 23M20 23l1-1m-1 1l-3-3M3 3v4l9 9 4-4L7 3H3z" />
      <path d="M21 3v4l-9 9-1-1M16 8l5-5" />
      <path d="M3 21l5-5" />
    </svg>
  );
}

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

export function TrophyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" />
      <path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" />
      <path d="M9 21h6M12 14v7" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.128 12.299 12.299 0 01-1.873.891.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.956 2.42-2.157 2.42zm7.974 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.946 2.42-2.157 2.42z" />
    </svg>
  );
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43V8.74a8.16 8.16 0 004.77 1.52V6.81a4.85 4.85 0 01-1.84-.12z" />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function RedditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.07a2.05 2.05 0 00-3.48-1.46 10.36 10.36 0 00-5.59-1.78l.95-4.49 3.13.66a1.46 1.46 0 102.93-.06A1.45 1.45 0 0018 3.6a1.43 1.43 0 00-1.3.83l-3.49-.74a.36.36 0 00-.28.06.34.34 0 00-.16.23l-1.07 5a10.32 10.32 0 00-5.66 1.78A2.05 2.05 0 002 12.07a2 2 0 001.18 1.86 4.6 4.6 0 00-.06.7c0 3.55 4.13 6.43 9.21 6.43s9.21-2.88 9.21-6.43a4.41 4.41 0 00-.07-.71A2 2 0 0022 12.07zM7.13 13.5a1.46 1.46 0 011.46 1.45 1.45 1.45 0 11-2.9 0 1.46 1.46 0 011.44-1.45zm8.18 4.43a5.55 5.55 0 01-3.36.93 5.49 5.49 0 01-3.34-.93.36.36 0 010-.51.37.37 0 01.51 0 4.79 4.79 0 002.85.77 4.85 4.85 0 002.85-.77.37.37 0 01.51 0 .36.36 0 01-.02.51zm-.16-2.95a1.45 1.45 0 111.45-1.45 1.46 1.46 0 01-1.45 1.45z" />
    </svg>
  );
}

export function YouTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23 6.27a3 3 0 00-2.11-2.11C19.05 3.66 12 3.66 12 3.66s-7.05 0-8.89.5A3 3 0 001 6.27 31.5 31.5 0 00.5 12 31.5 31.5 0 001 17.73a3 3 0 002.11 2.11c1.84.5 8.89.5 8.89.5s7.05 0 8.89-.5A3 3 0 0023 17.73 31.5 31.5 0 0023.5 12 31.5 31.5 0 0023 6.27zM9.75 15.5v-7L15.91 12z" />
    </svg>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ScissorsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  );
}
