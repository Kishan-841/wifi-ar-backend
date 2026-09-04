import Link from 'next/link';

import { fetchScans } from '@/lib/scans';

export default async function ScansListPage() {
  let scans;
  try {
    scans = await fetchScans();
  } catch {
    return (
      <main className="wrap">
        <h1>WiFi AR — Scans</h1>
        <p className="error">
          API unreachable. Is the backend running? (<code>cd backend &amp;&amp; npm run dev</code>)
        </p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>WiFi AR — Scans</h1>
      {scans.length === 0 && <p>No scans yet — upload one from the app.</p>}
      <ul className="scanList">
        {scans.map((s) => (
          <li key={s.id}>
            <Link href={`/scans/${s.id}`} className="scanCard">
              <span className="scanTitle">{s.ssid ?? 'Unknown network'}</span>
              <span className="scanMeta">
                {new Date(s.startedAt).toLocaleString()} · {s.measurementCount} points
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
