import { readSettings } from '@/lib/settings';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const settings = readSettings();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Control how the competitor intelligence tool runs.
        </p>
      </header>
      <SettingsForm initial={settings} />
    </div>
  );
}
