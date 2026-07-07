import type { ManifestEntry } from '../../../scripts/manifest.mts';
import { useFetch } from '../useFetch';
import { groupByMonth, statusFor } from './archiveData';

export default function Archive() {
  const { data, error, retry } = useFetch<ManifestEntry[]>('puzzles/index.json');
  if (error) {
    return (
      <main>
        <p>Failed to load the archive: {error}</p>
        <button onClick={retry}>Retry</button>
      </main>
    );
  }
  if (!data) return <p>Loading…</p>;
  return (
    <main className="archive">
      <h1>Puzzle Archive</h1>
      {data.length === 0 && <p>No puzzles yet — the scraper runs daily.</p>}
      {groupByMonth(data).map((group) => (
        <section key={group.month}>
          <h2>{group.month}</h2>
          <ul>
            {group.entries.map((entry) => (
              <li key={entry.date}>
                <a href={`#/play/${entry.date}`}>
                  <span className="arch-date">{entry.date}</span>
                  <span className="arch-title">{entry.title}</span>
                  <span className="arch-difficulty">{entry.difficulty}</span>
                  <span className={`arch-status status-${statusFor(entry.id).replace(' ', '-')}`}>
                    {statusFor(entry.id)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
