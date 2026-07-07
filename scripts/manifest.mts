import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePuzzle } from '../shared/puzzle.ts';

export interface ManifestEntry {
  date: string;
  id: string;
  difficulty: string;
  title: string;
}

export async function regenerateManifest(puzzlesDir: string): Promise<ManifestEntry[]> {
  const files = (await readdir(puzzlesDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const entries: ManifestEntry[] = [];
  for (const file of files) {
    let puzzle;
    try {
      puzzle = validatePuzzle(JSON.parse(await readFile(path.join(puzzlesDir, file), 'utf8')));
    } catch (e) {
      throw new Error(`${file}: ${String(e)}`);
    }
    entries.push({ date: puzzle.date, id: puzzle.id, difficulty: puzzle.difficulty, title: puzzle.title });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  await writeFile(path.join(puzzlesDir, 'index.json'), JSON.stringify(entries, null, 2) + '\n');
  return entries;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  regenerateManifest(path.join(process.cwd(), 'puzzles')).then(
    (entries) => console.log(`index.json: ${entries.length} puzzles`),
    (e) => {
      console.error(String(e));
      process.exit(1);
    },
  );
}
