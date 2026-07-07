import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ExtractError,
  extractMetadata,
  extractPeopleArray,
  findBundleUrl,
  normalizePuzzle,
} from './lib/extract-core.mts';
import { regenerateManifest } from './manifest.mts';

export interface ExtractOptions {
  fetchImpl?: typeof fetch;
  puzzlesDir?: string;
  dateOverride?: string;
}

export function resolvePageUrl(input: string | undefined): string {
  if (!input) return 'https://cluesbysam.com/';
  if (/^[0-9a-f]{12}$/.test(input)) return `https://cluesbysam.com/s/play?puzzleId=${input}`;
  if (/^https?:\/\//.test(input)) return input;
  throw new ExtractError('page-fetch', `input is neither a URL nor a 12-hex puzzleId: ${input}`);
}

export async function runExtract(
  input: string | undefined,
  opts: ExtractOptions = {},
): Promise<{ status: 'written' | 'already-have'; file: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const puzzlesDir = opts.puzzlesDir ?? path.join(process.cwd(), 'puzzles');
  if (opts.dateOverride !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(opts.dateOverride)) {
    throw new ExtractError('validation', `dateOverride must be YYYY-MM-DD, got: ${opts.dateOverride}`);
  }

  const pageUrl = resolvePageUrl(input);
  const pageRes = await fetchImpl(pageUrl);
  if (!pageRes.ok) throw new ExtractError('page-fetch', `${pageUrl} -> HTTP ${pageRes.status}`);
  const html = await pageRes.text();

  const bundleUrl = findBundleUrl(html, pageUrl);
  const bundleRes = await fetchImpl(bundleUrl);
  if (!bundleRes.ok) throw new ExtractError('bundle-fetch', `${bundleUrl} -> HTTP ${bundleRes.status}`);
  const bundleText = await bundleRes.text();

  const meta = extractMetadata(bundleText);
  if (opts.dateOverride) meta.date = opts.dateOverride;
  const puzzle = normalizePuzzle(meta, extractPeopleArray(bundleText));

  const file = path.join(puzzlesDir, `${puzzle.date}.json`);
  if (existsSync(file)) {
    const existing = JSON.parse(await readFile(file, 'utf8')) as { id?: string };
    if (existing.id === puzzle.id) return { status: 'already-have', file };
    throw new ExtractError(
      'conflict',
      `${file} already exists with different puzzle id (${existing.id}) - refusing to overwrite`,
    );
  }
  await mkdir(puzzlesDir, { recursive: true });
  await writeFile(file, JSON.stringify(puzzle, null, 2) + '\n');
  await regenerateManifest(puzzlesDir);
  return { status: 'written', file };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runExtract(process.argv[2], { dateOverride: process.env.DATE_OVERRIDE || undefined }).then(
    (r) => console.log(`${r.status}: ${r.file}`),
    (e) => {
      console.error(String(e));
      process.exit(1);
    },
  );
}
