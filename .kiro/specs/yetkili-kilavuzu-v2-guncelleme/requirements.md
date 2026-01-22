# Requirements Document

## Introduction

Bu doküman, "Yetkili Kılavuzu v2" Discord moderasyon panelinin kapsamlı güncellemesini tanımlar. Güncelleme, mevcut hata düzeltmelerini, yeni özellikleri ve sistem iyileştirmelerini içerir. Proje Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma + SQLite ve Shadcn UI bileşenleri kullanmaktadır.

## Glossary

- **System**: Yetkili Kılavuzu v2 web uygulaması
- **Sidebar**: Sol taraftaki navigasyon menüsü
- **AI_Danışman**: RAG tabanlı yapay zeka ceza danışmanlık sistemi
- **RBAC**: Role-Based Access Control - Rol tabanlı erişim kontrolü
- **Owner**: Site kurucusu ve yardımcıları - en yüksek yetki seviyesi (hierarchy: 7)
- **GM+**: Owner'dan sonraki en yüksek yetkili rol (hierarchy: 6)
- **GM**: Sunucunun genel yönetimiyle ilgilenen rol (hierarchy: 5)
- **Council**: GateKeeper ve Operatörlerin gözetmeni (hierarchy: 4)
- **GK (GateKeeper)**: Yasaklama yetkisine sahip moderatör (hierarchy: 3)
- **OP (Operatör)**: Sesli ve yazılı kanalları denetleyen yetkili (hierarchy: 2)
- **REG (Regülatör)**: Temel moderatör rolü (hierarchy: 1)
- **Log_Sistemi**: Kullanıcı aktivitelerini kaydeden sistem
- **Ceza_Şablonu**: Hazır ban/ceza mesaj şablonları
- **Bildirim_Sistemi**: Önemli olayları bildiren sistem

## Requirements

### Requirement 1: Ana Sayfa Buton Yönlendirme Düzeltmeleri

**User Story:** As a yetkili, I want the quick access buttons on the homepage to navigate to the correct pages, so that I can quickly access the main sections.

#### Acceptance Criteria

1. WHEN a user clicks the "Yetkili Kılavuzu" button THEN THE System SHALL navigate to `/guide` instead of `/guide/giris`
2. WHEN a user clicks the "Cezalar" button THEN THE System SHALL navigate to `/penalties` instead of `/penalties/yazili`
3. WHEN a user clicks the "Prosedürler" button THEN THE System SHALL navigate to `/procedures` instead of `/procedures/kayit-proseduru`
4. THE System SHALL ensure all quick access card href values are correct root paths

### Requirement 2: Sidebar Görünürlük Düzeltmesi

**User Story:** As a yetkili, I want the sidebar to remain visible on all pages, so that I can navigate between sections without losing context.

#### Acceptance Criteria

1. WHILE navigating between pages THEN THE Sidebar SHALL remain visible and functional
2. WHEN a user visits any page (guide, penalties, commands, procedures, admin) THEN THE System SHALL display the Sidebar component
3. THE System SHALL use MainLayout with Sidebar prop on all authenticated pages
4. IF the Sidebar is not rendered THEN THE System SHALL log an error for debugging

### Requirement 3: Komutlar Sayfası Kategorize Yapısı

**User Story:** As a yetkili, I want commands to be organized by categories, so that I can find relevant commands more easily.

#### Acceptance Criteria

1. THE System SHALL organize commands into four categories: Ceza Komutları, Bilgi Komutları, Sesli Kanal Komutları, GK+ Komutları
2. WHEN displaying commands THEN THE System SHALL group them by category with collapsible sections
3. THE System SHALL add missing commands: h!ban, h!unban, /allow, /deny
4. WHEN a user navigates to `/commands` THEN THE System SHALL display categorized command list
5. WHEN a user navigates to `/commands/[category]` THEN THE System SHALL display only that category's commands

### Requirement 4: AI Danışman Hata Düzeltmesi

**User Story:** As a yetkili, I want the AI advisor to work reliably, so that I can get penalty recommendations without errors.

#### Acceptance Criteria

1. WHEN OPENAI_API_KEY is not configured THEN THE AI_Danışman SHALL use fallback mock responses
2. WHEN an API error occurs THEN THE AI_Danışman SHALL display a user-friendly error message
3. THE System SHALL check API key availability before making requests
4. WHEN using mock mode THEN THE AI_Danışman SHALL provide helpful static responses based on keywords
5. IF the AI service is unavailable THEN THE System SHALL inform the user and suggest manual lookup

