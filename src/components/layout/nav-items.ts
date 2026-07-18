import type { LucideIcon } from "lucide-react";
import { ThumbsUp, Trophy, Upload, User } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/ranking",
    label: "ランキング",
    icon: Trophy,
    match: (path) => path.startsWith("/ranking"),
  },
  {
    href: "/evaluate",
    label: "評価",
    icon: ThumbsUp,
    match: (path) => path.startsWith("/evaluate"),
  },
  {
    href: "/upload",
    label: "投稿",
    icon: Upload,
    match: (path) => path.startsWith("/upload"),
  },
  {
    href: "/me",
    label: "マイページ",
    icon: User,
    match: (path) => path.startsWith("/me"),
  },
];
