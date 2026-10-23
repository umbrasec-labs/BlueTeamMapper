import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { stepStatusLabel, type Run, type RunStatus, type StepStatus } from '@/lib/runbook';
import { useRunbooks } from '@/store/runbooks';

/** Shared pieces for the runbook list and the live run view. */

/**
 * Delete with an inline "are you sure". Focus moves to Keep when the question opens, and back
 * to the delete button when it closes, so keyboard users keep their place.
 */
export function DeleteRunButton({
  run,
  withLabel = false,
  onDeleted,
}: {
  run: Run;
  withLabel?: boolean;
  onDeleted?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const toggled = useRef(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!toggled.current) return;
    (confirm ? keepRef : deleteRef).current?.focus();
  }, [confirm]);
  const ask = (on: boolean) => {
    toggled.current = true;
    setConfirm(on);
  };

  if (confirm) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2 py-1 text-xs">
        Delete this run and its timeline?
        <button
          type="button"
          className="rounded px-2 py-0.5 font-medium text-ember hover:bg-ember/20"
          onClick={() => {
            useRunbooks.getState().deleteRun(run.id);
            onDeleted?.();
          }}
        >
          Delete
        </button>
        <button ref={keepRef} type="button" className="rounded px-2 py-0.5 hover:bg-white/10" onClick={() => ask(false)}>
          Keep
        </button>
      </span>
    );
  }
  return withLabel ? (
    <button ref={deleteRef} type="button" className="btn" onClick={() => ask(true)}>
      <Trash2 aria-hidden className="h-4 w-4" /> Delete run
    </button>
  ) : (
    <button
      ref={deleteRef}
      type="button"
      className="rounded-md p-2 text-fog-muted transition hover:bg-white/5 hover:text-ember"
      aria-label={`Delete ${run.title}`}
      onClick={() => ask(true)}
    >
      <Trash2 aria-hidden className="h-4 w-4" />
    </button>
  );
}

const stepStatusStyle: Record<StepStatus, string> = {
  pending: 'border-white/10 text-fog-muted',
  active: 'border-ember/50 bg-ember/10 text-ember',
  done: 'border-sage/40 bg-sage/10 text-sage',
  skipped: 'border-khaki/40 bg-khaki/10 text-khaki',
};

export function StepStatusChip({ status }: { status: StepStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-2xs ${stepStatusStyle[status]}`}>
      {stepStatusLabel[status]}
    </span>
  );
}

export function RunStatusChip({ status }: { status: RunStatus }) {
  return status === 'active' ? (
    <span className="inline-flex items-center gap-1 rounded border border-ember/50 bg-ember/10 px-1.5 py-px font-mono text-2xs text-ember">
      <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" /> Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-sage/40 bg-sage/10 px-1.5 py-px font-mono text-2xs text-sage">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sage" /> Closed
    </span>
  );
}

export function RunProgressBar({ pct, label, closed = false }: { pct: number; label: string; closed?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className="h-1.5 overflow-hidden rounded-full bg-ink-700"
    >
      <motion.div
        className={`h-full rounded-full ${closed ? 'bg-sage' : 'bg-ember'}`}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}
