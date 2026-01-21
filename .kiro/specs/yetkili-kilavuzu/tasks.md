# Uygulama Planı: Yetkili Kılavuzu ve Ceza Danışman Sistemi

## Genel Bakış

Bu plan, SANIYE MODLARI Discord sunucusu için Yetkili Kılavuzu ve Ceza Danışman Sistemi'nin adım adım implementasyonunu tanımlar. Next.js, TypeScript, Prisma ORM ve RAG tabanlı AI asistan kullanılacaktır.

## Görevler

- [x] 1. Proje Kurulumu ve Temel Yapılandırma
  - [x] 1.1 Next.js projesi oluştur ve TypeScript yapılandır
    - `create-next-app` ile proje oluştur
    - TypeScript strict mode aktif et
    - ESLint ve Prettier yapılandır
    - _Gereksinimler: 10.1, 10.3_
  
  - [x] 1.2 Veritabanı ve ORM kurulumu
    - Prisma ORM kur ve yapılandır
    - SQLite (geliştirme) / PostgreSQL (production) bağlantısı
    - User, Session, ActivityLog şemalarını oluştur
    - _Gereksinimler: 10.2_
  
  - [x] 1.3 Temel UI kütüphaneleri kurulumu
    - Tailwind CSS yapılandır
    - Shadcn/ui bileşenlerini kur
    - Discord uyumlu koyu tema renk paleti tanımla
    - _Gereksinimler: 8.2_

- [x] 2. Kimlik Doğrulama Sistemi
  - [x] 2.1 Auth API endpoints oluştur
    - `/api/auth/register` - Kullanıcı kaydı (varsayılan "Beklemede" durumu)
    - `/api/auth/login` - Giriş ve JWT token oluşturma
    - `/api/auth/logout` - Oturum sonlandırma
    - `/api/auth/me` - Mevcut kullanıcı bilgisi
    - _Gereksinimler: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 2.2 Property test: Kayıt durumu tutarlılığı
    - **Property 1: Kayıt Durumu Tutarlılığı**
    - **Validates: Requirements 1.1**
  
  - [x] 2.3 Property test: Kimlik doğrulama round-trip
    - **Property 2: Kimlik Doğrulama Round-Trip**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  
  - [x] 2.4 Auth Context ve hooks oluştur
    - `useAuth` hook - giriş durumu yönetimi
    - `AuthProvider` context - oturum state'i
    - Protected route wrapper bileşeni
    - _Gereksinimler: 1.2, 2.4_
  
  - [x] 2.5 Giriş ve kayıt sayfaları oluştur
    - `/login` sayfası - form validasyonu ile
    - `/register` sayfası - form validasyonu ile
    - Hata mesajları gösterimi
    - _Gereksinimler: 1.1, 1.2, 1.3_

- [x] 3. Checkpoint - Auth sistemi tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 4. Yetki Tabanlı Erişim Kontrolü
  - [x] 4.1 RBAC middleware oluştur
    - Yetki seviyesi kontrolü (none, mod, admin, ust_yetkili)
    - Her sayfa isteğinde yetki doğrulama
    - Yetkisiz erişim engelleme
    - _Gereksinimler: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 4.2 Property test: Yetki tabanlı erişim kontrolü
    - **Property 3: Yetki Tabanlı Erişim Kontrolü**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [x] 4.3 Yetkisiz erişim sayfası oluştur
    - "BU SİTE SADECE SANİYE MODLARINA AİTTİR" mesajı
    - Minimal tasarım, sadece bu mesaj görünecek
    - _Gereksinimler: 2.1_
  
  - [x] 4.4 Beklemede durumu sayfası oluştur
    - "Hesabınız henüz onaylanmadı" mesajı
    - Bekleme durumu bilgilendirmesi
    - _Gereksinimler: 2.3_

