import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/**
 * Sessions are opaque bearer tokens: 32 random bytes handed to the client,
 * only their SHA-256 stored server-side. Revocation is a row delete, so a
 * deleted user (cascade) or a logout kills the token instantly — no JWT
 * "valid until expiry" problem.
 */

export type AuthUser = { id: string; name: string; email: string; role: 'admin' | 'user' };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionTokenHash?: string;
    }
  }
}

const SESSION_DAYS = 30;

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export function requireAuth(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'login required' });
      return;
    }
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'session expired — log in again' });
      return;
    }
    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role as AuthUser['role'],
    };
    req.sessionTokenHash = tokenHash;
    // Touch lastUsedAt at most once a minute to keep writes cheap.
    if (Date.now() - session.lastUsedAt.getTime() > 60_000) {
      prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'admin only' });
    return;
  }
  next();
}

export function login(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'email and password required' });
      return;
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Compare even when the user is missing so timing doesn't reveal valid emails.
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : (await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'), false);
    if (!user || !ok) {
      res.status(401).json({ error: 'invalid email or password' });
      return;
    }
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000),
      },
    });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  };
}

export function logout(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    if (req.sessionTokenHash) {
      await prisma.session.deleteMany({ where: { tokenHash: req.sessionTokenHash } });
    }
    res.json({ ok: true });
  };
}

export function me(req: Request, res: Response) {
  res.json(req.user);
}
