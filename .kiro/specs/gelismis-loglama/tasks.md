# Implementation Plan: Gelişmiş Loglama Sistemi

## Overview

Bu plan, mevcut loglama altyapısını genişleterek kapsamlı bir aktivite takip sistemi oluşturacak. Mevcut `src/lib/logging.ts` dosyası temel alınarak yeni servisler ve API endpoint'leri eklenecek.

## Tasks

- [x] 1. Veritabanı şeması güncellemesi
  - [x] 1.1 LogPermission ve LogThreshold modellerini Prisma şemasına ekle
    - `LogPermission`: userId, canDownload, canDelete, grantedAt, downloadedAt, deletedAt
    - `LogThreshold`: lastNotificationAt, lastNotificationCount, lastDownloadAt, lastDeleteAt
    - User modeline LogPermission ilişkisi ekle
    - _Requirements: 6.1, 7.4, 8.3_
  - [x] 1.2 ActivityAction tipine yeni action türlerini ekle
    - visitor_access, ai_interaction, page_access, text_input, text_copy, referrer_track, url_copy, log_download, log_delete
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 9.1, 10.1_
  - [x] 1.3 Prisma migration çalıştır
    - _Requirements: 11.1_

- [x] 2. Advanced Logger Service implementasyonu
  - [x] 2.1 `src/lib/advanced-logging.ts` dosyasını oluştur
    - VisitorInfo, AIInteractionLog, PageAccessLog, SearchLog, TextInputLog, TextCopyLog, ReferrerLog interface'lerini tanımla
    - Truncation helper fonksiyonları (2000, 1000, 500 karakter limitleri)
    - _Requirements: 2.4, 5.4, 10.3_
  - [x] 2.2 logVisitorAccess fonksiyonunu implement et
    - Anonim ve authenticated kullanıcı desteği
    - IP format validasyonu (IPv4/IPv6)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.3 Property test: IP ve Kullanıcı Bilgisi Loglama
    - **Property 1: IP ve Kullanıcı Bilgisi Loglama**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  - [x] 2.4 logAIInteraction fonksiyonunu implement et
    - Soru ve cevap birlikte loglama
    - Timestamp, user ID, session context dahil
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 2.5 Property test: AI Etkileşim Loglama
    - **Property 2: AI Etkileşim Loglama**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
  - [x] 2.6 logPageAccess fonksiyonunu implement et
    - URL, title, category, contentType, referrer, accessType
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.7 Property test: Sayfa Erişim Loglama
    - **Property 4: Sayfa Erişim Loglama**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [x] 2.8 logSearchActivity fonksiyonunu implement et
    - Query, resultsCount, selectedResult
    - Zero-result search desteği
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 2.9 Property test: Arama Loglama
    - **Property 5: Arama Loglama**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [x] 2.10 logTextInput fonksiyonunu implement et
    - Field ID, form context, content (max 1000 chars)
    - Hassas alan filtreleme (password, personal data)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.11 Property test: Hassas Alan Filtreleme
    - **Property 6: Hassas Alan Filtreleme**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x] 2.12 Property test: Metin Truncation
    - **Property 3: Metin Truncation**
    - **Validates: Requirements 2.4, 5.4, 10.3**

- [x] 3. Checkpoint - Temel loglama servisi tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 4. Referrer ve Kopyalama Takibi
  - [x] 4.1 logTextCopy fonksiyonunu implement et
    - Copied text (max 500 chars), source page, element context
    - Selection start/end positions
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 4.2 Property test: Metin Kopyalama Loglama
    - **Property 12: Metin Kopyalama Loglama**
    - **Validates: Requirements 10.1, 10.2, 10.4**
  - [x] 4.3 logReferrer fonksiyonunu implement et
    - Referrer URL, source domain extraction
    - Source type classification (social/search/direct/other)
    - Source counter increment
    - _Requirements: 9.1, 9.3, 9.4, 9.5_
  - [x] 4.4 Property test: Referrer Loglama
    - **Property 10: Referrer Loglama**
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5**
  - [x] 4.5 logURLCopy fonksiyonunu implement et
    - URL copy event with page context
    - _Requirements: 9.2_
  - [x] 4.6 Property test: URL Kopyalama Loglama
    - **Property 11: URL Kopyalama Loglama**
    - **Validates: Requirements 9.2**

- [x] 5. Threshold Monitor Service
  - [x] 5.1 `src/lib/log-threshold.ts` dosyasını oluştur
    - ThresholdConfig, ThresholdStatus interface'leri
    - PAGE_SIZE = 20, NOTIFICATION_THRESHOLD = 50 (1000 kayıt)
    - _Requirements: 6.1_
  - [x] 5.2 checkThreshold fonksiyonunu implement et
    - Mevcut log sayısını hesapla
    - Sayfa sayısını döndür
    - _Requirements: 6.1_
  - [x] 5.3 triggerNotification fonksiyonunu implement et
    - Owner'a "Log geçmişi 50 sayfa oldu" bildirimi gönder
    - Download permission ver
    - Duplicate bildirim engelleme
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 5.4 Property test: Eşik Bildirimi
    - **Property 7: Eşik Bildirimi**
    - **Validates: Requirements 6.1, 6.3, 6.4, 6.5**

- [x] 6. Permission Manager Service
  - [x] 6.1 `src/lib/log-permission.ts` dosyasını oluştur
    - LogPermission interface
    - _Requirements: 7.4, 8.3_
  - [x] 6.2 grantDownloadPermission ve grantDeletePermission fonksiyonlarını implement et
    - _Requirements: 6.3, 7.4_
  - [x] 6.3 revokeDeletePermission fonksiyonunu implement et
    - Silme sonrası yetki iptali
    - _Requirements: 8.3, 8.4_
  - [x] 6.4 checkPermission fonksiyonunu implement et
    - Download/delete yetki kontrolü
    - _Requirements: 8.5_
  - [x] 6.5 Property test: Yetki State Machine
    - **Property 9: Yetki State Machine**
    - **Validates: Requirements 7.4, 8.2, 8.3, 8.4, 8.5, 8.6**