- [x] 5. Admin/Mod Paneli
  - [x] 5.1 Admin API endpoints oluştur
    - `/api/admin/users/pending` - Bekleyen kullanıcılar listesi
    - `/api/admin/users/:id/approve` - Kullanıcı onaylama
    - `/api/admin/users/:id/reject` - Kullanıcı reddetme
    - `/api/admin/users/:id/role` - Yetki seviyesi değiştirme
    - _Gereksinimler: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 5.2 Property test: Admin kullanıcı yönetimi tutarlılığı
    - **Property 4: Admin Kullanıcı Yönetimi Tutarlılığı**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 5.3 Admin panel UI oluştur
    - Bekleyen kullanıcılar tablosu
    - Onaylama/reddetme butonları
    - Yetki seviyesi dropdown
    - Aktivite logları görüntüleme
    - _Gereksinimler: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Checkpoint - Kullanıcı yönetimi tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 7. İçerik Yönetimi ve Yapısı
  - [x] 7.1 İçerik veri yapısını oluştur
    - GuideContent, PenaltyDefinition, CommandDefinition şemaları
    - JSON/Markdown içerik dosyaları yapısı
    - İçerik yükleme servisi
    - _Gereksinimler: 4.1, 4.3, 4.4, 10.2_
  
  - [x] 7.2 Content API endpoints oluştur
    - `/api/content/sections` - Tüm bölümler
    - `/api/content/sections/:id` - Tek bölüm detayı
    - `/api/content/penalties` - Cezalar listesi
    - `/api/content/commands` - Komutlar listesi
    - `/api/content/procedures` - Prosedürler listesi
    - _Gereksinimler: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.3 Property test: İçerik erişimi tutarlılığı
    - **Property 5: İçerik Erişimi Tutarlılığı**
    - **Validates: Requirements 4.2**
  
  - [x] 7.4 Örnek içerik verisi oluştur
    - Yetkili Kılavuzu v2 bölümleri
    - Ceza tanımları (yazılı, sesli, ekstra, marked, blacklist)
    - Komut listesi
    - Prosedür dökümanları
    - Örnek kayıtlar
    - _Gereksinimler: 4.1, 4.3, 4.4, 4.5_

- [x] 8. Ana Layout ve Navigasyon
  - [x] 8.1 Ana layout bileşeni oluştur
    - Sol sidebar + ana içerik alanı yapısı
    - Responsive tasarım (mobil/tablet/masaüstü)
    - Discord uyumlu koyu tema
    - _Gereksinimler: 8.1, 8.2, 8.3_
  
  - [x] 8.2 Sidebar bileşeni oluştur
    - Yetkili Kılavuzu menüsü (alt bölümlerle)
    - Cezalar menüsü (kategorilere ayrılmış)
    - Komutlar menüsü
    - Prosedürler menüsü
    - Admin Paneli linki (sadece yetkililere)
    - _Gereksinimler: 4.1, 4.3, 4.4_
  
  - [x] 8.3 ContentViewer bileşeni oluştur
    - Markdown içerik render
    - Arama terimlerini vurgulama
    - Bölümler arası navigasyon
    - _Gereksinimler: 4.2_

- [x] 9. Arama Sistemi
  - [x] 9.1 Search API endpoint oluştur
    - `/api/search?q={query}` - Tam metin arama
    - Madde, ceza, komut, ihlal bazlı filtreleme
    - Relevance skorlama
    - _Gereksinimler: 5.1, 5.2, 5.3_
  
  - [x] 9.2 Property test: Arama sonuçları tutarlılığı
    - **Property 6: Arama Sonuçları Tutarlılığı**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 9.3 SearchBar bileşeni oluştur
    - Anlık arama (debounced)
    - Sonuç kategorileri gösterimi
    - Sonuç tıklama ile navigasyon
    - "Sonuç bulunamadı" durumu
    - _Gereksinimler: 5.1, 5.2, 5.4_

