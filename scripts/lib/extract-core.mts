import vm from 'node:vm';

export type ExtractStage =
  | 'page-fetch'
  | 'bundle-discovery'
  | 'bundle-fetch'
  | 'array-parse'
  | 'metadata-parse'
  | 'validation'
  | 'conflict';

export class ExtractError extends Error {
  constructor(
    public stage: ExtractStage,
    message: string,
  ) {
    super(`[${stage}] ${message}`);
    this.name = 'ExtractError';
  }
}

export function findBundleUrl(html: string, pageUrl: string): string {
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    if (!/type="module"/.test(tag)) continue;
    const src = tag.match(/src="([^"]+)"/);
    if (src && /assets\/index-[^"/]*\.js$/.test(src[1])) {
      return new URL(src[1], pageUrl).href;
    }
  }
  throw new ExtractError('bundle-discovery', 'no module script matching assets/index-*.js in page HTML');
}

export function extractPeopleArray(bundle: string): unknown[] {
  const start = bundle.indexOf('[{criminal:');
  if (start === -1) throw new ExtractError('array-parse', 'signature "[{criminal:" not found in bundle');
  let depth = 0;
  let end = -1;
  let inString: string | null = null;
  for (let i = start; i < bundle.length; i++) {
    const c = bundle[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === inString) inString = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inString = c;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new ExtractError('array-parse', 'unbalanced brackets after array signature');
  const src = bundle.slice(start, end + 1);
  let value: unknown;
  try {
    value = vm.runInNewContext(`(${src})`, Object.create(null), { timeout: 1000 });
  } catch (e) {
    throw new ExtractError('array-parse', `sandbox evaluation of array slice failed: ${String(e)}`);
  }
  if (!Array.isArray(value)) throw new ExtractError('array-parse', 'evaluated slice is not an array');
  return value;
}
