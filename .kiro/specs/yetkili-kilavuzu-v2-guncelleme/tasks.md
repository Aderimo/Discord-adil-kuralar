# Implementation Plan: Yetkili Kılavuzu v2 Güncelleme

## Overview

Bu plan, Yetkili Kılavuzu v2 Discord moderasyon panelinin kapsamlı güncellemesini içerir. Hata düzeltmeleri, yeni özellikler ve RBAC iyileştirmeleri adım adım uygulanacaktır.

## Tasks

- [x] 1. Ana Sayfa Buton Yönlendirme Düzeltmeleri
  - [x] 1.1 QuickAccessCard href değerlerini düzelt
    - `src/app/page.tsx` dosyasında href değerlerini güncelle
    - `/guide/giris` → `/guide`
    - `/penalties/yazili` → `/penalties`
    - `/procedures/kayit-proseduru` → `/procedures`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 Quick access card navigation property testi yaz
    - **Property 1: Quick Access Card Navigation Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. Sidebar Görünürlük Düzeltmesi
  - [x] 2.1 Tüm sayfalarda MainLayout + Sidebar kullanımını kontrol et ve düzelt
    - `src/app/guide/page.tsx` - MainLayout ile Sidebar ekle
    - `src/app/guide/[slug]/page.tsx` - MainLayout ile Sidebar ekle
    - `src/app/penalties/page.tsx` - MainLayout ile Sidebar ekle
    - `src/app/penalties/[category]/page.tsx` - MainLayout ile Sidebar ekle
    - `src/app/procedures/page.tsx` - MainLayout ile Sidebar ekle
    - `src/app/procedures/[slug]/page.tsx` - MainLayout ile Sidebar ekle (varsa)
    - `src/app/commands/page.tsx` - MainLayout ile Sidebar kontrol et
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.2 Sidebar visibility property testi yaz
    - **Property 2: Sidebar Visibility Invariant**
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Checkpoint - Hata düzeltmelerini doğrula
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Komutlar Sayfası Kategorize Yapısı
  - [x] 4.1 Komut kategorileri için tip tanımları ekle
    - `src/types/content.ts` dosyasına CommandCategory tipi ekle
    - CommandDefinition interface'ine category alanı ekle
    - _Requirements: 3.1_
  
  - [x] 4.2 content/commands/index.json dosyasını güncelle
    - Mevcut komutlara category alanı ekle
    - Yeni komutları ekle: h!ban, h!unban, /allow, /deny
    - _Requirements: 3.3, 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 4.3 Komutlar ana sayfasını kategorili yapıya dönüştür
    - `src/app/commands/page.tsx` dosyasını güncelle
    - Kategori kartları ile liste görünümü
    - _Requirements: 3.1, 3.4_
  
  - [x] 4.4 Kategori detay sayfası oluştur
    - `src/app/commands/[category]/page.tsx` dosyası oluştur
    - Kategoriye göre filtrelenmiş komut listesi
    - _Requirements: 3.5, 10.6_
  
  - [x] 4.5 Command categorization property testi yaz
    - **Property 3: Command Categorization Completeness**
    - **Validates: Requirements 3.1, 3.5**

- [x] 5. AI Danışman Hata Düzeltmesi
  - [x] 5.1 Mock response sistemini geliştir
    - `src/lib/ai-assistant.ts` dosyasında MOCK_RESPONSES objesi ekle
    - Keyword bazlı mock yanıt fonksiyonu oluştur
    - _Requirements: 4.1, 4.4_
  
  - [x] 5.2 API key kontrolünü iyileştir
    - `src/app/api/ai/chat/route.ts` dosyasında kontrol ekle
    - Kullanıcı dostu hata mesajları
    - _Requirements: 4.2, 4.3, 4.5_
  
  - [x] 5.3 AI mock response property testi yaz
    - **Property 4: AI Mock Response Keyword Matching**
    - **Validates: Requirements 4.3, 4.4**

- [x] 6. Checkpoint - Temel özellikler tamamlandı
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. RBAC Güncellemesi
  - [x] 7.1 İzin tanımlarını genişlet
    - `src/lib/rbac.ts` dosyasına PERMISSIONS objesi ekle
    - hasPermission fonksiyonu ekle
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 7.2 UI element gizleme için hook oluştur
    - `src/hooks/usePermission.ts` dosyası oluştur
    - Rol bazlı UI kontrolü için hook
    - _Requirements: 6.6_
  
  - [x] 7.3 RBAC permission property testi yaz
    - **Property 6: RBAC Permission Enforcement**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

