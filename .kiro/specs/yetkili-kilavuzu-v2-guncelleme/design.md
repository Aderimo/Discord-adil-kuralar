# Design Document: Yetkili Kılavuzu v2 Güncelleme

## Overview

Bu tasarım dokümanı, "Yetkili Kılavuzu v2" Discord moderasyon panelinin kapsamlı güncellemesini detaylandırır. Güncelleme, mevcut hata düzeltmelerini (buton yönlendirmeleri, sidebar görünürlüğü, AI danışman), yeni özellikleri (gelişmiş kullanıcı yönetimi, log sistemi, ceza şablonları, bildirim sistemi) ve RBAC iyileştirmelerini içerir.

Mevcut teknoloji yığını korunacaktır:
- Next.js 14 App Router
- TypeScript
- Tailwind CSS + Discord teması
- Prisma + SQLite/PostgreSQL
- Shadcn UI bileşenleri
- RAG tabanlı AI sistemi

## Architecture

### Mevcut Mimari (Korunacak)

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │  Components │  │     Contexts        │  │
│  │  (App Dir)  │  │  (UI/Layout)│  │  (Auth/Theme)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Auth     │  │   Admin     │  │      Content        │  │
│  │  /api/auth  │  │  /api/admin │  │   /api/content      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Services                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    RBAC     │  │   Logging   │  │    AI Assistant     │  │
│  │  (lib/rbac) │  │(lib/logging)│  │ (lib/ai-assistant)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Prisma    │  │   Content   │  │    Vector Store     │  │
│  │  (SQLite)   │  │   (JSON)    │  │   (RAG/Embedding)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Yeni Bileşenler

```
┌─────────────────────────────────────────────────────────────┐
│                    Yeni Özellikler                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Notification│  │   Penalty   │  │   Enhanced Admin    │  │
│  │   System    │  │  Templates  │  │      Panel          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Commands   │  │  Log Export │  │   Bulk Operations   │  │
│  │ Categories  │  │  (CSV/JSON) │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Ana Sayfa Buton Düzeltmeleri

**Dosya:** `src/app/page.tsx`

```typescript
// Mevcut (Hatalı)
<QuickAccessCard href="/guide/giris" ... />
<QuickAccessCard href="/penalties/yazili" ... />
<QuickAccessCard href="/procedures/kayit-proseduru" ... />

// Düzeltilmiş
<QuickAccessCard href="/guide" ... />
<QuickAccessCard href="/penalties" ... />
<QuickAccessCard href="/procedures" ... />
```

### 2. Sidebar Görünürlük Düzeltmesi

**Sorun:** Sidebar bazı sayfalarda render edilmiyor çünkü MainLayout kullanılmıyor.

**Çözüm:** Tüm authenticated sayfalarda MainLayout + Sidebar kullanımı zorunlu.

```typescript
// Her sayfa için standart yapı
export default function SomePage() {
  return (
    <MainLayout sidebar={<Sidebar />}>
      {/* Sayfa içeriği */}
    </MainLayout>
  );
}
```

### 3. Komutlar Kategorize Yapısı

**Yeni Dosya Yapısı:**
```
src/app/commands/
├── page.tsx              # Ana komutlar sayfası (kategoriler listesi)
├── [category]/
│   └── page.tsx          # Kategori detay sayfası
```

**Komut Kategorileri:**
```typescript
type CommandCategory = 'ceza' | 'bilgi' | 'sesli' | 'gk-plus';

interface CommandCategoryConfig {
  id: CommandCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiredRole: UserRole;
}