- [-] 7. Export Service
  - [-] 7.1 `src/lib/log-export.ts` dosyasını oluştur
    - ExportOptions, ExportResult interface'leri
    - _Requirements: 7.2_
  - [ ] 7.2 exportLogs fonksiyonunu implement et
    - CSV ve JSON format desteği
    - Son indirmeden sonraki tüm logları dahil et
    - _Requirements: 7.2, 7.3_
  - [ ] 7.3 generateFilename fonksiyonunu implement et
    - Timestamp ile benzersiz dosya adı
    - _Requirements: 7.5_
  - [ ] 7.4 Property test: Log Export Round-Trip
    - **Property 8: Log Export Round-Trip**
    - **Validates: Requirements 7.2, 7.3, 7.5**

- [ ] 8. Checkpoint - Servisler tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [ ] 9. API Endpoints
  - [ ] 9.1 `src/app/api/logs/visitor/route.ts` - Ziyaretçi erişimi loglama
    - POST: IP, userAgent, referrer
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 9.2 `src/app/api/logs/ai/route.ts` - AI etkileşimi loglama
    - POST: question, response, confidence
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 9.3 `src/app/api/logs/page/route.ts` - Sayfa erişimi loglama
    - POST: url, title, category, contentType, referrer
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 9.4 `src/app/api/logs/search/route.ts` - Arama loglama
    - POST: query, resultsCount, selectedResult
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 9.5 `src/app/api/logs/input/route.ts` - Metin girişi loglama
    - POST: fieldId, formContext, content
    - _Requirements: 5.1, 5.2_
  - [ ] 9.6 `src/app/api/logs/copy/route.ts` - Metin kopyalama loglama
    - POST: copiedText, sourcePage, elementContext, selectionStart, selectionEnd
    - _Requirements: 10.1, 10.2, 10.4_
  - [ ] 9.7 `src/app/api/logs/referrer/route.ts` - Referrer loglama
    - POST: referrerUrl, sourceDomain, sourceType
    - _Requirements: 9.1, 9.3, 9.4_
  - [ ] 9.8 `src/app/api/logs/status/route.ts` - Log durumu
    - GET: currentCount, currentPages, thresholdReached
    - _Requirements: 6.1_
  - [ ] 9.9 `src/app/api/logs/download/route.ts` - Log indirme
    - GET: CSV/JSON export, yetki kontrolü
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 9.10 `src/app/api/logs/delete/route.ts` - Log silme
    - DELETE: Yetki kontrolü, silme işlemi, yetki iptali
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_
  - [ ] 9.11 `src/app/api/logs/permission/route.ts` - Yetki durumu
    - GET: canDownload, canDelete
    - _Requirements: 8.1_

- [ ] 10. Client-Side Trackers
  - [ ] 10.1 `src/hooks/usePageTracker.ts` hook'unu oluştur
    - Sayfa değişikliklerini dinle
    - /api/logs/page endpoint'ine POST
    - _Requirements: 3.1_
  - [ ] 10.2 `src/hooks/useCopyTracker.ts` hook'unu oluştur
    - document.oncopy event listener
    - Selection bilgilerini al
    - /api/logs/copy endpoint'ine POST
    - _Requirements: 10.1, 10.4_
  - [ ] 10.3 `src/hooks/useReferrerTracker.ts` hook'unu oluştur
    - document.referrer kontrolü
    - /api/logs/referrer endpoint'ine POST
    - _Requirements: 9.1_
  - [ ] 10.4 MainLayout'a tracker hook'larını entegre et
    - _Requirements: 1.1, 3.1, 9.1, 10.1_

- [ ] 11. Log Yönetim UI
  - [ ] 11.1 `src/app/admin/logs/page.tsx` sayfasını güncelle
    - Log durumu gösterimi (sayfa sayısı, eşik durumu)
    - İndirme butonu (yetkiye göre)
    - Silme butonu (yetkiye göre)
    - _Requirements: 7.1, 8.1_
  - [ ] 11.2 Log bildirim entegrasyonu
    - Notification tıklandığında logs sayfasına yönlendir
    - _Requirements: 7.1_

- [ ] 12. Log Persistence ve Retry
  - [ ] 12.1 Retry mekanizmasını implement et
    - 3 kez retry, sonra discard
    - _Requirements: 11.2_
  - [ ] 12.2 Duplicate engelleme mekanizmasını implement et
    - Event hash ile kontrol
    - _Requirements: 11.5_
  - [ ] 12.3 Property test: Log Persistence
    - **Property 13: Log Persistence**
    - **Validates: Requirements 11.1, 11.3, 11.4, 11.5**
  - [ ] 12.4 Property test: Retry Mekanizması
    - **Property 14: Retry Mekanizması**
    - **Validates: Requirements 11.2**

- [ ] 13. AI Chat Entegrasyonu
  - [ ] 13.1 `src/app/api/ai/chat/route.ts` dosyasını güncelle
    - AI soru-cevap loglaması ekle
    - logAIInteraction çağrısı
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 14. Final Checkpoint
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.
  - Tüm gereksinimlerin karşılandığını doğrula.

## Notes

- Her görev spesifik gereksinimlere referans verir
- Checkpoint'ler artımlı doğrulama sağlar
- Property testler evrensel doğruluk özelliklerini test eder
- Unit testler spesifik örnekleri ve edge case'leri test eder
