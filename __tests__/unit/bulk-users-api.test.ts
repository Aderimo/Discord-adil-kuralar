/**
 * Bulk Users API Unit Tests
 * Requirement 5.5: THE System SHALL support bulk operations for approving/rejecting multiple users
 * 
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock prisma
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    activityLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

// Mock api-auth
const mockAdminUser = {
  id: 'admin-123',
  username: 'admin',
  email: 'admin@test.com',
  role: 'admin',
  status: 'approved',
};

jest.mock('@/lib/api-auth', () => ({
  withAdmin: (handler: Function) => {
    return async (request: NextRequest, context: { params: Record<string, string> }) => {
      return handler(request, { ...context, user: mockAdminUser });
    };
  },
}));

// Import after mocks
import { POST } from '@/app/api/admin/users/bulk/route';

describe('Bulk Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost/api/admin/users/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  describe('POST /api/admin/users/bulk', () => {
    it('should reject empty userIds array', async () => {
      const request = createRequest({
        userIds: [],
        action: 'approve',
        role: 'mod',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('userIds');
    });

    it('should reject invalid action', async () => {
      const request = createRequest({
        userIds: ['user-1'],
        action: 'invalid',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('approve veya reject');
    });

    it('should require role for approve action', async () => {
      const request = createRequest({
        userIds: ['user-1'],
        action: 'approve',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('rol');
    });

    it('should reject invalid role for approve action', async () => {
      const request = createRequest({
        userIds: ['user-1'],
        action: 'approve',
        role: 'invalid_role',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should successfully approve multiple users', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', email: 'user1@test.com', status: 'pending', role: 'none' },
        { id: 'user-2', username: 'user2', email: 'user2@test.com', status: 'pending', role: 'none' },
      ];

      mockFindMany.mockResolvedValue(mockUsers);
      mockUpdate.mockResolvedValue({});
      mockCreate.mockResolvedValue({});

      const request = createRequest({
        userIds: ['user-1', 'user-2'],
        action: 'approve',
        role: 'mod',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary.successful).toBe(2);
      expect(data.summary.failed).toBe(0);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenCalledTimes(2); // Activity logs
    });

    it('should successfully reject multiple users', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', email: 'user1@test.com', status: 'pending', role: 'none' },
        { id: 'user-2', username: 'user2', email: 'user2@test.com', status: 'approved', role: 'mod' },
      ];

      mockFindMany.mockResolvedValue(mockUsers);
      mockUpdate.mockResolvedValue({});
      mockCreate.mockResolvedValue({});

      const request = createRequest({
        userIds: ['user-1', 'user-2'],
        action: 'reject',
        reason: 'Test rejection',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.successful).toBe(2);
      expect(data.summary.failed).toBe(0);
    });

    it('should handle non-existent users', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'user-1', username: 'user1', email: 'user1@test.com', status: 'pending', role: 'none' },
      ]);
      mockUpdate.mockResolvedValue({});
      mockCreate.mockResolvedValue({});

      const request = createRequest({
        userIds: ['user-1', 'non-existent'],
        action: 'approve',
        role: 'mod',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false); // Partial failure
      expect(data.summary.successful).toBe(1);
      expect(data.summary.failed).toBe(1);
      expect(data.results.find((r: { userId: string }) => r.userId === 'non-existent')?.error).toContain('bulunamadı');
    });

    it('should skip already approved users when approving', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', email: 'user1@test.com', status: 'approved', role: 'mod' },
      ];

      mockFindMany.mockResolvedValue(mockUsers);

      const request = createRequest({
        userIds: ['user-1'],
        action: 'approve',
        role: 'admin',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.successful).toBe(0);
      expect(data.summary.failed).toBe(1);
      expect(data.results[0].error).toContain('zaten onaylı');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should skip already rejected users when rejecting', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', email: 'user1@test.com', status: 'rejected', role: 'none' },
      ];

      mockFindMany.mockResolvedValue(mockUsers);

      const request = createRequest({
        userIds: ['user-1'],
        action: 'reject',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.successful).toBe(0);
      expect(data.summary.failed).toBe(1);
      expect(data.results[0].error).toContain('zaten reddedilmiş');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should reject more than 100 users', async () => {
      const userIds = Array.from({ length: 101 }, (_, i) => `user-${i}`);

      const request = createRequest({
        userIds,
        action: 'approve',
        role: 'mod',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('limit');
    });

    it('should create activity logs for each operation', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', email: 'user1@test.com', status: 'pending', role: 'none' },
      ];

      mockFindMany.mockResolvedValue(mockUsers);
      mockUpdate.mockResolvedValue({});
      mockCreate.mockResolvedValue({});

      const request = createRequest({
        userIds: ['user-1'],
        action: 'approve',
        role: 'mod',
      });

      await POST(request, { params: {} });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-123',
            action: 'user_approve',
            details: expect.stringContaining('bulk_user_approve'),
          }),
        })
      );
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/admin/users/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('JSON');
    });
  });
});
