import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();
// Scans arrive as one batched POST; a long walk is well under this cap.
app.use(express.json({ limit: '10mb' }));

const measurementSchema = z.object({
  timestamp: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rssi: z.number().int().min(-127).max(0),
  ssid: z.string().min(1),
  bssid: z.string().regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i),
  frequency: z.number().int().nonnegative(),
  trackingQuality: z.enum(['TRACKING', 'LIMITED', 'INITIALIZING', 'UNAVAILABLE']),
  room: z.string().nullable(),
});

const scanUploadSchema = z.object({
  startedAt: z.number().int().positive(),
  endedAt: z.number().int().positive(),
  ssid: z.string().nullable(),
  measurements: z.array(measurementSchema).min(1).max(50000),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/scans', async (req, res) => {
  const parsed = scanUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid scan payload', details: parsed.error.issues.slice(0, 5) });
    return;
  }
  const { startedAt, endedAt, ssid, measurements } = parsed.data;
  const scan = await prisma.scan.create({
    data: { startedAt: new Date(startedAt), endedAt: new Date(endedAt), ssid },
  });
  await prisma.measurement.createMany({
    data: measurements.map((m) => ({
      scanId: scan.id,
      timestamp: new Date(m.timestamp),
      x: m.x,
      y: m.y,
      z: m.z,
      rssi: m.rssi,
      ssid: m.ssid,
      bssid: m.bssid,
      frequency: m.frequency,
      trackingQuality: m.trackingQuality,
      room: m.room,
    })),
  });
  res.status(201).json({ id: scan.id, measurementCount: measurements.length });
});

app.get('/api/scans', async (_req, res) => {
  const scans = await prisma.scan.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { measurements: true } } },
  });
  res.json(
    scans.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      ssid: s.ssid,
      measurementCount: s._count.measurements,
    }))
  );
});

app.get('/api/scans/:id', async (req, res) => {
  const scan = await prisma.scan.findUnique({
    where: { id: req.params.id },
    include: { measurements: { orderBy: { timestamp: 'asc' } } },
  });
  if (!scan) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  res.json(scan);
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`wifi-ar backend listening on :${PORT}`);
});
