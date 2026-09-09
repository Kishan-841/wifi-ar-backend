import express from 'express';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { hashPassword, login, logout, me, requireAdmin, requireAuth } from './auth';

const prisma = new PrismaClient();
const app = express();
// Behind Caddy (deploy/), req.ip must come from X-Forwarded-For, otherwise the
// login rate limit keys on the proxy's address and one bad guess locks everyone.
app.set('trust proxy', 1);
// Scans arrive as one batched POST; a long walk is well under this cap.
app.use(express.json({ limit: '10mb' }));

// ---------- schemas ----------

/**
 * Paging for list endpoints: ?limit=20&offset=0&q=kitchen
 * Offset paging (not cursors) because lists are small per user, searches
 * change the ordering anyway, and "showing 20 of 57" needs a total.
 */
function pageParams(req: express.Request) {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  return { limit, offset, q };
}
const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });
function page<T>(items: T[], total: number, offset: number, limit: number) {
  return { items, total, nextOffset: offset + items.length < total ? offset + limit : null };
}

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

const userCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

// ---------- public ----------

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many login attempts — try again in 15 minutes' },
});
app.post('/api/auth/login', loginLimiter, login(prisma));

// ---------- everything below requires a session ----------

app.use('/api', requireAuth(prisma));

app.post('/api/auth/logout', logout(prisma));
app.get('/api/auth/me', me);

// ---------- scans (scoped to the caller) ----------

app.post('/api/scans', async (req, res) => {
  const parsed = scanUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid scan payload', details: parsed.error.issues.slice(0, 5) });
    return;
  }
  const { startedAt, endedAt, ssid, shapeW, shapeH, measurements } = parsed.data;
  const scan = await prisma.scan.create({
    data: {
      userId: req.user!.id,
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

app.get('/api/scans', async (req, res) => {
  const { limit, offset, q } = pageParams(req);
  const where = {
    userId: req.user!.id,
    ...(q
      ? { OR: [{ ssid: contains(q) }, { measurements: { some: { room: contains(q) } } }] }
      : {}),
  };
  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        _count: { select: { measurements: true } },
        measurements: { select: { room: true }, where: { room: { not: null } }, take: 1 },
      },
    }),
    prisma.scan.count({ where }),
  ]);
  res.json(
    page(
      scans.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        ssid: s.ssid,
        shapeW: s.shapeW,
        shapeH: s.shapeH,
        room: s.measurements[0]?.room ?? null,
        measurementCount: s._count.measurements,
      })),
      total,
      offset,
      limit
    )
  );
});

app.get('/api/scans/:id', async (req, res) => {
  const scan = await prisma.scan.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { measurements: { orderBy: { timestamp: 'asc' } } },
  });
  if (!scan) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  res.json(scan);
});

app.delete('/api/scans/:id', async (req, res) => {
  const { count } = await prisma.scan.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (count === 0) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  res.json({ deleted: req.params.id });
});

// ---------- layouts (scoped to the caller) ----------

app.post('/api/layouts', async (req, res) => {
  const parsed = layoutCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid layout', details: parsed.error.issues.slice(0, 5) });
    return;
  }
  const layout = await prisma.layout.create({ data: { ...parsed.data, userId: req.user!.id } });
  res.status(201).json(layout);
});

app.get('/api/layouts', async (req, res) => {
  const { limit, offset, q } = pageParams(req);
  const where = { userId: req.user!.id, ...(q ? { name: contains(q) } : {}) };
  const [layouts, total] = await Promise.all([
    prisma.layout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: { _count: { select: { placements: true } } },
    }),
    prisma.layout.count({ where }),
  ]);
  res.json(
    page(
      layouts.map((l) => ({
        id: l.id,
        name: l.name,
        cols: l.cols,
        rows: l.rows,
        placementCount: l._count.placements,
      })),
      total,
      offset,
      limit
    )
  );
});

