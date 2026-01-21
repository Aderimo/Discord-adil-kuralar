// Veritabanı yardımcı fonksiyonları ve tip dönüşümleri
import { prisma } from './prisma';
import type { User, Session, ActivityLog } from '@prisma/client';
import type {
  User as AppUser,
  Session as AppSession,
  ActivityLog as AppActivityLog,
  UserStatus,
  UserRole,
  ActivityAction,
} from '@/types';

// Prisma User -> App User dönüşümü
export function toAppUser(prismaUser: User): AppUser {
  return {
    id: prismaUser.id,
    username: prismaUser.username,
    email: prismaUser.email,
    status: prismaUser.status as UserStatus,
    role: prismaUser.role as UserRole,
    createdAt: prismaUser.createdAt,
    updatedAt: prismaUser.updatedAt,
    lastLoginAt: prismaUser.lastLoginAt ?? undefined,
  };
}

// Prisma Session -> App Session dönüşümü
export function toAppSession(prismaSession: Session): AppSession {
  return {
    id: prismaSession.id,
    userId: prismaSession.userId,
    token: prismaSession.token,
    expiresAt: prismaSession.expiresAt,
    createdAt: prismaSession.createdAt,
  };
}

// Prisma ActivityLog -> App ActivityLog dönüşümü
export function toAppActivityLog(prismaLog: ActivityLog): AppActivityLog {
  return {
    id: prismaLog.id,
    userId: prismaLog.userId,
    action: prismaLog.action as ActivityAction,
    details: JSON.parse(prismaLog.details) as Record<string, unknown>,
    ipAddress: prismaLog.ipAddress,
    timestamp: prismaLog.timestamp,
  };
}

// Veritabanı bağlantı kontrolü
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { prisma };
