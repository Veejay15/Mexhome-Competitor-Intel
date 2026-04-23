'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Report } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Props {
  initial: Report[];
}

export function ReportsList({ initial }: Props) {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>(initial);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState<string | null>(null);

  async function handleDelete(date: string) {
    setDeletingDate(date);
    try {
      const res = await fetch(`/api/reports/${date}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to delete report.');
        setDeletingDate(null);
        return;
      }
      setReports((prev) => prev.filter((r) => r.date !== date));
      setConfirmDate(null);
      router.refresh();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    } finally {
      setDeletingDate(null);
    }
  }

  return (
    <ul className="space-y-3">
      {reports.map((r) => {
        const isConfirming = confirmDate === r.date;
        const isDeleting = deletingDate === r.date;
        return (
          <li
            key={r.date}
            className="bg-white rounded-lg border border-slate-200 hover:border-slate-400 transition-colors"
          >
            <div className="flex justify-between items-start gap-4 p-5">
              <Link href={`/reports/${r.date}`} className="flex-1 min-w-0 group">
                <h2 className="font-semibold text-slate-900 group-hover:text-blue-600">
                  {r.title}
                </h2>
                {r.excerpt ? (
                  <p className="text-sm text-slate-600 mt-1.5 line-clamp-2">
                    {r.excerpt}
                  </p>
                ) : null}
              </Link>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(r.date)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/reports/${r.date}`}
                    className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md hover:bg-slate-700"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => setConfirmDate(isConfirming ? null : r.date)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete report"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            {isConfirming ? (
              <div className="bg-red-50 border-t border-red-200 px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-red-900">
                  Delete this report permanently?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(r.date)}
                    disabled={isDeleting}
                    className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDate(null)}
                    className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
