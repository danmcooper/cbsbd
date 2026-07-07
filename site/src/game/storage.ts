export interface SavedProgress {
  flipped: number[];
  mistakes: number;
  elapsedMs: number;
  completed: boolean;
}

const key = (puzzleId: string) => `cbs:progress:${puzzleId}`;

function isSavedProgress(v: unknown): v is SavedProgress {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    Array.isArray(p.flipped) &&
    p.flipped.every((n) => Number.isInteger(n)) &&
    typeof p.mistakes === 'number' &&
    typeof p.elapsedMs === 'number' &&
    typeof p.completed === 'boolean'
  );
}

export function loadProgress(puzzleId: string): SavedProgress | null {
  const raw = localStorage.getItem(key(puzzleId));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSavedProgress(parsed)) return parsed;
  } catch {
    // fall through to reset
  }
  localStorage.removeItem(key(puzzleId)); // corrupt: reset this puzzle only
  return null;
}

export function saveProgress(puzzleId: string, progress: SavedProgress): void {
  localStorage.setItem(key(puzzleId), JSON.stringify(progress));
}
