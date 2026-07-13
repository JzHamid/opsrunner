"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppNavProps = {
  organizationSlug: string;
};

export function AppNav({ organizationSlug }: AppNavProps) {
  const pathname = usePathname();
  const basePath = `/org/${encodeURIComponent(organizationSlug)}`;
  const links = [
    { label: "Requests", href: `${basePath}/requests` },
    { label: "Run", href: `${basePath}/run` },
  ];

  return (
    <nav aria-label="Workspace" className="flex items-center gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent/20 ${
              isActive
                ? "bg-surface-muted text-foreground"
                : "text-muted hover:bg-surface-muted/70 hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