- [x] 8. Gelişmiş Kullanıcı Yönetimi
  - [x] 8.1 Tüm kullanıcıları listeleyen API endpoint oluştur
    - `src/app/api/admin/users/route.ts` dosyasını güncelle
    - Filtreleme parametreleri: search, status, role
    - Pagination desteği
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 8.2 Toplu işlem API endpoint'i oluştur
    - `src/app/api/admin/users/bulk/route.ts` dosyası oluştur
    - Toplu onaylama/reddetme
    - _Requirements: 5.5_
  
  - [x] 8.3 Admin paneli UI'ını güncelle
    - `src/app/admin/page.tsx` dosyasını güncelle
    - Tüm kullanıcılar listesi (pending, approved, rejected)
    - Arama ve filtreleme UI
    - Yetki değiştir dropdown
    - İstatistik kartları
    - _Requirements: 5.1, 5.4, 5.7_
  
  - [x] 8.4 Kullanıcı detay sayfası oluştur
    - `src/app/admin/users/[id]/page.tsx` dosyası oluştur
    - Kullanıcı bilgileri ve aktivite geçmişi
    - _Requirements: 5.6_
  
  - [x] 8.5 User filtering property testi yaz
    - **Property 5: User Filtering Correctness**
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.7**

- [x] 9. Checkpoint - Kullanıcı yönetimi tamamlandı
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Log Sistemi Geliştirmeleri
  - [x] 10.1 Log export fonksiyonu ekle
    - `src/lib/logging.ts` dosyasına exportLogs fonksiyonu ekle
    - CSV ve JSON format desteği
    - _Requirements: 7.4_
  
  - [x] 10.2 Log export API endpoint'i oluştur
    - `src/app/api/admin/logs/export/route.ts` dosyası oluştur
    - Format parametresi (csv/json)
    - _Requirements: 7.4_
  
  - [x] 10.3 Log sayfasına export butonu ekle
    - `src/app/admin/logs/page.tsx` dosyasını güncelle
    - Export dropdown (CSV/JSON)
    - _Requirements: 7.2, 7.4_
  
  - [x] 10.4 Activity logging property testi yaz
    - **Property 7: Activity Logging Completeness**
    - **Validates: Requirements 7.1, 7.6**
  
  - [x] 10.5 Log filtering and export property testi yaz
    - **Property 8: Log Filtering and Export Round-Trip**
    - **Validates: Requirements 7.3, 7.4**

- [x] 11. Ceza Şablonları
  - [x] 11.1 Şablon veri yapısı oluştur
    - `src/types/templates.ts` dosyası oluştur
    - PenaltyTemplate interface tanımla
    - _Requirements: 8.1_
  
  - [x] 11.2 Şablon içerik dosyası oluştur
    - `content/templates/index.json` dosyası oluştur
    - Çalıntı Hesap ve Underage şablonları ekle
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 11.3 Şablon yükleme fonksiyonu ekle
    - `src/lib/content.ts` dosyasına loadTemplates fonksiyonu ekle
    - _Requirements: 8.1_
  
  - [x] 11.4 Şablon bileşeni oluştur
    - `src/components/templates/PenaltyTemplates.tsx` dosyası oluştur
    - Şablon listesi, kopyala butonu, düzenleme (sadece ust_yetkili)
    - _Requirements: 8.4, 8.5, 8.6_
  
  - [x] 11.5 Şablonlar sayfası oluştur
    - `src/app/templates/page.tsx` dosyası oluştur
    - MainLayout ile şablon listesi
    - _Requirements: 8.1_
  
  - [x] 11.6 Template permission property testi yaz
    - **Property 9: Template Edit Permission Enforcement**
    - **Validates: Requirements 8.5, 8.6**

