'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/competitors', label: 'Competitors' },
  { href: '/upload', label: 'Upload CSVs' },
  { href: '/run-report', label: 'Run Report' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/mexhome-logo.png"
            alt="MexHome"
            width={140}
            height={32}
            priority
            className="h-8 w-auto"
          />
          <span className="text-sm font-medium text-slate-500 border-l border-slate-300 pl-3">
            Competitor Intel
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {l.label}
              </Link>
            );
          })}
          <a
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            title="How to use this tool (opens in new tab)"
            className="ml-2 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Help"
          >
            <HelpCircle size={18} />
          </a>
        </div>
      </div>
    </nav>
  );
}
