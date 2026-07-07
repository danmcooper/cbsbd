import type { ManifestEntry } from '../../../scripts/manifest.mts';
import { loadProgress } from '../game/storage';

export type PuzzleStatus = 'unplayed' | 'in progress' | 'done';

export function statusFor(puzzleId: string): PuzzleStatus {
  const progress = loadProgress(puzzleId);
  if (!progress) return 'unplayed';
  return progress.completed ? 'done' : 'in progress';
}

export function groupByMonth(entries: ManifestEntry[]): { month: string; entries: ManifestEntry[] }[] {
  const groups: { month: string; entries: ManifestEntry[] }[] = [];
  for (const entry of entries) {
    const month = new Date(`${entry.date}T00:00:00`).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }
  return groups;
}
