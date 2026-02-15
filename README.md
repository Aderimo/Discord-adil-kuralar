# Discord Yetkili Kılavuzu

SANIYE MODLARI Discord sunucusu için Yetkili Kılavuzu ve Ceza Danışman Sistemi.

## Özellikler

- 🔐 Şifre korumalı erişim
- 📚 Yetkili kılavuzu içerikleri
- ⚖️ Ceza tanımları ve kategorileri
- 🔍 İçerik arama
- 📋 Ceza şablonları (kopyala-yapıştır)
- 💻 Bot komutları referansı
- 📝 Prosedür kılavuzları

## Teknolojiler

- Next.js 14 (Static Export)
- TypeScript
- Tailwind CSS
- Shadcn/ui
- GitHub Pages

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

3. Geliştirme sunucusunu başlat:
```bash
npm run dev
```

4. Production build:
```bash
npm run build
```

Build çıktısı `out/` klasörüne oluşturulur.

## Deploy

Site otomatik olarak GitHub Pages üzerinden deploy edilir. `main` branch'e push yapıldığında GitHub Actions workflow tetiklenir.

Site adresi: https://aderimo.github.io/Discord-adil-kuralar/

## Lisans

MIT
