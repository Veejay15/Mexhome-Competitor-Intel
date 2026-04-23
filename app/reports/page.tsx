import Link from 'next/link';
import { listReports } from '@/lib/reports';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  const reports = listReports();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-600 mt-1">
          All weekly competitor intelligence reports.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
          <p className="text-slate-600">
            No reports yet. Run the first report from the{' '}
            <Link href="/run-report" className="text-blue-600 underline">
              Run Report
            </Link>{' '}
            page.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.date}>
              <Link
                href={`/reports/${r.date}`}
                className="block bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-400 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h2 className="font-semibold text-slate-900">{r.title}</h2>
                    {r.excerpt ? (
                      <p className="text-sm text-slate-600 mt-1.5">{r.excerpt}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(r.date)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
