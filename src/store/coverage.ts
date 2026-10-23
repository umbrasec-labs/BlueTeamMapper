import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CoverageLevel } from '@/data/coverage';

/**
 * The viewer's own coverage self-assessment. Lives only in this browser
 * (localStorage); export/import a Navigator layer to move it elsewhere.
 */
interface CoverageState {
  levels: Record<string, CoverageLevel>;
  sources: Record<string, boolean>;
  /** True while the loaded assessment is the bundled example, until the viewer edits it. */
  isExample: boolean;
  setLevel: (techniqueId: string, level: CoverageLevel | null) => void;
  toggleSource: (label: string) => void;
  setSources: (labels: string[], on: boolean) => void;
  replace: (levels: Record<string, CoverageLevel>, sources: Record<string, boolean>, isExample?: boolean) => void;
  reset: () => void;
}

// localStorage can throw (private windows, blocked storage); fall back to memory.
const safeStorage = createJSONStorage(() => {
  try {
    const probe = '__btm_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useCoverage = create<CoverageState>()(
  persist(
    (set) => ({
      levels: {},
      sources: {},
      isExample: false,
      setLevel: (id, level) =>
        set((s) => {
          const levels = { ...s.levels };
          if (level) levels[id] = level;
          else delete levels[id];
          return { levels, isExample: false };
        }),
      toggleSource: (label) => set((s) => ({ sources: { ...s.sources, [label]: !s.sources[label] }, isExample: false })),
      setSources: (labels, on) =>
        set((s) => ({ sources: { ...s.sources, ...Object.fromEntries(labels.map((l) => [l, on])) }, isExample: false })),
      replace: (levels, sources, isExample = false) => set({ levels, sources, isExample }),
      reset: () => set({ levels: {}, sources: {}, isExample: false }),
    }),
    { name: 'btm-coverage-v1', storage: safeStorage, version: 1 },
  ),
);

// Another tab saved: load its assessment here too. Rehydrating sets state without writing it
// back, so this cannot loop between tabs. A null key means that tab cleared all of storage.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'btm-coverage-v1' || e.key === null) void useCoverage.persist.rehydrate();
  });
}