- [x] 12. Checkpoint - Şablonlar tamamlandı
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Bildirim Sistemi
  - [x] 13.1 Prisma şemasına Notification modeli ekle
    - `prisma/schema.prisma` dosyasını güncelle
    - Migration oluştur ve uygula
    - _Requirements: 9.1_
  
  - [x] 13.2 Bildirim servisi oluştur
    - `src/lib/notifications.ts` dosyası oluştur
    - createNotification, getNotifications, markAsRead fonksiyonları
    - _Requirements: 9.1, 9.2, 9.5_
  
  - [x] 13.3 Bildirim API endpoint'leri oluştur
    - `src/app/api/notifications/route.ts` - GET (liste)
    - `src/app/api/notifications/[id]/route.ts` - PUT (okundu)
    - `src/app/api/notifications/read-all/route.ts` - POST (tümü okundu)
    - _Requirements: 9.4, 9.5_
  
  - [x] 13.4 Bildirim bileşenleri oluştur
    - `src/components/notifications/NotificationBell.tsx` - Header'da badge
    - `src/components/notifications/NotificationList.tsx` - Dropdown liste
    - _Requirements: 9.3, 9.4_
  
  - [x] 13.5 Header'a bildirim entegrasyonu
    - `src/components/layout/MainLayout.tsx` dosyasını güncelle
    - Sadece ust_yetkili için bildirim ikonu
    - _Requirements: 9.3, 9.6_
  
  - [x] 13.6 Otomatik bildirim tetikleyicileri ekle
    - Yeni kayıt olduğunda bildirim oluştur
    - İçerik değişikliğinde bildirim oluştur
    - _Requirements: 9.1, 9.2_
  
  - [x] 13.7 Notification system property testi yaz
    - **Property 10: Notification System Correctness**
    - **Validates: Requirements 9.1, 9.2, 9.5, 9.6**

- [x] 14. Sidebar'a Yeni Menü Öğeleri Ekle
  - [x] 14.1 Sidebar'a Şablonlar menüsü ekle
    - `src/components/layout/Sidebar.tsx` dosyasını güncelle
    - Şablonlar linki ekle
    - _Requirements: 8.1_

- [x] 15. Dinamik Rol Yönetim Sistemi
  - [x] 15.1 Varsayılan rolleri veritabanına seed et
    - `prisma/seed.ts` dosyasını güncelle
    - 7 yeni rol ekle: reg, op, gk, council, gm, gm_plus, owner
    - Her rol için açıklama, hiyerarşi ve izinler tanımla
    - _Requirements: 11.1, 11.2_
  
  - [x] 15.2 Rol yönetimi API endpoint'leri oluştur
    - `src/app/api/admin/roles/route.ts` - GET (liste), POST (oluştur)
    - `src/app/api/admin/roles/[id]/route.ts` - GET, PUT, DELETE
    - Sadece owner rolü erişebilir
    - _Requirements: 11.3, 11.4, 11.5_
  
  - [x] 15.3 Rol yönetimi sayfası oluştur
    - `src/app/admin/settings/page.tsx` dosyasını güncelle
    - Rol listesi, ekleme, düzenleme, silme UI
    - İzin checkbox'ları ile rol yapılandırma
    - _Requirements: 11.3, 11.4, 11.5, 11.6_
  
  - [x] 15.4 Kullanıcı rol atama UI'ını güncelle
    - `src/app/admin/page.tsx` dosyasında rol dropdown'ını dinamik yap
    - Veritabanından rolleri çek
    - _Requirements: 11.7_
  
  - [x] 15.5 Owner rolü koruması ekle
    - Owner rolü sadece mevcut owner'lar tarafından atanabilir
    - Owner rolü silinemez (isSystem: true)
    - _Requirements: 11.8_

- [x] 16. Founder/Owner Kullanıcı Ayarı
  - [x] 16.1 esenyurtcocg65@gmail.com kullanıcısını owner yap
    - Seed script'inde bu kullanıcıyı owner olarak ayarla
    - Kullanıcı yoksa oluştur ve onayla
    - _Requirements: 11.9_

- [x] 17. Gelişmiş Log Sistemi
  - [x] 17.1 Yeni log türlerini ekle
    - copy_content, copy_template, edit_content, delete_content
    - create_role, edit_role, delete_role
    - view_logs, export_logs
    - _Requirements: 12.1_
  
  - [x] 17.2 AI sorgu loglaması ekle
    - AI'a sorulan her soru loglanmalı
    - _Requirements: 12.2_
  
  - [x] 17.3 Kopyalama loglaması ekle
    - Şablon ve içerik kopyalamalarını logla
    - _Requirements: 12.3_

- [x] 18. Login Hatası Düzeltmesi
  - [x] 18.1 Auth sistemini kontrol et ve düzelt
    - Login API'sini debug et
    - Session yönetimini kontrol et
    - _Requirements: 13.1_

- [x] 19. Checkpoint - Rol sistemi tamamlandı
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Final Checkpoint - Tüm özellikler tamamlandı
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Mevcut Shadcn UI bileşenleri kullanılmalı (Button, Card, Dialog, DropdownMenu, etc.)
- Tüm yeni sayfalar MainLayout + Sidebar yapısını kullanmalı

