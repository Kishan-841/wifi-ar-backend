import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RSSI_BANDS, buildGrid, rssiToColor, summarizeRooms } from '@/lib/heatmap';
import { fetchScan, getSession } from '@/lib/scans';
import { redirect } from 'next/navigation';

const CELL_PX = 28;

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const scan = await fetchScan(session, id);
  if (!scan) notFound();

  const cells = buildGrid(scan.measurements);
  const minCx = Math.min(...cells.map((c) => c.cx));
  const maxCx = Math.max(...cells.map((c) => c.cx));
  const minCz = Math.min(...cells.map((c) => c.cz));
  const maxCz = Math.max(...cells.map((c) => c.cz));
  const width = (maxCx - minCx + 1) * CELL_PX;
  const height = (maxCz - minCz + 1) * CELL_PX;
  const rooms = summarizeRooms(scan.measurements);
  const durationS = Math.round(
    (new Date(scan.endedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000
  );

  // Room label positions: centroid of each room's cells.
  const roomLabels = new Map<string, { sx: number; sz: number; n: number }>();
  for (const c of cells) {
    if (!c.room) continue;
    const acc = roomLabels.get(c.room) ?? { sx: 0, sz: 0, n: 0 };
    acc.sx += c.cx;
    acc.sz += c.cz;
    acc.n += 1;
    roomLabels.set(c.room, acc);
  }

  return (
    <main className="wrap">
      <p>
        <Link href="/">← All scans</Link>
      </p>
      <h1>{scan.ssid ?? 'Unknown network'}</h1>
      <p className="scanMeta">
        {scan.user ? `Recorded by ${scan.user.name} · ` : ''}
        {new Date(scan.startedAt).toLocaleString()} · {durationS}s · {scan.measurements.length}{' '}
        points · {cells.length} cells
      </p>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="heatmap"
        role="img"
        aria-label="Signal heatmap"
      >
        {cells.map((c) => (
          <rect
            key={`${c.cx},${c.cz}`}
            x={(c.cx - minCx) * CELL_PX}
            y={(c.cz - minCz) * CELL_PX}
            width={CELL_PX - 1}
            height={CELL_PX - 1}
            rx={3}
            fill={rssiToColor(c.medianRssi)}
          >
            <title>{`(${c.cx}, ${c.cz}) median ${c.medianRssi} dBm, n=${c.n}`}</title>
          </rect>
        ))}
        {Array.from(roomLabels.entries()).map(([room, a]) => (
          <text
            key={room}
            x={(a.sx / a.n - minCx) * CELL_PX + CELL_PX / 2}
            y={(a.sz / a.n - minCz) * CELL_PX + CELL_PX / 2}
            className="roomLabel"
            textAnchor="middle"
          >
            {room}
          </text>
        ))}
      </svg>

      <div className="legend">
        {RSSI_BANDS.slice(0, 5).map((b) => (
          <span key={b.label} className="legendItem">
            <span className="swatch" style={{ background: b.color }} />
            {b.label} (≥{b.min})
          </span>
        ))}
      </div>

      <h2>Rooms</h2>
      <table className="roomTable">
        <thead>
          <tr>
            <th>Room</th>
            <th>Points</th>
            <th>Median</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.room}>
              <td>{r.room}</td>
              <td>{r.points}</td>
              <td style={{ color: rssiToColor(r.medianRssi) }}>{r.medianRssi} dBm</td>
              <td>
                {r.minRssi}…{r.maxRssi} dBm
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
