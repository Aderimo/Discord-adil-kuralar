# Gereksinimler Belgesi

## Giriş

Bu belge, Discord sunucusu "SANIYE MODLARI" için özel bir Yetkili Kılavuzu ve Ceza Danışman Sistemi web uygulamasının gereksinimlerini tanımlar. Sistem, yetkililerin ceza verirken, kayıt tutarken ve karar alırken hata yapmasını önleyen, hızlı, güvenilir ve profesyonel bir moderasyon rehberi olarak hizmet verecektir.

## Sözlük

- **Sistem**: Yetkili Kılavuzu ve Ceza Danışman web uygulaması
- **Yetkili**: Onaylanmış ve yetki seviyesi atanmış kullanıcı (Mod, Admin, Üst Yetkili)
- **Beklemede_Kullanıcı**: Kayıt olmuş ancak henüz onaylanmamış kullanıcı
- **Admin_Paneli**: Kullanıcı yönetimi ve sistem ayarlarının yapıldığı yönetim arayüzü
- **Yapay_Zeka_Asistanı**: Site içeriğine dayalı ceza danışmanlığı yapan AI modülü
- **Ceza_Kaydı**: Verilen cezanın formatlanmış metin çıktısı
- **RAG**: Retrieval-Augmented Generation - içerik tabanlı AI yanıt sistemi
- **RBAC**: Role-Based Access Control - rol tabanlı erişim kontrolü

## Gereksinimler

### Gereksinim 1: Kullanıcı Kimlik Doğrulama

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, sisteme kayıt olup giriş yapabilmek istiyorum, böylece yetkili onayı bekleyebilirim.

#### Kabul Kriterleri

1. WHEN bir kullanıcı kayıt formunu doldurur ve gönderir THEN Sistem SHALL kullanıcıyı "Beklemede" durumunda veritabanına kaydetmeli
2. WHEN bir kullanıcı geçerli kimlik bilgileriyle giriş yapar THEN Sistem SHALL kullanıcının oturumunu başlatmalı ve yetki durumunu kontrol etmeli
3. WHEN bir kullanıcı geçersiz kimlik bilgileriyle giriş yapmaya çalışır THEN Sistem SHALL hata mesajı göstermeli ve girişi reddetmeli
4. WHEN bir kullanıcı çıkış yapar THEN Sistem SHALL oturumu sonlandırmalı ve giriş sayfasına yönlendirmeli

### Gereksinim 2: Yetki Tabanlı Erişim Kontrolü

**Kullanıcı Hikayesi:** Bir sistem yöneticisi olarak, sadece onaylanmış yetkililerin içeriğe erişmesini istiyorum, böylece güvenlik sağlanır.

#### Kabul Kriterleri

1. WHEN onaylanmamış veya yetkisiz bir kullanıcı siteye erişmeye çalışır THEN Sistem SHALL sadece "BU SİTE SADECE SANİYE MODLARINA AİTTİR" mesajını göstermeli
2. WHEN onaylanmış bir yetkili giriş yapar THEN Sistem SHALL kullanıcının yetki seviyesine göre uygun içeriği göstermeli
3. WHILE bir kullanıcı "Beklemede" durumundayken THEN Sistem SHALL ana içeriğe erişimi engellemeli
4. THE Sistem SHALL her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı

### Gereksinim 3: Admin/Mod Paneli

**Kullanıcı Hikayesi:** Bir admin olarak, kullanıcıları yönetebilmek istiyorum, böylece yetkilendirme sürecini kontrol edebilirim.

#### Kabul Kriterleri

1. WHEN bir admin bekleyen kullanıcılar listesini görüntüler THEN Sistem SHALL tüm "Beklemede" durumundaki kullanıcıları listelemeli
2. WHEN bir admin bir kullanıcıyı onaylar THEN Sistem SHALL kullanıcının durumunu "Onaylı" olarak güncellemeli ve yetki seviyesi atamalı
3. WHEN bir admin bir kullanıcıyı reddeder THEN Sistem SHALL kullanıcının durumunu "Reddedildi" olarak güncellemeli
4. WHEN bir admin yetki seviyesi değiştirir THEN Sistem SHALL değişikliği kaydetmeli ve log oluşturmalı
5. THE Sistem SHALL tüm yetki değişikliklerini ve giriş işlemlerini loglamalı

