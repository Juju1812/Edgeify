"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  DiscordIcon,
  InstagramIcon,
  RedditIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon
} from "./icons";

type SocialItem = {
  href: string;
  icon: ReactNode;
  label: string;
  cta: string;
  iconColor?: string;
};

const items: SocialItem[] = [
  {
    href: "https://discord.gg/",
    icon: <DiscordIcon className="h-6 w-6" />,
    label: "Discord",
    cta: "Join the Discord",
    iconColor: "text-[#5865F2]"
  },
  {
    href: "https://tiktok.com/",
    icon: <TikTokIcon className="h-6 w-6" />,
    label: "TikTok",
    cta: "Follow MogOff",
    iconColor: "text-white"
  },
  {
    href: "https://instagram.com/",
    icon: <InstagramIcon className="h-6 w-6" />,
    label: "Instagram",
    cta: "Follow MogOff",
    iconColor: "text-pink-400"
  },
  {
    href: "https://reddit.com/",
    icon: <RedditIcon className="h-6 w-6" />,
    label: "Reddit",
    cta: "Follow MogOff",
    iconColor: "text-orange-500"
  },
  {
    href: "https://youtube.com/",
    icon: <YouTubeIcon className="h-6 w-6" />,
    label: "YouTube",
    cta: "Follow MogOff",
    iconColor: "text-red-500"
  },
  {
    href: "https://x.com/",
    icon: <XIcon className="h-5 w-5" />,
    label: "X / Twitter",
    cta: "Follow MogOff",
    iconColor: "text-white"
  }
];

export function SocialRow() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="glass glass-hover group flex items-center gap-4 rounded-2xl px-5 py-4"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/40 ${
              item.iconColor ?? "text-white"
            }`}
          >
            {item.icon}
          </span>
          <div className="flex-1">
            <p className="label-xs">{item.label}</p>
            <p className="text-sm tracking-wide text-white/80">{item.cta}</p>
          </div>
          <ArrowRightIcon className="h-4 w-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
        </Link>
      ))}
    </div>
  );
}