### Requirement 5: Gelişmiş Kullanıcı Yönetimi (Admin Paneli)

**User Story:** As an admin, I want to manage all users from a central panel, so that I can efficiently handle user approvals and role changes.

#### Acceptance Criteria

1. WHEN an admin visits `/admin` THEN THE System SHALL display a list of all users with their status (pending, approved, rejected)
2. THE System SHALL provide search functionality to filter users by username or email
3. THE System SHALL provide filter options by status and role
4. WHEN an admin clicks "Yetki Değiştir" button THEN THE System SHALL display a role selection dropdown
5. THE System SHALL support bulk operations for approving/rejecting multiple users
6. WHEN an admin clicks on a user THEN THE System SHALL navigate to a user detail page showing full history
7. THE System SHALL display user count statistics (total, pending, approved, rejected)

### Requirement 6: Yetki Bazlı Erişim Kontrolü (RBAC) Güncellemesi

**User Story:** As a system administrator, I want role-based access control, so that users can only access features appropriate to their role.

#### Acceptance Criteria

1. WHEN a user has Üst_Yetkili role THEN THE System SHALL grant full access including delete permissions and all features
2. WHEN a user has Admin role THEN THE System SHALL grant view and edit permissions but not delete
3. WHEN a user has Mod role THEN THE System SHALL grant view-only access to necessary channels
4. THE System SHALL enforce role checks on all protected routes and API endpoints
5. IF a user attempts an unauthorized action THEN THE System SHALL display an appropriate error message
6. THE System SHALL hide UI elements that the user cannot access based on their role

### Requirement 7: Log Sistemi

**User Story:** As an üst yetkili, I want to view activity logs, so that I can audit who did what and when.

#### Acceptance Criteria

1. THE Log_Sistemi SHALL record all significant actions with user ID, timestamp, action type, and details
2. WHEN an üst yetkili visits `/admin/logs` THEN THE System SHALL display filterable log entries
3. THE System SHALL provide filters for date range, user, and action type
4. THE System SHALL provide export functionality in CSV and JSON formats
5. WHEN a user without üst_yetkili role attempts to access logs THEN THE System SHALL deny access
6. THE Log_Sistemi SHALL log: user role changes, content edits, user approvals/rejections, login events

### Requirement 8: Ceza Şablonları

**User Story:** As a yetkili, I want pre-defined penalty message templates, so that I can quickly copy and use standard ban messages.

#### Acceptance Criteria

1. THE System SHALL provide pre-defined ban message templates for common scenarios
2. THE System SHALL include template for "Çalıntı Hesap": "çalıntı hesap, hesabın çalındığından dolayı seni sunucudan uzaklaştırmak durumunda kaldık. eğer hesabını geri alırsan, moderatörlerimize ulaşıp banını açtırabilirsin."
3. THE System SHALL include template for "Underage": "underage, discord sözleşmesi nedeniyle 13 altı kullanıcı yasak. 13 yaşına bastığında bir moda kimliğinin tarih kısmını atarak banını kaldırabilirsin."
4. WHEN a user clicks the copy button THEN THE System SHALL copy the template text to clipboard
5. WHEN an üst_yetkili edits a template THEN THE System SHALL save the changes
6. WHEN a non-üst_yetkili user views templates THEN THE System SHALL hide edit functionality

### Requirement 9: Bildirim Sistemi

**User Story:** As an üst yetkili, I want to receive notifications for important events, so that I can stay informed about new applications and changes.

#### Acceptance Criteria

1. WHEN a new user registration is pending THEN THE Bildirim_Sistemi SHALL create a notification for üst yetkililer
2. WHEN important content changes occur THEN THE Bildirim_Sistemi SHALL notify üst yetkililer
3. THE System SHALL display notification count badge in the header
4. WHEN a user clicks on a notification THEN THE System SHALL navigate to the relevant page
5. THE System SHALL allow marking notifications as read
6. WHEN a user without üst_yetkili role logs in THEN THE System SHALL not display notifications

### Requirement 10: Eksik Komutlar Eklenmesi

**User Story:** As a yetkili, I want all moderator commands documented, so that I can reference them when needed.