### Gereksinim 4: Yetkili Kılavuzu İçerik Yönetimi

**Kullanıcı Hikayesi:** Bir yetkili olarak, kılavuz içeriğine kolayca erişmek istiyorum, böylece doğru kararlar verebilirim.

#### Kabul Kriterleri

1. THE Sistem SHALL Yetkili Kılavuzu içeriğini bölümlere ayrılmış şekilde sunmalı
2. WHEN bir yetkili bir bölümü seçer THEN Sistem SHALL ilgili içeriği ana alanda göstermeli
3. THE Sistem SHALL cezaları kategorilere ayırmalı (yazılı, sesli, ekstra, marked, blacklist)
4. THE Sistem SHALL prosedürleri ve komutları ayrı bölümler olarak sunmalı
5. THE Sistem SHALL örnek kayıtları referans olarak göstermeli

### Gereksinim 5: Arama Sistemi

**Kullanıcı Hikayesi:** Bir yetkili olarak, içerikte hızlıca arama yapabilmek istiyorum, böylece ihtiyacım olan bilgiye anında ulaşabilirim.

#### Kabul Kriterleri

1. WHEN bir yetkili arama çubuğuna terim girer THEN Sistem SHALL madde, ceza, komut ve ihlal bazlı sonuçları göstermeli
2. WHEN arama sonuçları döner THEN Sistem SHALL sonuçları kategori ve ilgililik sırasına göre listelemeli
3. THE Sistem SHALL "hakaret", "xp abuse", "adk", "banlanana kadar mute", "noroom", "pls" gibi yaygın terimleri tanımalı
4. WHEN arama sonucu bulunamazsa THEN Sistem SHALL "Sonuç bulunamadı" mesajı göstermeli

### Gereksinim 6: Yapay Zeka Ceza Danışmanı

**Kullanıcı Hikayesi:** Bir yetkili olarak, AI asistanından ceza önerisi almak istiyorum, böylece tutarlı ve doğru kararlar verebilirim.

#### Kabul Kriterleri

1. WHEN bir yetkili ceza sorusu sorar (örn: "adk cezası kaç gün") THEN Yapay_Zeka_Asistanı SHALL site içeriğinden doğru ceza süresini bulup yanıtlamalı
2. WHEN bir yetkili bir olayı anlatır THEN Yapay_Zeka_Asistanı SHALL ihlali analiz etmeli, uygun cezayı belirtmeli ve kopyalanabilir ceza kayıt metni oluşturmalı
3. THE Yapay_Zeka_Asistanı SHALL ceza maddesini, süreyi, gerekçeyi ve alternatif/esnetilebilir durumları belirtmeli
4. THE Yapay_Zeka_Asistanı SHALL sadece "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermeli
5. WHEN Yapay_Zeka_Asistanı bir konuda emin değilse THEN "Bu durumda üst yetkililere danışılmalıdır." yanıtını vermeli
6. THE Yapay_Zeka_Asistanı SHALL yetkili etik, prosedür ve kayıt düzeni hakkında rehberlik etmeli

### Gereksinim 7: Ceza Kaydı Oluşturma

**Kullanıcı Hikayesi:** Bir yetkili olarak, formatlanmış ceza kaydı almak istiyorum, böylece tutarlı kayıt tutabilirim.

#### Kabul Kriterleri

1. WHEN Yapay_Zeka_Asistanı ceza önerisi verir THEN Sistem SHALL kopyalanabilir formatta ceza kaydı metni oluşturmalı
2. THE Ceza_Kaydı SHALL ihlal türü, ceza süresi, madde numarası ve gerekçeyi içermeli
3. WHEN bir yetkili kopyala butonuna tıklar THEN Sistem SHALL ceza kaydını panoya kopyalamalı