const COMMAND_CATEGORIES: CommandCategoryConfig[] = [
  { id: 'ceza', label: 'Ceza Komutları', description: 'Mute, ban, timeout komutları', icon: <Gavel />, requiredRole: 'mod' },
  { id: 'bilgi', label: 'Bilgi Komutları', description: 'Kullanıcı bilgi sorgulama', icon: <Info />, requiredRole: 'mod' },
  { id: 'sesli', label: 'Sesli Kanal Komutları', description: 'Voice channel yönetimi', icon: <Mic />, requiredRole: 'mod' },
  { id: 'gk-plus', label: 'GK+ Komutları', description: 'Genel Koordinatör ve üstü', icon: <Shield />, requiredRole: 'admin' },
];
```

**Yeni Komutlar (content/commands/index.json'a eklenecek):**
```json
{
  "id": "cmd-016",
  "command": "h!ban",
  "description": "Kullanıcıyı sunucudan kalıcı olarak yasaklar.",
  "usage": "h!ban [id] [sebep]",
  "permissions": ["admin", "ust_yetkili"],
  "category": "gk-plus",
  "examples": ["h!ban 1208226241002606644 Kural ihlali"]
},
{
  "id": "cmd-017",
  "command": "h!unban",
  "description": "Kullanıcının yasağını kaldırır.",
  "usage": "h!unban [id]",
  "permissions": ["admin", "ust_yetkili"],
  "category": "gk-plus",
  "examples": ["h!unban 1208226241002606644"]
},
{
  "id": "cmd-018",
  "command": "/allow",
  "description": "Kullanıcıya özel izin verir.",
  "usage": "/allow [id]",
  "permissions": ["admin", "ust_yetkili"],
  "category": "gk-plus",
  "examples": ["/allow 1208226241002606644"]
},
{
  "id": "cmd-019",
  "command": "/deny",
  "description": "Kullanıcının özel iznini kaldırır.",
  "usage": "/deny [id]",
  "permissions": ["admin", "ust_yetkili"],
  "category": "gk-plus",
  "examples": ["/deny 1208226241002606644"]
}
```

### 4. AI Danışman Hata Düzeltmesi

**Dosya:** `src/lib/ai-assistant.ts` ve `src/app/api/ai/chat/route.ts`

```typescript
// Geliştirilmiş mock yanıt sistemi
const MOCK_RESPONSES: Record<string, string> = {
  'hakaret': 'Hakaret için standart ceza: 3 gün uyarılmış veya 3-7 gün susturulmuş...',
  'spam': 'Spam için standart ceza: 4 gün uyarılmış...',
  'reklam': 'Reklam için standart ceza: 30 gün susturulmuş...',
  'default': 'Bu konuda yeterli bilgi bulunamadı. Üst yetkililere danışılmalıdır.'
};

function generateEnhancedMockResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  for (const [keyword, response] of Object.entries(MOCK_RESPONSES)) {
    if (lowerMessage.includes(keyword)) {
      return response;
    }
  }
  return MOCK_RESPONSES.default;
}
```

### 5. Gelişmiş Kullanıcı Yönetimi

**Yeni API Endpoints:**
```
GET  /api/admin/users          - Tüm kullanıcıları listele (filtreleme destekli)
GET  /api/admin/users/[id]     - Kullanıcı detayı
PUT  /api/admin/users/[id]/role - Yetki değiştir
POST /api/admin/users/bulk     - Toplu işlem
```

**Yeni Bileşenler:**
```typescript
// src/components/admin/UserList.tsx
interface UserListProps {
  users: User[];
  onRoleChange: (userId: string, newRole: UserRole) => void;
  onBulkAction: (userIds: string[], action: BulkAction) => void;
}

// src/components/admin/UserFilters.tsx
interface UserFiltersProps {
  onFilterChange: (filters: UserFilters) => void;
}

interface UserFilters {
  search: string;
  status: UserStatus | 'all';
  role: UserRole | 'all';
}

// src/components/admin/UserDetailModal.tsx
interface UserDetailModalProps {
  user: User;
  activityLogs: ActivityLog[];
  onClose: () => void;
}
```

### 6. RBAC Güncellemesi

**Dosya:** `src/lib/rbac.ts`

```typescript
// Yeni izin tanımları
export const PERMISSIONS = {
  // Görüntüleme
  VIEW_CONTENT: ['mod', 'admin', 'ust_yetkili'],
  VIEW_USERS: ['admin', 'ust_yetkili'],
  VIEW_LOGS: ['ust_yetkili'],
  VIEW_NOTIFICATIONS: ['ust_yetkili'],
  
  // Düzenleme
  EDIT_CONTENT: ['admin', 'ust_yetkili'],
  EDIT_USERS: ['admin', 'ust_yetkili'],
  EDIT_TEMPLATES: ['ust_yetkili'],
  
  // Silme
  DELETE_CONTENT: ['ust_yetkili'],
  DELETE_USERS: ['ust_yetkili'],
} as const;

