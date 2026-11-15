'use client';

/**
 * A quiet rail showing where the member is in a consultation.
 * Purely visual orientation; it does not navigate.
 */
export interface ConsultationStage {
  id: string;
  label: string;
}

interface ConsultationStagesProps {
  stages: ConsultationStage[];
  current: string;
}

export function ConsultationStages({ stages, current }: ConsultationStagesProps) {
  const currentIndex = Math.max(0, stages.findIndex((s) => s.id === current));
  return (
    <ol aria-label="Consultation stages" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {stages.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <li
            key={s.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={`flex items-center gap-2 text-[13px] ${
              isCurrent ? 'text-[#F3DDBF]' : isPast ? 'text-white/60' : 'text-white/40'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                isCurrent
                  ? 'bg-[#E4C8A6] shadow-[0_0_10px_rgba(228,200,166,0.7)]'
                  : isPast
                    ? 'bg-white/45'
                    : 'bg-white/15'
              }`}
            />
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
