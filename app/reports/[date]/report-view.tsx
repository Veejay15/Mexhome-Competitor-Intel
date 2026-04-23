'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, Trash2 } from 'lucide-react';

interface Props {
  date: string;
  markdown: string;
}

export function ReportView({ date, markdown }: Props) {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDownloadPDF() {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = `mexhome-competitor-report-${date}.pdf`;
      const options = {
        margin: [0.6, 0.6, 0.7, 0.6],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await html2pdf().set(options as any).from(reportRef.current).save();
    } catch (err) {
      alert(`Failed to generate PDF: ${(err as Error).message}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!adminPassword) {
      alert('Enter your admin password to delete this report.');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${date}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to delete report.');
        setDeleting(false);
        return;
      }
      router.push('/reports');
      router.refresh();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-50"
        >
          <Download size={14} />
          {downloading ? 'Generating PDF...' : 'Download PDF'}
        </button>
        <button
          onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
          className="inline-flex items-center gap-1.5 text-sm bg-white border border-slate-300 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {showDeleteConfirm ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-red-900">Delete this report?</p>
            <p className="text-xs text-red-700 mt-0.5">
              This permanently removes the report. This cannot be undone.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 w-48"
            />
            <button
              onClick={handleDelete}
              disabled={deleting || !adminPassword}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Confirm delete'}
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setAdminPassword('');
              }}
              className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <article
        ref={reportRef}
        className="prose-report bg-white rounded-lg border border-slate-200 p-8"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
