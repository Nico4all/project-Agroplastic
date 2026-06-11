import { ReactNode } from 'react';

type Props = {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'good' | 'bad' | 'warm';
};

const tones = {
  neutral: 'bg-ink text-white',
  good: 'bg-mint text-white',
  bad: 'bg-coral text-white',
  warm: 'bg-amber text-ink',
};

export function StatCard({ label, value, icon, tone = 'neutral' }: Props) {
  return (
    <div className={`rounded-lg p-4 shadow-soft ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}
