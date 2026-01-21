// Merkezi tip tanımlamaları

// İçerik tiplerini re-export et
export * from './content';

export type UserRole = 'none' | 'mod' | 'admin' | 'ust_yetkili';

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | undefined;
}

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'view_content'
  | 'search'
  | 'ai_query'
  | 'role_change'
  | 'user_approve'
  | 'user_reject';

export interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}
