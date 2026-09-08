import Link from 'next/link';
import { redirect } from 'next/navigation';

import { fetchScans, getSession } from '@/lib/scans';

export default async function ScansListPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const isAdmin = session.user.role === 'admin';

  let scans;
  try {
    scans = await fetchScans(session);
  } catch {
    return (
      <main className="wrap">
        <h1>Recordings</h1>
        <p className="error">API unreachable. Is the backend running?</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>{isAdmin ? 'All recordings' : 'My recordings'}</h1>
      {scans.length === 0 && <p>No recordings yet.</p>}
      <table className="roomTable">
        <thead>
          <tr>
            <th>Room</th>
            {isAdmin && <th>Recorded by</th>}
            <th>When</th>
            <th>Size</th>
            <th>Points</th>
            <th>Network</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/scans/${s.id}`}>{s.room ?? '(untagged)'}</Link>
              </td>
              {isAdmin && <td>{s.user?.name ?? '—'}</td>}
              <td>{new Date(s.startedAt).toLocaleString()}</td>
              <td>{s.shapeW != null ? `${s.shapeW}×${s.shapeH}` : 'free-form'}</td>
              <td>{s.measurementCount}</td>
              <td>{s.ssid ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
