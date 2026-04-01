// Merkezi tip tanımlamaları

// İçerik tiplerini re-export et
export * from './content';

// Şablon tiplerini re-export et
export * from './templates';

export type UserRole =
  | 'none'         // Rol yok
  | 'reg'          // Regulatör
  | 'op'           // Operatör
  | 'gatekeeper'   // GateKeeper
  | 'council'      // Council
  | 'gm'           // GM (General Manager)
  | 'ust_yetkili'  // Üst Yetkili
  | 'owner';       // Owner (en yüksek)

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
