# Discord Yetkili Kılavuzu ve Ceza Danışman Sistemi

SANIYE MODLARI Discord sunucusu için özel Yetkili Kılavuzu ve AI destekli Ceza Danışman Sistemi.

## Özellikler

- 🔐 Rol tabanlı erişim kontrolü (Mod, Admin, Üst Yetkili)
- 📚 Yetkili Kılavuzu içerik yönetimi
- ⚖️ Ceza tanımları ve kategorileri
- 🤖 AI destekli ceza danışmanı (RAG tabanlı)
- 🔍 Gelişmiş arama sistemi
- 📝 İçerik düzenleme (sadece Üst Yetkili)
- 📊 Aktivite loglama

## Teknolojiler

- Next.js 14
- TypeScript
- Prisma ORM
- Tailwind CSS
- Shadcn/ui
- OpenAI API

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

## Environment Variables

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | Veritabanı bağlantı URL'i |
| `OPENAI_API_KEY` | OpenAI API anahtarı (AI asistan için) |

## Lisans

MIT
