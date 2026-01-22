/**
 * usePermission Hook Unit Testleri
 * Validates: Requirement 6.6 - THE System SHALL hide UI elements that the user cannot access based on their role
 */

import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock useAuth hook
const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  status: 'approved' as const,
  role: 'mod' as const,
};

let mockUserValue: typeof mockUser | null = mockUser;

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUserValue,
    isLoading: false,
    isAuthenticated: mockUserValue !== null,
  }),
}));

// Import after mocks
import { usePermission, usePermissions } from '@/hooks/usePermission';

describe('usePermission Hook', () => {
  beforeEach(() => {
    mockUserValue = { ...mockUser };
  });

  describe('Temel İzin Kontrolleri', () => {
    it('mod rolü VIEW_CONTENT iznine sahip olmalı', () => {
      mockUserValue = { ...mockUser, role: 'mod' };
      
      const { result } = renderHook(() => usePermission('VIEW_CONTENT'));
      
      expect(result.current).toBe(true);
    });

    it('mod rolü EDIT_CONTENT iznine sahip olmamalı', () => {
      mockUserValue = { ...mockUser, role: 'mod' };
      
      const { result } = renderHook(() => usePermission('EDIT_CONTENT'));
      
      expect(result.current).toBe(false);
    });

    it('admin rolü EDIT_CONTENT iznine sahip olmalı', () => {
      mockUserValue = { ...mockUser, role: 'admin' };
      
      const { result } = renderHook(() => usePermission('EDIT_CONTENT'));
      
      expect(result.current).toBe(true);
    });

    it('admin rolü DELETE_CONTENT iznine sahip olmamalı', () => {
      mockUserValue = { ...mockUser, role: 'admin' };
      
      const { result } = renderHook(() => usePermission('DELETE_CONTENT'));
      
      expect(result.current).toBe(false);
    });

    it('ust_yetkili rolü DELETE_CONTENT iznine sahip olmalı', () => {
      mockUserValue = { ...mockUser, role: 'ust_yetkili' };
      
      const { result } = renderHook(() => usePermission('DELETE_CONTENT'));
      
      expect(result.current).toBe(true);
    });

    it('ust_yetkili rolü tüm izinlere sahip olmalı', () => {
      mockUserValue = { ...mockUser, role: 'ust_yetkili' };
      
      const viewContent = renderHook(() => usePermission('VIEW_CONTENT'));
      const editContent = renderHook(() => usePermission('EDIT_CONTENT'));
      const deleteContent = renderHook(() => usePermission('DELETE_CONTENT'));
      const viewLogs = renderHook(() => usePermission('VIEW_LOGS'));
      const editTemplates = renderHook(() => usePermission('EDIT_TEMPLATES'));
      
      expect(viewContent.result.current).toBe(true);
      expect(editContent.result.current).toBe(true);
      expect(deleteContent.result.current).toBe(true);
      expect(viewLogs.result.current).toBe(true);
      expect(editTemplates.result.current).toBe(true);
    });
  });

  describe('Kullanıcı Durumu Kontrolleri', () => {
    it('kullanıcı yoksa izin vermemeli', () => {
      mockUserValue = null;
      
      const { result } = renderHook(() => usePermission('VIEW_CONTENT'));
      
      expect(result.current).toBe(false);
    });

    it('pending durumundaki kullanıcıya izin vermemeli', () => {
      mockUserValue = { ...mockUser, status: 'pending' as const };
      
      const { result } = renderHook(() => usePermission('VIEW_CONTENT'));
      
      expect(result.current).toBe(false);
    });

    it('rejected durumundaki kullanıcıya izin vermemeli', () => {
      mockUserValue = { ...mockUser, status: 'rejected' as const };
      
      const { result } = renderHook(() => usePermission('VIEW_CONTENT'));
      
      expect(result.current).toBe(false);
    });

    it('none rolündeki kullanıcıya izin vermemeli', () => {
      mockUserValue = { ...mockUser, role: 'none' as const };
      
      const { result } = renderHook(() => usePermission('VIEW_CONTENT'));
      
      expect(result.current).toBe(false);
    });
  });

  describe('Özel İzin Kontrolleri', () => {
    it('sadece ust_yetkili VIEW_LOGS iznine sahip olmalı', () => {
      // mod
      mockUserValue = { ...mockUser, role: 'mod' };
      const modResult = renderHook(() => usePermission('VIEW_LOGS'));
      expect(modResult.result.current).toBe(false);
      
      // admin
      mockUserValue = { ...mockUser, role: 'admin' };
      const adminResult = renderHook(() => usePermission('VIEW_LOGS'));
      expect(adminResult.result.current).toBe(false);
      
      // ust_yetkili
      mockUserValue = { ...mockUser, role: 'ust_yetkili' };
      const ustYetkiliResult = renderHook(() => usePermission('VIEW_LOGS'));
      expect(ustYetkiliResult.result.current).toBe(true);
    });

    it('sadece ust_yetkili EDIT_TEMPLATES iznine sahip olmalı', () => {
      // admin
      mockUserValue = { ...mockUser, role: 'admin' };
      const adminResult = renderHook(() => usePermission('EDIT_TEMPLATES'));
      expect(adminResult.result.current).toBe(false);
      
      // ust_yetkili
      mockUserValue = { ...mockUser, role: 'ust_yetkili' };
      const ustYetkiliResult = renderHook(() => usePermission('EDIT_TEMPLATES'));
      expect(ustYetkiliResult.result.current).toBe(true);
    });

    it('admin ve ust_yetkili VIEW_USERS iznine sahip olmalı', () => {
      // mod
      mockUserValue = { ...mockUser, role: 'mod' };
      const modResult = renderHook(() => usePermission('VIEW_USERS'));
      expect(modResult.result.current).toBe(false);
      
      // admin
      mockUserValue = { ...mockUser, role: 'admin' };
      const adminResult = renderHook(() => usePermission('VIEW_USERS'));
      expect(adminResult.result.current).toBe(true);
      
      // ust_yetkili
      mockUserValue = { ...mockUser, role: 'ust_yetkili' };
      const ustYetkiliResult = renderHook(() => usePermission('VIEW_USERS'));
      expect(ustYetkiliResult.result.current).toBe(true);
    });
  });
});