app.get('/api/layouts/:id', async (req, res) => {
  const layout = await prisma.layout.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { placements: true },
  });
  if (!layout) {
    res.status(404).json({ error: 'layout not found' });
    return;
  }
  res.json(layout);
});

app.delete('/api/layouts/:id', async (req, res) => {
  const { count } = await prisma.layout.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (count === 0) {
    res.status(404).json({ error: 'layout not found' });
    return;
  }
  res.json({ deleted: req.params.id });
});

app.put('/api/layouts/:id', async (req, res) => {
  const parsed = layoutUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid layout update', details: parsed.error.issues.slice(0, 5) });
    return;
  }
  const { placements, ...fields } = parsed.data;
  const existing = await prisma.layout.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: 'layout not found' });
    return;
  }
  // Placements may only reference the caller's own scans.
  const ownScans = await prisma.scan.findMany({
    where: { id: { in: placements.map((p) => p.scanId) }, userId: req.user!.id },
    select: { id: true },
  });
  const ownIds = new Set(ownScans.map((s) => s.id));
  const validPlacements = placements.filter((p) => ownIds.has(p.scanId));
  // Placements are replaced wholesale — the board's saved state IS the list.
  const layout = await prisma.$transaction(async (tx) => {
    await tx.roomPlacement.deleteMany({ where: { layoutId: existing.id } });
    return tx.layout.update({
      where: { id: existing.id },
      data: { ...fields, placements: { create: validPlacements } },
      include: { placements: true },
    });
  });
  res.json(layout);
});

// ---------- admin ----------

app.use('/api/admin', requireAdmin);

app.get('/api/admin/users', async (req, res) => {
  const { limit, offset, q } = pageParams(req);
  const where = q ? { OR: [{ name: contains(q) }, { email: contains(q) }] } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
      include: { _count: { select: { scans: true, layouts: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  res.json(
    page(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        scanCount: u._count.scans,
        layoutCount: u._count.layouts,
      })),
      total,
      offset,
      limit
    )
  );
});

app.post('/api/admin/users', async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'name, valid email and password (8+ chars) required' });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    res.status(409).json({ error: 'a user with that email already exists' });
    return;
  }
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash: await hashPassword(parsed.data.password), role: 'user' },
  });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'you cannot delete your own admin account' });
    return;
  }
  const { count } = await prisma.user.deleteMany({ where: { id: req.params.id, role: 'user' } });
  if (count === 0) {
    res.status(404).json({ error: 'user not found (admins cannot be deleted here)' });
    return;
  }
  res.json({ deleted: req.params.id }); // sessions, scans, layouts cascade
});

app.get('/api/admin/scans', async (req, res) => {
  const { limit, offset, q } = pageParams(req);
  const where = q
    ? {
        OR: [
          { ssid: contains(q) },
          { measurements: { some: { room: contains(q) } } },
          { user: { name: contains(q) } },
          { user: { email: contains(q) } },
        ],
      }
    : {};
  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { measurements: true } },
        measurements: { select: { room: true }, where: { room: { not: null } }, take: 1 },
      },
    }),
    prisma.scan.count({ where }),
  ]);
  res.json(
    page(
      scans.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
        ssid: s.ssid,
        shapeW: s.shapeW,
        shapeH: s.shapeH,
        room: s.measurements[0]?.room ?? null,
        measurementCount: s._count.measurements,
        user: s.user,
      })),
      total,
      offset,
      limit
    )
  );
});

app.get('/api/admin/scans/:id', async (req, res) => {
  const scan = await prisma.scan.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      measurements: { orderBy: { timestamp: 'asc' } },
    },
  });
  if (!scan) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  res.json(scan);
});

app.get('/api/admin/layouts', async (_req, res) => {
  const layouts = await prisma.layout.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { placements: true } } },
  });
  res.json(
    layouts.map((l) => ({
      id: l.id,
      name: l.name,
      cols: l.cols,
      rows: l.rows,
      createdAt: l.createdAt,
      placementCount: l._count.placements,
      user: l.user,
    }))
  );
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`wifi-ar backend listening on :${PORT}`);
});
