import { UploadClient } from './upload-client';
import { readCompetitors } from '@/lib/competitors';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  const competitors = readCompetitors();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Upload SEMrush CSVs</h1>
        <p className="text-slate-600 mt-1">
          Drop your weekly SEMrush exports here. They get stored in this week's data
          folder and used by the next report run.
        </p>
      </header>
      <UploadClient competitors={competitors} />
    </div>
  );
}