#### Acceptance Criteria

1. THE System SHALL add h!ban command with usage: `h!ban id sebep`
2. THE System SHALL add h!unban command with usage: `h!unban id`
3. THE System SHALL add /allow command with usage: `/allow id`
4. THE System SHALL add /deny command with usage: `/deny id`
5. THE System SHALL categorize these commands under "GK+ Komutları" category
6. WHEN displaying GK+ commands THEN THE System SHALL indicate they require GK or higher permission

### Requirement 11: Dinamik Rol Yönetim Sistemi

**User Story:** As an owner, I want to manage roles dynamically, so that I can create, edit, and delete roles with custom permissions.

#### Acceptance Criteria

1. THE System SHALL support the following roles with hierarchy (1-7):
   - **reg** (Regülatör, hierarchy: 1): Stajyerlik sürecini tamamlayarak kadroya geçmiş ana regülatör rolü. Sesli kanallar ve genel sunucuyu gözlemleyip denetler. Olumsuzlukları ve gelen şikayetleri güvenilir, kanıtlı ve işlem uygulanabilir şekilde üst moderatör ekibine iletir.
   - **op** (Operatör, hierarchy: 2): Ana operatör rolü. Sunucudaki sesli ve yazılı kanalları denetleyen, gerektiğinde işlem uygulayabilen yetkililer. Sunucu hakkındaki konularda danışılabilecek, genel sunucu düzenini sağlamak ve şikayetleri değerlendirmekle sorumlu kişiler.
   - **gk** (GateKeeper, hierarchy: 3): Operatörlerin bir üstü olup sunucudan yasaklama yetkisine sahip. Operatörlerin ilettiği kullanıcıları uzaklaştırır ve genel moderasyon işlemlerinin doğruluğunu denetleyerek düzenin korunmasına yardımcı olur.
   - **council** (Council, hierarchy: 4): GateKeeper ve Operatörlerin Supervisor'ı/gözetmeni. Kararsız kalınan işlemlerde sunucu kurallarına göre doğru işlemi ve süreyi belirlemede yardımcı olur.
   - **gm** (GM, hierarchy: 5): GM+'dan tek farkı yönetici yetkisi yoktur. Sunucunun genel yönetimiyle ilgilenir.
   - **gm_plus** (🔖 GM+, hierarchy: 6): Owner'dan sonraki en yüksek yetkili rol. Sunucunun genel yönetimiyle ilgilenir.
   - **owner** (Owner, hierarchy: 7): Site kurucusu ve yardımcılarına verilir. En yüksek yetki seviyesi.
2. THE System SHALL store roles in the database with: code, name, shortName, description, hierarchy, color, permissions, isSystem
3. WHEN an owner visits `/admin/settings` THEN THE System SHALL display role management interface
4. THE System SHALL allow owners to create new roles with custom permissions
5. THE System SHALL allow owners to edit existing roles (except system roles' code)
6. THE System SHALL allow owners to delete non-system roles
7. WHEN assigning roles to users THEN THE System SHALL show all available roles from database
8. THE System SHALL prevent non-owner users from assigning the owner role
9. THE System SHALL set esenyurtcocg65@gmail.com (username: Aderimo) as the initial owner

### Requirement 12: Gelişmiş Log Sistemi

**User Story:** As an owner/GM+, I want comprehensive activity logging, so that I can audit all user actions including AI queries and content operations.

#### Acceptance Criteria

1. THE Log_Sistemi SHALL log the following additional actions:
   - copy_content: İçerik kopyalama
   - copy_template: Şablon kopyalama
   - edit_content: İçerik düzenleme
   - delete_content: İçerik silme
   - create_role: Rol oluşturma
   - edit_role: Rol düzenleme
   - delete_role: Rol silme
   - view_logs: Log görüntüleme
   - export_logs: Log dışa aktarma
2. WHEN a user queries the AI assistant THEN THE System SHALL log the query with full message content
3. WHEN a user copies a template or content THEN THE System SHALL log the copy action with content details

### Requirement 13: Kimlik Doğrulama Düzeltmeleri

**User Story:** As a user, I want to be able to login without errors, so that I can access the system reliably.

#### Acceptance Criteria

1. THE System SHALL handle login requests without errors
2. THE System SHALL properly validate credentials and create sessions
3. THE System SHALL redirect authenticated users to the appropriate page based on their status

