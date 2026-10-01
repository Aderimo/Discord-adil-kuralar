<div align="center">

# Yetkili Kılavuzu ve Ceza Danışmanı

**Yetkili el kitabınız aranabilir olsun — adil cezalar için AI danışmanla.**

[![Lisans](https://img.shields.io/badge/lisans-MIT-4ADE80)](LICENSE)
[![Altyapı](https://img.shields.io/badge/Next.js_14_%2B_Prisma_%2B_OpenAI-6B7280)](#teknolojiler)

SANIYE MODLARI Discord sunucusu için özel Yetkili Kılavuzu ve AI destekli Ceza
Danışman Sistemi: tüm kurallar ve ceza tanımları tek yerde, rol tabanlı erişim ve
tutarlı ceza öneren RAG tabanlı asistanla.

[Türkçe](README.tr.md) · [English](README.md)

</div>

---

## Neden?

Moderasyon ekipleri zamanla dağılır: kurallar sabitlenmiş mesajlarda yaşar, ceza
hafızası insanların kafasındadır ve aynı ihlale iki yetkili iki farklı ceza verir.
Bu uygulama tüm yetkili el kitabını giriş ekranının arkasına toplar ve AI danışmanın
ceza önerirken kılavuzun gerçek içeriğinden alıntı yapmasını sağlar — böylece
kararlar tutarlı kalır.

## Özellikler

- 🔐 **Rol tabanlı erişim kontrolü** — Mod, Admin, Üst Yetkili
- 📚 **Kılavuz içerik yönetimi** — yetkili el kitabı, uygulama içinden düzenlenebilir
- ⚖️ **Ceza tanımları ve kategorileri**
- 🤖 **AI destekli ceza danışmanı** — RAG tabanlı, kılavuzun kendi içeriğine dayanarak cevap verir
- 🔍 **Gelişmiş arama** — kurallar ve cezalar arasında
- 📝 **İçerik düzenleme** — yalnızca Üst Yetkili
- 📊 **Aktivite loglama** — kim neyi değiştirdi, kim ne sordu

## Teknolojiler

| Katman | Seçim |
| --- | --- |
| Framework | Next.js 14 |
| Dil | TypeScript |
| Veritabanı | Prisma ORM |
| Arayüz | Tailwind CSS + shadcn/ui |
| AI | OpenAI API (kılavuz içeriği üzerinden RAG) |

## Kurulum

1. Repo'yu klonla:

```bash
git clone https://github.com/Aderimo/Discord-adil-kuralar.git
cd Discord-adil-kuralar
```

2. Bağımlılıkları yükle:

```bash
npm install
```

3. `.env.example` dosyasını `.env` olarak kopyala ve değerleri doldur:

```bash
cp .env.example .env
```

4. Veritabanını oluştur:

```bash
npx prisma db push
```

5. Geliştirme sunucusunu başlat:

```bash
npm run dev
```

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DATABASE_URL` | Veritabanı bağlantı URL'i |
| `OPENAI_API_KEY` | OpenAI API anahtarı (AI asistan için) |

## Lisans

[MIT](LICENSE)
