// Auth servisi - şifre hashleme, JWT token yönetimi ve oturum işlemleri
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import type { Session } from '@prisma/client';
import type { User, UserRole, UserStatus } from '@/types';

// JWT secret - production'da environment variable kullanılmalı
const JWT_SECRET = process.env.JWT_SECRET || 'yetkili-kilavuzu-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token 7 gün geçerli
const SALT_ROUNDS = 10;

// Şifre hashleme
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Şifre doğrulama
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token payload tipi
export interface TokenPayload {
  userId: string;
  role: UserRole;
  status: UserStatus;
}

// JWT token oluşturma - kullanıcı bilgileriyle birlikte
export function generateToken(userId: string, role: UserRole = 'none', status: UserStatus = 'pending'): string {
  return jwt.sign({ userId, role, status }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Basit token oluşturma (geriye uyumluluk için)
export function generateSimpleToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// JWT token doğrulama
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// Oturum oluşturma - kullanıcı bilgileriyle birlikte token oluşturur
export async function createSession(
  userId: string,
  role: UserRole = 'none',
  status: UserStatus = 'pending'
): Promise<Session> {
  const token = generateToken(userId, role, status);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 gün sonra expire

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return session;
}

// Kullanıcı bilgileri değiştiğinde token'ı yenile
export async function refreshSessionToken(
  oldToken: string,
  role: UserRole,
  status: UserStatus
): Promise<Session | null> {
  const session = await validateSession(oldToken);
  if (!session) {
    return null;
  }

  // Eski oturumu sil
  await deleteSession(oldToken);

  // Yeni token ile oturum oluştur
  return createSession(session.userId, role, status);
}

// Oturum silme (logout)
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

// Token ile oturum doğrulama
export async function validateSession(token: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { token },
  });

  if (!session) {
    return null;
  }

  // Oturum süresi dolmuş mu kontrol et
  if (session.expiresAt < new Date()) {
    await deleteSession(token);
    return null;
  }

  return session;
}

// Token ile kullanıcı bilgisi getirme
export async function getUserFromToken(token: string): Promise<User | null> {
  const session = await validateSession(token);
  if (!session) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user.findUnique as any)({
    where: { id: session.userId },
    include: {
      role: true,
    },
  });

  if (!user) {
    return null;
  }

  // Handle both old schema (role as string) and new schema (role as relation)
  let roleCode: string | null = null;
  let roleId: string | null = null;

  if (typeof user.role === 'string') {
    // Old schema - role is a string directly
    roleCode = user.role;
  } else if (user.role && typeof user.role === 'object') {
    // New schema - role is a relation object
    roleCode = user.role.code;
    roleId = user.role.id;
  }

  // If roleId exists on user directly, use that
  if (user.roleId) {
    roleId = user.roleId;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status as UserStatus,
    role: roleCode,
    roleId: roleId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? undefined,
  };
}

// Email validasyonu
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Şifre validasyonu (en az 8 karakter)
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// Cookie'den session bilgisi alma (server-side)
// Not: Bu fonksiyon Next.js API route'larında kullanılır
export async function getSessionFromCookie(): Promise<{ userId: string } | null> {
  // Server-side'da cookie'ye erişim için next/headers kullanılmalı
  // Ancak bu fonksiyon API route'larında çağrıldığında request'ten alınmalı
  // Bu basit implementasyon null döner - gerçek implementasyon request'ten almalı
  return null;
}
