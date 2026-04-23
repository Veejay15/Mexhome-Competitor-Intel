'use client';

import { useState, useRef } from 'react';
import { Competitor } from '@/lib/types';
import { Upload, FileText, Check } from 'lucide-react';
import { todayISO } from '@/lib/utils';

interface Props {
  competitors: Competitor[];
}

interface FileResult {
  filename: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export function UploadClient({ competitors }: Props) {
  const [files, setFiles] = useState<FileResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  async function handleFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    if (!adminPassword) {
      alert('Enter your admin password first.');
      return;
    }

    setUploading(true);
    const arr = Array.from(filesList);
    const initial: FileResult[] = arr.map((f) => ({
      filename: f.name,
      status: 'pending',
    }));
    setFiles(initial);

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(f);
      });
      const base64 = dataUrl.split(',')[1];

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
          body: JSON.stringify({
            filename: f.name,
            contentBase64: base64,
            date: today,
          }),
        });
        const json = await res.json();
        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  filename: f.name,
                  status: res.ok ? 'success' : 'error',
                  message: res.ok ? json.path : json.error,
                }
              : p
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { filename: f.name, status: 'error', message: (err as Error).message }
              : p
          )
        );
      }
    }
    setUploading(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Admin password
          </label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Required to upload"
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 w-64"
          />
        </div>
        <p className="text-xs text-slate-500">
          Files will be saved to this week's data folder ({today}).
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-slate-400 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload className="mx-auto text-slate-400" size={36} />
        <p className="mt-3 font-medium text-slate-900">
          Drop CSV files here or click to browse
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Multiple files OK. Name them like <code>diamonte-backlinks.csv</code> so
          we can match them to competitors.
        </p>
      </div>

      {files.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <h3 className="bg-slate-50 px-4 py-2.5 text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
            Upload status
          </h3>
          <ul className="divide-y divide-slate-100">
            {files.map((f, i) => (
              <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-900 truncate">{f.filename}</span>
                </div>
                <div className="text-xs flex-shrink-0">
                  {f.status === 'pending' ? (
                    <span className="text-slate-500">Uploading...</span>
                  ) : f.status === 'success' ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Check size={14} />
                      Saved
                    </span>
                  ) : (
                    <span className="text-red-600">{f.message || 'Failed'}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-slate-700">
        <p className="font-medium text-blue-900 mb-1">Tracked competitors for matching:</p>
        <ul className="space-y-0.5 text-xs">
          {competitors.map((c) => (
            <li key={c.id}>
              <code>{c.id}</code> ({c.name})
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs">
          Tip: prefix CSV filenames with the competitor id (e.g.{' '}
          <code>topmexicorealestate-backlinks.csv</code>).
        </p>
      </div>

      <p className="text-xs text-slate-500">
        {uploading ? 'Uploading...' : 'Ready'}
      </p>
    </div>
  );
}