export function hasPermission(userRole: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission].includes(userRole);
}
```

### 7. Log Sistemi Geliştirmeleri

**Yeni API Endpoints:**
```
GET  /api/admin/logs/export    - Log export (CSV/JSON)
```

**Export Fonksiyonu:**
```typescript
// src/lib/logging.ts
export async function exportLogs(
  filters: LogFilters,
  format: 'csv' | 'json'
): Promise<string> {
  const { logs } = await getActivityLogs({ ...filters, pageSize: 10000 });
  
  if (format === 'json') {
    return JSON.stringify(logs, null, 2);
  }
  
  // CSV format
  const headers = ['ID', 'Kullanıcı', 'İşlem', 'Detay', 'IP', 'Tarih'];
  const rows = logs.map(log => [
    log.id,
    log.userId,
    log.action,
    log.details,
    log.ipAddress,
    log.timestamp.toISOString()
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
```

### 8. Ceza Şablonları

**Yeni Dosya:** `content/templates/index.json`

```json
{
  "templates": [
    {
      "id": "tpl-001",
      "name": "Çalıntı Hesap",
      "category": "ban",
      "message": "çalıntı hesap, hesabın çalındığından dolayı seni sunucudan uzaklaştırmak durumunda kaldık. eğer hesabını geri alırsan, moderatörlerimize ulaşıp banını açtırabilirsin.",
      "editableBy": ["ust_yetkili"]
    },
    {
      "id": "tpl-002",
      "name": "Underage",
      "category": "ban",
      "message": "underage, discord sözleşmesi nedeniyle 13 altı kullanıcı yasak. 13 yaşına bastığında bir moda kimliğinin tarih kısmını atarak banını kaldırabilirsin.",
      "editableBy": ["ust_yetkili"]
    }
  ]
}
```

**Yeni Bileşen:**
```typescript
// src/components/templates/PenaltyTemplates.tsx
interface PenaltyTemplatesProps {
  templates: PenaltyTemplate[];
  canEdit: boolean;
  onCopy: (text: string) => void;
  onEdit?: (template: PenaltyTemplate) => void;
}
```

### 9. Bildirim Sistemi

**Veritabanı Şeması (Prisma):**
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String   // Hedef kullanıcı (üst yetkili)
  type      String   // new_registration, content_change, etc.
  title     String
  message   String
  data      String   @default("{}") // JSON
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([read])
  @@map("notifications")
}
```

**API Endpoints:**
```
GET  /api/notifications         - Bildirimleri listele
PUT  /api/notifications/[id]    - Okundu olarak işaretle
POST /api/notifications/read-all - Tümünü okundu yap
```

**Bileşenler:**
```typescript
// src/components/notifications/NotificationBell.tsx
interface NotificationBellProps {
  count: number;
  onClick: () => void;
}

// src/components/notifications/NotificationList.tsx
interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}
```

## Data Models

### Mevcut Modeller (Değişiklik Yok)

```typescript
// src/types/index.ts
export type UserRole = 'none' | 'mod' | 'admin' | 'ust_yetkili';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type ActivityAction = 'login' | 'logout' | 'view_content' | 'search' | 'ai_query' | 'role_change' | 'user_approve' | 'user_reject';
```

### Yeni/Güncellenmiş Modeller

```typescript
// src/types/content.ts - Güncelleme
export type CommandCategory = 'ceza' | 'bilgi' | 'sesli' | 'gk-plus';

export interface CommandDefinition {
  id: string;
  command: string;
  description: string;
  usage: string;
  permissions: UserRole[];
  category: CommandCategory; // YENİ
  examples: string[];
  keywords: string[];
  order: number;
}

// src/types/templates.ts - YENİ
export interface PenaltyTemplate {
  id: string;
  name: string;
  category: 'ban' | 'mute' | 'warn';
  message: string;
  editableBy: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

// src/types/notifications.ts - YENİ
export type NotificationType = 'new_registration' | 'content_change' | 'role_change' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}
```

### Prisma Şema Güncellemeleri

```prisma
// prisma/schema.prisma - Eklemeler

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  message   String
  data      String   @default("{}")
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([read])
  @@index([createdAt])
  @@map("notifications")
}

model PenaltyTemplate {
  id        String   @id @default(cuid())
  name      String
  category  String
  message   String
  editableBy String  @default("[]") // JSON array of roles
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("penalty_templates")
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Quick Access Card Navigation Correctness

*For any* quick access card on the homepage, the href value SHALL be a root path (e.g., `/guide`, `/penalties`, `/procedures`) without any sub-path segments.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Sidebar Visibility Invariant

*For any* authenticated page in the application (guide, penalties, commands, procedures, admin), the Sidebar component SHALL be rendered and visible in the DOM.

**Validates: Requirements 2.1, 2.2**

### Property 3: Command Categorization Completeness

*For any* command in the system, it SHALL belong to exactly one of the defined categories (ceza, bilgi, sesli, gk-plus), and when filtering by a category, only commands belonging to that category SHALL be displayed.

**Validates: Requirements 3.1, 3.5**

### Property 4: AI Mock Response Keyword Matching

*For any* user message containing a penalty-related keyword (hakaret, spam, reklam, etc.), when the AI service is in mock mode, the system SHALL return a relevant response containing information about that penalty type.

**Validates: Requirements 4.3, 4.4**

### Property 5: User Filtering Correctness

*For any* combination of search query, status filter, and role filter applied to the user list, the resulting list SHALL contain only users that match ALL applied filter criteria, and the count statistics SHALL accurately reflect the filtered results.

**Validates: Requirements 5.2, 5.3, 5.5, 5.7**

### Property 6: RBAC Permission Enforcement

*For any* user with a given role (mod, admin, ust_yetkili), the system SHALL grant exactly the permissions defined for that role: mod gets view-only, admin gets view+edit, ust_yetkili gets view+edit+delete. UI elements for unauthorized actions SHALL be hidden.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

### Property 7: Activity Logging Completeness

*For any* significant action (login, logout, role_change, user_approve, user_reject, content_edit), the Log_Sistemi SHALL create a log entry containing userId, timestamp, action type, and relevant details.

**Validates: Requirements 7.1, 7.6**

### Property 8: Log Filtering and Export Round-Trip

*For any* set of log filters (date range, user, action type), applying the filters SHALL return only matching logs, and exporting those logs to CSV or JSON and re-importing SHALL produce equivalent data.

**Validates: Requirements 7.3, 7.4**

### Property 9: Template Edit Permission Enforcement

*For any* penalty template, only users with ust_yetkili role SHALL be able to edit the template. Non-ust_yetkili users SHALL see the template in read-only mode with edit controls hidden.

**Validates: Requirements 8.5, 8.6**

### Property 10: Notification System Correctness

*For any* triggering event (new_registration, content_change), the system SHALL create a notification for all ust_yetkili users. Notifications SHALL only be visible to ust_yetkili users, and marking as read SHALL persist the read state.

**Validates: Requirements 9.1, 9.2, 9.5, 9.6**

### Property 11: GK+ Command Category Assignment

*For any* command in the GK+ category (h!ban, h!unban, /allow, /deny), the command SHALL have permissions restricted to admin and ust_yetkili roles, and the UI SHALL indicate the elevated permission requirement.

**Validates: Requirements 10.5, 10.6**

## Error Handling

### 1. API Hataları

```typescript
// Standart API hata yanıtı
interface ApiErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
}

type ErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'RATE_LIMIT';

// Hata işleme middleware
export function handleApiError(error: unknown): ApiErrorResponse {
  if (error instanceof AuthError) {
    return { success: false, error: 'Oturum geçersiz', code: 'UNAUTHORIZED' };
  }
  if (error instanceof ForbiddenError) {
    return { success: false, error: 'Bu işlem için yetkiniz yok', code: 'FORBIDDEN' };
  }
  // ... diğer hata türleri
  return { success: false, error: 'Bir hata oluştu', code: 'INTERNAL_ERROR' };
}
```

### 2. AI Servisi Hataları

```typescript
// AI servisi kullanılamadığında
if (!isAIServiceAvailable()) {
  // Mock mod kullan
  return generateMockResponse(message);
}

// API hatası durumunda
try {
  return await generateOpenAIResponse(message, context);
} catch (error) {
  if (error.code === 'rate_limit') {
    return { error: 'Çok fazla istek, lütfen bekleyin', code: 'RATE_LIMIT' };
  }
  // Fallback to mock
  return generateMockResponse(message);
}
```

### 3. Yetkilendirme Hataları

```typescript
// Route koruması
export function checkRouteAccess(pathname: string, user: User | null): RouteAccessResult {
  const rule = findRouteRule(pathname);
  
  if (!user) {
    return { allowed: false, redirect: '/login', reason: 'not_authenticated' };
  }
  
  if (!hasPermission(user.role, rule.requiredPermission)) {
    return { allowed: false, redirect: '/unauthorized', reason: 'insufficient_role' };
  }
  
  return { allowed: true };
}
```

### 4. Form Validasyon Hataları

```typescript
// Kullanıcı girişi validasyonu
const validateUserInput = (input: unknown): ValidationResult => {
  const errors: string[] = [];
  
  if (!input.username || input.username.length < 3) {
    errors.push('Kullanıcı adı en az 3 karakter olmalı');
  }
  
  if (!input.email || !isValidEmail(input.email)) {
    errors.push('Geçerli bir e-posta adresi girin');
  }
  
  return { valid: errors.length === 0, errors };
};
```

## Testing Strategy

### Dual Testing Approach

Bu proje hem unit testler hem de property-based testler kullanacaktır:

- **Unit Tests**: Belirli örnekler, edge case'ler ve hata durumları için
- **Property Tests**: Evrensel özellikler ve geniş girdi aralıkları için

### Test Framework

- **Jest**: Unit test framework
- **fast-check**: Property-based testing library
- **@testing-library/react**: React component testing

### Property-Based Test Configuration

```typescript
// jest.config.js
module.exports = {
  // ... diğer config
  testTimeout: 30000, // Property testleri için uzun timeout
};

// Test dosyası örneği
import fc from 'fast-check';

describe('RBAC Permission Enforcement', () => {
  // Feature: yetkili-kilavuzu-v2-guncelleme, Property 6: RBAC Permission Enforcement
  it('should enforce correct permissions for all roles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mod', 'admin', 'ust_yetkili'),
        fc.constantFrom('VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT'),
        (role, permission) => {
          const hasAccess = hasPermission(role, permission);
          const expected = PERMISSIONS[permission].includes(role);
          return hasAccess === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Categories

#### 1. Unit Tests

```typescript
// Belirli örnekler için
describe('Quick Access Cards', () => {
  it('should have correct href for Yetkili Kılavuzu', () => {
    expect(getQuickAccessCardHref('guide')).toBe('/guide');
  });
  
  it('should have correct href for Cezalar', () => {
    expect(getQuickAccessCardHref('penalties')).toBe('/penalties');
  });
});
```

#### 2. Property Tests

```typescript
// Evrensel özellikler için
describe('Command Categorization', () => {
  // Feature: yetkili-kilavuzu-v2-guncelleme, Property 3: Command Categorization Completeness
  it('every command should belong to exactly one category', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allCommands),
        (command) => {
          const categories = COMMAND_CATEGORIES.filter(cat => 
            getCommandsByCategory(cat.id).includes(command)
          );
          return categories.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 3. Integration Tests

```typescript
// API endpoint testleri
describe('Admin Users API', () => {
  it('should filter users by status', async () => {
    const response = await fetch('/api/admin/users?status=pending');
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.users.every(u => u.status === 'pending')).toBe(true);
  });
});
```

### Test Coverage Requirements

- Minimum %80 code coverage
- Tüm property testleri minimum 100 iterasyon
- Her API endpoint için en az bir integration test
- Her component için en az bir render test