- [x] 10. Checkpoint - İçerik ve arama tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 11. RAG Altyapısı ve Vector Store
  - [x] 11.1 Vector store kurulumu
    - OpenAI embeddings entegrasyonu
    - İçerik chunking stratejisi
    - ContentChunk şeması ve indeksleme
    - _Gereksinimler: 6.4_
  
  - [x] 11.2 İçerik embedding pipeline oluştur
    - Tüm içeriği chunk'lara ayır
    - Her chunk için embedding oluştur
    - Vector store'a kaydet
    - _Gereksinimler: 6.4_
  
  - [x] 11.3 RAG retrieval servisi oluştur
    - Sorgu embedding oluşturma
    - Benzer içerik arama
    - Kaynak referansları döndürme
    - _Gereksinimler: 6.1, 6.4_

- [x] 12. AI Ceza Danışmanı
  - [x] 12.1 AI Assistant API endpoint oluştur
    - `/api/ai/chat` - Sohbet endpoint'i
    - RAG tabanlı context injection
    - Ceza analizi ve öneri sistemi
    - Güven skoru hesaplama
    - _Gereksinimler: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 12.2 Property test: AI yanıt kaynak tutarlılığı
    - **Property 7: AI Yanıt Kaynak Tutarlılığı**
    - **Validates: Requirements 6.1, 6.4**
  
  - [x] 12.3 Property test: AI ceza analizi tamlığı
    - **Property 8: AI Ceza Analizi Tamlığı**
    - **Validates: Requirements 6.2, 6.3**
  
  - [x] 12.4 Property test: AI belirsizlik yönetimi
    - **Property 9: AI Belirsizlik Yönetimi**
    - **Validates: Requirements 6.5**
  
  - [x] 12.5 Ceza kaydı oluşturma servisi
    - Formatlanmış ceza metni oluşturma
    - İhlal türü, süre, madde, gerekçe içerme
    - Kopyalanabilir format
    - _Gereksinimler: 7.1, 7.2_
  
  - [x] 12.6 Property test: Ceza kaydı format tamlığı
    - **Property 10: Ceza Kaydı Format Tamlığı**
    - **Validates: Requirements 7.1, 7.2**

- [x] 13. AI Chat UI
  - [x] 13.1 AI Chat Bubble bileşeni oluştur
    - Sağ alt köşe floating button
    - Açılır sohbet penceresi
    - Mesaj geçmişi gösterimi
    - _Gereksinimler: 6.1_
  
  - [x] 13.2 Chat mesaj bileşenleri oluştur
    - Kullanıcı mesajı stili
    - Asistan mesajı stili
    - Ceza kaydı kartı (kopyala butonu ile)
    - Yükleniyor durumu
    - _Gereksinimler: 6.2, 7.1, 7.3_

- [x] 14. Checkpoint - AI asistan tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 15. Loglama Sistemi
  - [x] 15.1 Logging API ve servisi oluştur
    - `/api/logs` - Log kayıtları endpoint'i
    - Giriş logları (kullanıcı, zaman, IP)
    - İçerik erişim logları
    - Yetki değişikliği logları
    - Yetkisiz erişim denemeleri logları
    - _Gereksinimler: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 15.2 Property test: Kapsamlı loglama
    - **Property 11: Kapsamlı Loglama**
    - **Validates: Requirements 3.5, 9.1, 9.2, 9.4**
  
  - [x] 15.3 Log middleware entegrasyonu
    - Her API isteğinde otomatik loglama
    - Kullanıcı aktivite takibi
    - _Gereksinimler: 9.1, 9.2_

