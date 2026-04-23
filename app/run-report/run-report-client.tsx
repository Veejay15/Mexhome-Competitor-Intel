'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

export function RunReportClient() {
  const [adminPassword, setAdminPassword] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/trigger-report', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to trigger workflow');
      } else {
        setResult(json.message || 'Workflow triggered. Check GitHub Actions for progress.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Admin password
          </label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Required to trigger run"
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 w-64"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={running || !adminPassword}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-700 disabled:opacity-50"
        >
          <Play size={16} />
          {running ? 'Triggering...' : 'Run weekly report now'}
        </button>

        {result ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
            {result}
          </div>
        ) : null}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-700 space-y-3">
        <h2 className="font-semibold text-slate-900">What happens next</h2>
        <ol className="list-decimal list-inside space-y-1 text-slate-600">
          <li>The system scans each competitor's website for new pages and content.</li>
          <li>It compares this week's data against last week's.</li>
          <li>It reads any SEMrush data you uploaded for the week.</li>
          <li>The AI analyst writes the intelligence report.</li>
          <li>The new report appears in the Reports tab when ready.</li>
        </ol>
        <p className="text-xs text-slate-500">
          Typical turnaround: 1 to 3 minutes.
        </p>
      </div>
    </div>
  );
}
