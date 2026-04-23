import { readCompetitors } from '@/lib/competitors';
import { CompetitorsManager } from './competitors-manager';

export const dynamic = 'force-dynamic';

export default function CompetitorsPage() {
  const competitors = readCompetitors();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Competitors</h1>
        <p className="text-slate-600 mt-1">
          Add, remove, and toggle competitors that get tracked in the weekly report.
        </p>
      </header>
      <CompetitorsManager initial={competitors} />
    </div>
  );
}
