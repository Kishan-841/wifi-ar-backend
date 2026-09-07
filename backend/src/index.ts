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
  shapeW: z.number().int().min(1).max(100).nullable().optional(),
  shapeH: z.number().int().min(1).max(100).nullable().optional(),
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
  const { startedAt, endedAt, ssid, shapeW, shapeH, measurements } = parsed.data;
  const scan = await prisma.scan.create({
    data: {
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      ssid,
      shapeW: shapeW ?? null,
      shapeH: shapeH ?? null,
    },
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
    include: {
      _count: { select: { measurements: true } },
      // One measurement is enough to expose the scan's room tag in the list.
      measurements: { select: { room: true }, where: { room: { not: null } }, take: 1 },
    },
  });
  res.json(
    scans.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      ssid: s.ssid,
      shapeW: s.shapeW,
      shapeH: s.shapeH,
      room: s.measurements[0]?.room ?? null,
      measurementCount: s._count.measurements,
    }))
  );
});

app.delete('/api/scans/:id', async (req, res) => {
  const scan = await prisma.scan.findUnique({ where: { id: req.params.id } });
  if (!scan) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  await prisma.scan.delete({ where: { id: req.params.id } }); // measurements cascade
  res.json({ deleted: req.params.id });
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

const placementSchema = z.object({
  scanId: z.string().uuid(),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  rotation: z.number().int().min(0).max(3),
});

const layoutCreateSchema = z.object({
  name: z.string().min(1).max(100),
  cols: z.number().int().min(4).max(200),
  rows: z.number().int().min(4).max(200),
});

const layoutUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cols: z.number().int().min(4).max(200).optional(),
  rows: z.number().int().min(4).max(200).optional(),
  routerCol: z.number().int().min(0).nullable().optional(),
  routerRow: z.number().int().min(0).nullable().optional(),
  placements: z.array(placementSchema).max(200),
});

app.post('/api/layouts', async (req, res) => {
  const parsed = layoutCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid layout', details: parsed.error.issues.slice(0, 5) });
    return;
  }
  const layout = await prisma.layout.create({ data: parsed.data });
  res.status(201).json(layout);
});

app.get('/api/layouts', async (_req, res) => {
  const layouts = await prisma.layout.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { placements: true } } },
  });
  res.json(
    layouts.map((l) => ({
      id: l.id,
      name: l.name,
      cols: l.cols,
      rows: l.rows,
      placementCount: l._count.placements,
    }))
  );
});

app.get('/api/layouts/:id', async (req, res) => {
  const layout = await prisma.layout.findUnique({
    where: { id: req.params.id },
    include: { placements: true },
  });
  if (!layout) {
    res.status(404).json({ error: 'layout not found' });
    return;
  }
  res.json(layout);
});

app.delete('/api/layouts/:id', async (req, res) => {
  const layout = await prisma.layout.findUnique({ where: { id: req.params.id } });
  if (!layout) {
    res.status(404).json({ error: 'layout not found' });
    return;
  }
  await prisma.layout.delete({ where: { id: req.params.id } }); // placements cascade
  res.json({ deleted: req.params.id });
});

app.put('/api/layouts/:id', async (req, res) => {
  const parsed = layoutUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid layout update', details: parsed.error.issues.slice(0, 5) });
    return;
  }
  const { placements, ...fields } = parsed.data;
  const existing = await prisma.layout.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'layout not found' });
    return;
  }
  // Placements are replaced wholesale — the board's saved state IS the list.
  const layout = await prisma.$transaction(async (tx) => {
    await tx.roomPlacement.deleteMany({ where: { layoutId: req.params.id } });
    return tx.layout.update({
      where: { id: req.params.id },
      data: {
        ...fields,
        placements: { create: placements },
      },
      include: { placements: true },
    });
  });
  res.json(layout);
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`wifi-ar backend listening on :${PORT}`);
});
