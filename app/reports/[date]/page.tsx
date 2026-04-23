import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readReport } from '@/lib/reports';
import { formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { ReportView } from './report-view';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ date: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { date } = await params;
  const markdown = readReport(date);
  if (!markdown) {
    notFound();
  }
  return (
    <div className="space-y-4">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={14} />
        All reports
      </Link>
      <p className="text-xs text-slate-500">
        Report dated {formatDate(date)}
      </p>
      <ReportView date={date} markdown={markdown} />
    </div>
  );
}
