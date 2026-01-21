/**
 * @jest-environment node
 */
import { prisma } from '@/lib/prisma';
import { toAppUser, toAppSession, toAppActivityLog } from '@/lib/db';

describe('Database Setup', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Prisma Client', () => {
    it('should connect to the database', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as value`;
      expect(result).toBeDefined();
    });

    it('should have User model available', () => {
      expect(prisma.user).toBeDefined();
    });

    it('should have Session model available', () => {
      expect(prisma.session).toBeDefined();
    });

    it('should have ActivityLog model available', () => {
      expect(prisma.activityLog).toBeDefined();
    });
  });

  describe('Type Converters', () => {
    it('should convert Prisma User to App User', () => {
      const prismaUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        status: 'pending',
        role: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      const appUser = toAppUser(prismaUser);

      expect(appUser.id).toBe('test-id');
      expect(appUser.username).toBe('testuser');
      expect(appUser.email).toBe('test@example.com');
      expect(appUser.status).toBe('pending');
      expect(appUser.role).toBe('none');
      expect(appUser.lastLoginAt).toBeUndefined();
    });

    it('should convert Prisma Session to App Session', () => {
      const prismaSession = {
        id: 'session-id',
        userId: 'user-id',
        token: 'token-123',
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      const appSession = toAppSession(prismaSession);

      expect(appSession.id).toBe('session-id');
      expect(appSession.userId).toBe('user-id');
      expect(appSession.token).toBe('token-123');
    });

    it('should convert Prisma ActivityLog to App ActivityLog', () => {
      const prismaLog = {
        id: 'log-id',
        userId: 'user-id',
        action: 'login',
        details: '{"ip": "127.0.0.1"}',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
      };

      const appLog = toAppActivityLog(prismaLog);

      expect(appLog.id).toBe('log-id');
      expect(appLog.action).toBe('login');
      expect(appLog.details).toEqual({ ip: '127.0.0.1' });
    });
  });
});