- [x] 16. Son Entegrasyon ve Polish
  - [x] 16.1 Tüm sayfaları birleştir
    - Ana sayfa (dashboard)
    - İçerik sayfaları
    - Admin paneli
    - Giriş/kayıt sayfaları
    - _Gereksinimler: Tüm gereksinimler_
  
  - [x] 16.2 Responsive tasarım kontrolü
    - Mobil görünüm optimizasyonu
    - Tablet görünüm optimizasyonu
    - Masaüstü görünüm optimizasyonu
    - _Gereksinimler: 8.1, 8.3_
  
  - [x] 16.3 Hata sayfaları oluştur
    - 404 sayfası
    - 500 sayfası
    - Genel hata boundary
    - _Gereksinimler: Hata yönetimi_

- [x] 17. Final Checkpoint - Proje tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.
  - Tüm gereksinimlerin karşılandığını doğrula.

- [x] 18. İçerik Düzenleme Sistemi (Sadece Üst Yetkili)
  - [x] 18.1 Content Management API endpoints oluştur
    - `PUT /api/content/sections/:id` - İçerik güncelleme
    - `POST /api/content/sections` - Yeni içerik ekleme
    - `DELETE /api/content/sections/:id` - İçerik silme
    - Sadece ust_yetkili rolü erişebilir kontrolü
    - _Gereksinimler: 11.1, 11.3, 11.4, 11.5_
  
  - [x] 18.2 Property test: İçerik düzenleme yetki kontrolü
    - **Property 12: İçerik Düzenleme Yetki Kontrolü**
    - **Validates: Requirements 11.1, 11.5, 11.6**
  
  - [x] 18.3 ContentEditor bileşeni oluştur
    - Markdown editör arayüzü
    - Önizleme modu
    - Kaydet/İptal butonları
    - Sadece ust_yetkili rolüne görünür
    - _Gereksinimler: 11.2, 11.3_
  
  - [x] 18.4 İçerik sayfalarına düzenleme butonu ekle
    - Sadece ust_yetkili rolü için görünür
    - Düzenleme moduna geçiş
    - _Gereksinimler: 11.1, 11.5_
  
  - [x] 18.5 İçerik değişikliği loglama
    - Kim değiştirdi
    - Ne zaman değiştirdi
    - Önceki ve yeni içerik karşılaştırması
    - _Gereksinimler: 11.6_

- [x] 19. Navigasyon İyileştirmeleri
  - [x] 19.1 BackButton bileşeni oluştur
    - Tarayıcı history kontrolü
    - Fallback URL desteği
    - Her içerik sayfasında görünür
    - _Gereksinimler: 12.1, 12.2_
  
  - [x] 19.2 Breadcrumb bileşeni oluştur
    - Dinamik breadcrumb oluşturma
    - Tıklanabilir linkler
    - Mevcut konum gösterimi
    - _Gereksinimler: 12.4_
  
  - [x] 19.3 Property test: Navigasyon tutarlılığı
    - **Property 13: Navigasyon Tutarlılığı**
    - **Validates: Requirements 12.1, 12.3, 12.4**
  
  - [x] 19.4 Header'a ana sayfa linki ekle
    - Logo/başlık tıklanabilir
    - Her zaman ana sayfaya yönlendir
    - _Gereksinimler: 12.3_
  
  - [x] 19.5 Tüm içerik sayfalarına navigasyon bileşenlerini entegre et
    - BackButton ekleme
    - Breadcrumb ekleme
    - Responsive tasarım kontrolü
    - _Gereksinimler: 12.1, 12.4, 12.5_

- [x] 20. Final Checkpoint - Yeni özellikler tamamlandı
  - Tüm testlerin geçtiğinden emin ol
  - İçerik düzenleme sadece ust_yetkili için çalışıyor mu kontrol et
  - Navigasyon tüm sayfalarda düzgün çalışıyor mu kontrol et

## Notlar

- Tüm görevler zorunludur (kapsamlı geliştirme modu)
- Her görev belirli gereksinimlere referans verir
- Checkpoint'ler artımlı doğrulama sağlar
- Property testleri evrensel doğruluk özelliklerini doğrular
- Unit testler belirli örnekleri ve edge case'leri doğrular