describe('usePermissions Hook', () => {
  beforeEach(() => {
    mockUserValue = { ...mockUser };
  });

  it('birden fazla izni aynı anda kontrol etmeli', () => {
    mockUserValue = { ...mockUser, role: 'admin' };
    
    const { result } = renderHook(() => 
      usePermissions(['VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT', 'VIEW_LOGS'])
    );
    
    expect(result.current.VIEW_CONTENT).toBe(true);
    expect(result.current.EDIT_CONTENT).toBe(true);
    expect(result.current.DELETE_CONTENT).toBe(false);
    expect(result.current.VIEW_LOGS).toBe(false);
  });

  it('kullanıcı yoksa tüm izinler false olmalı', () => {
    mockUserValue = null;
    
    const { result } = renderHook(() => 
      usePermissions(['VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT'])
    );
    
    expect(result.current.VIEW_CONTENT).toBe(false);
    expect(result.current.EDIT_CONTENT).toBe(false);
    expect(result.current.DELETE_CONTENT).toBe(false);
  });

  it('ust_yetkili için tüm izinler true olmalı', () => {
    mockUserValue = { ...mockUser, role: 'ust_yetkili' };
    
    const { result } = renderHook(() => 
      usePermissions([
        'VIEW_CONTENT', 
        'EDIT_CONTENT', 
        'DELETE_CONTENT', 
        'VIEW_LOGS',
        'EDIT_TEMPLATES',
        'VIEW_USERS',
        'EDIT_USERS',
        'DELETE_USERS',
        'VIEW_NOTIFICATIONS'
      ])
    );
    
    expect(result.current.VIEW_CONTENT).toBe(true);
    expect(result.current.EDIT_CONTENT).toBe(true);
    expect(result.current.DELETE_CONTENT).toBe(true);
    expect(result.current.VIEW_LOGS).toBe(true);
    expect(result.current.EDIT_TEMPLATES).toBe(true);
    expect(result.current.VIEW_USERS).toBe(true);
    expect(result.current.EDIT_USERS).toBe(true);
    expect(result.current.DELETE_USERS).toBe(true);
    expect(result.current.VIEW_NOTIFICATIONS).toBe(true);
  });
});
