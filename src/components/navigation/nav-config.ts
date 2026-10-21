import {
  Bookmark,
  Compass,
  Flame,
  FolderHeart,
  GitCompareArrows,
  GitFork,
  Gem,
  History,
  ListChecks,
  Search,
  Settings,
  Sparkle,
  Star,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to signed-in users when true. */
  requiresAuth?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Discover",
    items: [
      { href: "/explore", label: "Explore", icon: Search },
      { href: "/trending", label: "Trending", icon: Flame },
      { href: "/most-starred", label: "Most starred", icon: Star },
      { href: "/most-forked", label: "Most forked", icon: GitFork },
      { href: "/recently-updated", label: "Recently updated", icon: History },
      { href: "/recently-created", label: "Recently created", icon: Sparkle },
      { href: "/hidden-gems", label: "Hidden gems", icon: Gem },
      { href: "/topics", label: "Topics", icon: Tags },
      { href: "/awesome-lists", label: "Awesome lists", icon: ListChecks },
    ],
  },
  {
    label: "Tools",
    items: [{ href: "/compare", label: "Compare", icon: GitCompareArrows }],
  },
  {
    label: "Library",
    items: [
      { href: "/saved", label: "Saved repositories", icon: Bookmark, requiresAuth: true },
      { href: "/collections", label: "Collections", icon: FolderHeart, requiresAuth: true },
      { href: "/saved-searches", label: "Saved searches", icon: Compass, requiresAuth: true },
      { href: "/settings", label: "Settings", icon: Settings, requiresAuth: true },
    ],
  },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