### Gereksinim 8: Responsive Tasarım

**Kullanıcı Hikayesi:** Bir yetkili olarak, sistemi farklı cihazlardan kullanabilmek istiyorum, böylece her yerden erişebilirim.

#### Kabul Kriterleri

1. THE Sistem SHALL mobil, tablet ve masaüstü cihazlarda düzgün görüntülenmeli
2. THE Sistem SHALL Discord uyumlu koyu tema tasarımına sahip olmalı
3. WHEN ekran boyutu değişir THEN Sistem SHALL layout'u otomatik olarak uyarlamalı

### Gereksinim 9: Güvenlik ve Loglama

**Kullanıcı Hikayesi:** Bir sistem yöneticisi olarak, tüm aktivitelerin loglanmasını istiyorum, böylece denetim yapabilirim.

#### Kabul Kriterleri

1. THE Sistem SHALL tüm giriş işlemlerini loglamalı (kullanıcı, zaman, IP)
2. THE Sistem SHALL içerik erişimlerini loglamalı (kim neyi okudu)
3. THE Sistem SHALL yetki değişikliklerini loglamalı
4. WHEN yetkisiz erişim denemesi olur THEN Sistem SHALL bu girişimi loglamalı

### Gereksinim 10: Modüler Yapı

**Kullanıcı Hikayesi:** Bir geliştirici olarak, sistemi kolayca genişletebilmek istiyorum, böylece gelecekte yeni özellikler ekleyebilirim.

#### Kabul Kriterleri

1. THE Sistem SHALL modüler bileşen yapısında geliştirilmeli
2. THE Sistem SHALL kuralları ve cezaları yapılandırılmış veri olarak tutmalı
3. THE Sistem SHALL API tabanlı backend mimarisine sahip olmalı

### Gereksinim 11: İçerik Düzenleme Yetkisi

**Kullanıcı Hikayesi:** Bir üst yetkili olarak, site içeriğini düzenleyebilmek ve yeni içerik ekleyebilmek istiyorum, böylece kılavuzu güncel tutabilirim.

#### Kabul Kriterleri

1. WHEN bir üst yetkili (ust_yetkili) içerik sayfasına erişir THEN Sistem SHALL düzenleme butonunu göstermeli
2. WHEN bir üst yetkili düzenleme moduna geçer THEN Sistem SHALL içeriği düzenlenebilir formatta sunmalı
3. WHEN bir üst yetkili değişiklikleri kaydeder THEN Sistem SHALL içeriği güncellemeli ve log oluşturmalı
4. WHEN bir üst yetkili yeni içerik eklemek ister THEN Sistem SHALL yeni bölüm/ceza/komut ekleme formu sunmalı
5. THE Sistem SHALL mod ve admin rollerine içerik düzenleme yetkisi VERMEMELİ (sadece okuma)
6. THE Sistem SHALL tüm içerik değişikliklerini loglamalı (kim, ne zaman, ne değişti)

### Gereksinim 12: Sayfa Navigasyonu ve Geri Butonu

**Kullanıcı Hikayesi:** Bir yetkili olarak, her sayfadan kolayca ana sayfaya veya önceki sayfaya dönebilmek istiyorum, böylece navigasyon sorunsuz olur.

#### Kabul Kriterleri

1. THE Sistem SHALL her içerik sayfasında görünür bir geri butonu göstermeli
2. WHEN bir kullanıcı geri butonuna tıklar THEN Sistem SHALL kullanıcıyı önceki sayfaya veya ana sayfaya yönlendirmeli
3. THE Sistem SHALL header'da her zaman ana sayfaya dönüş linki içermeli
4. THE Sistem SHALL breadcrumb navigasyonu sunmalı (örn: Ana Sayfa > Cezalar > Yazılı Cezalar)
5. WHEN bir kullanıcı tarayıcı geri butonunu kullanır THEN Sistem SHALL doğru şekilde önceki sayfaya dönmeli
