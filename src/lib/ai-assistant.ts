/**
 * AI Assistant Servisi
 * RAG tabanlı ceza danışmanlığı ve sohbet sistemi
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * - 6.1: AI ceza sorusu için site içeriğinden doğru ceza süresini bulup yanıtlamalı
 * - 6.2: Olay anlatımı için ihlali analiz etmeli, uygun cezayı belirtmeli ve kopyalanabilir ceza kayıt metni oluşturmalı
 * - 6.3: Ceza maddesini, süreyi, gerekçeyi ve alternatif/esnetilebilir durumları belirtmeli
 * - 6.4: Sadece "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermeli
 * - 6.5: Emin değilse "Bu durumda üst yetkililere danışılmalıdır." yanıtını vermeli
 */

import OpenAI from 'openai';
import {
  retrievePenaltyContext,
  retrieveContext,
  determineConfidenceLevel,
  formatSourcesForCitation,
  type RAGRetrievalResult,
  type SourceReference,
} from './rag';
import penaltyData from '../../content/penalties/index.json';
import commandData from '../../content/commands/index.json';
import guideData from '../../content/guide/index.json';

/**
 * Chat mesajı
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Ceza kaydı formatı
 */
export interface PenaltyRecord {
  /** İhlal türü */
  violation: string;
  /** Ceza süresi */
  duration: string;
  /** Madde numarası */
  article: string;
  /** Gerekçe */
  reason: string;
  /** Kopyalanabilir metin */
  copyableText: string;
}

/**
 * AI yanıt sonucu
 */
export interface AIResponse {
  /** AI yanıt metni */
  response: string;
  /** Ceza kaydı (varsa) */
  penaltyRecord?: PenaltyRecord | undefined;
  /** Kaynak referansları */
  sources: SourceReference[];
  /** Güven seviyesi */
  confidence: 'high' | 'medium' | 'low';
  /** Kullanılan context */
  contextUsed: boolean;
}

/**
 * Chat isteği
 */
export interface ChatRequest {
  /** Kullanıcı mesajı */
  message: string;
  /** Konuşma geçmişi (opsiyonel) */
  conversationHistory?: ChatMessage[];
  /** Mock mod (test için) */
  useMock?: boolean;
}

// OpenAI client - lazy initialization
let openaiClient: OpenAI | null = null;

/**
 * Mock yanıtlar - API key olmadığında veya test modunda kullanılır
 * Keyword bazlı yanıt sistemi
 * Requirements: 4.1, 4.4
 */
export const MOCK_RESPONSES: Record<string, { keywords: string[]; response: string }> = {
  hakaret: {
    keywords: ['hakaret', 'küfür', 'sövme', 'argo', 'kaba'],
    response: `**Hakaret/Küfür İhlali**

Hakaret için standart cezalar:
- **İlk ihlal:** 3 gün uyarılmış veya 3-7 gün susturulmuş
- **Tekrar:** 7-14 gün susturulmuş
- **Ağır hakaret:** 14-30 gün susturulmuş veya kalıcı ban

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: Hakaret/Küfür
Madde: 2.1
Süre: 3-7 gün susturulmuş
Gerekçe: Topluluk kurallarına aykırı davranış
━━━━━━━━━━━━━━━━━━━━

💡 Not: Hakaretin şiddeti ve tekrar durumuna göre ceza artırılabilir.`,
  },
  spam: {
    keywords: ['spam', 'flood', 'tekrar', 'mesaj', 'caps'],
    response: `**Spam/Flood İhlali**

Spam için standart cezalar:
- **Hafif spam:** 1-3 gün susturulmuş
- **Orta spam:** 4-7 gün susturulmuş
- **Ağır spam/flood:** 7-14 gün susturulmuş

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: Spam/Flood
Madde: 3.1
Süre: 4 gün susturulmuş
Gerekçe: Kanal düzenini bozucu davranış
━━━━━━━━━━━━━━━━━━━━

💡 Not: CAPS LOCK kullanımı da spam kategorisinde değerlendirilir.`,
  },
  reklam: {
    keywords: ['reklam', 'tanıtım', 'link', 'davet', 'invite'],
    response: `**Reklam İhlali**

Reklam için standart cezalar:
- **İlk ihlal:** 7-14 gün susturulmuş
- **Tekrar:** 30 gün susturulmuş
- **Ağır reklam:** Kalıcı ban

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: Reklam/Tanıtım
Madde: 4.1
Süre: 30 gün susturulmuş
Gerekçe: İzinsiz reklam/tanıtım yapma
━━━━━━━━━━━━━━━━━━━━

💡 Not: Sunucu davet linkleri paylaşmak da reklam sayılır.`,
  },
  underage: {
    keywords: ['underage', 'yaş', '13', 'küçük', 'çocuk'],
    response: `**Underage (Yaş Sınırı) İhlali**

Discord kullanım yaşı 13'tür. 13 yaşından küçük kullanıcılar için:
- **Ceza:** Kalıcı ban
- **Açılma koşulu:** 13 yaşına basınca kimlik ile başvuru

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: Underage
Madde: 1.1
Süre: Kalıcı ban
Gerekçe: Discord ToS ihlali - 13 yaş altı
━━━━━━━━━━━━━━━━━━━━

**Ban mesajı şablonu:**
"underage, discord sözleşmesi nedeniyle 13 altı kullanıcı yasak. 13 yaşına bastığında bir moda kimliğinin tarih kısmını atarak banını kaldırabilirsin."`,
  },
  calinti: {
    keywords: ['çalıntı', 'calinti', 'hack', 'hesap', 'ele geçir'],
    response: `**Çalıntı Hesap**

Çalıntı hesap tespit edildiğinde:
- **Ceza:** Kalıcı ban
- **Açılma koşulu:** Hesap geri alındığında moderatöre başvuru

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: Çalıntı Hesap
Madde: 1.2
Süre: Kalıcı ban
Gerekçe: Hesap güvenliği ihlali
━━━━━━━━━━━━━━━━━━━━

**Ban mesajı şablonu:**
"çalıntı hesap, hesabın çalındığından dolayı seni sunucudan uzaklaştırmak durumunda kaldık. eğer hesabını geri alırsan, moderatörlerimize ulaşıp banını açtırabilirsin."`,
  },
  mute: {
    keywords: ['mute', 'sustur', 'susturma', 'timeout'],
    response: `**Mute/Susturma Komutları**

Mute vermek için kullanılabilecek komutlar:
- \`s!mute id süre\` - Dyno ile mute
- \`h!timeout id süre\` - Helper ile timeout

**Süre formatları:**
- \`1h\` = 1 saat
- \`1d\` = 1 gün
- \`7d\` = 7 gün

💡 Not: Dyno bozukken Carl bot kullanılabilir.`,
  },
  ban: {
    keywords: ['ban', 'yasakla', 'banla', 'uzaklaştır'],
    response: `**Ban Komutları**

Ban vermek için (GK+ yetkisi gerekli):
- \`h!ban id sebep\` - Kullanıcıyı banlar
- \`h!unban id\` - Banı kaldırır

**Yan hesap işlemleri:**
- \`/allow id\` - Yan hesap banı açar
- \`/deny id\` - Yan hesap başvurusunu reddeder

💡 Not: Ban vermeden önce mutlaka kanıt toplayın ve log tutun.`,
  },
  komut: {
    keywords: ['komut', 'command', 'nasıl', 'kullan'],
    response: `**Sık Kullanılan Komutlar**

**Bilgi Komutları:**
- \`h!i id\` - Kullanıcı bilgisi
- \`h!n id\` - Kullanıcı notları
- \`h!s id\` - Ceza kayıtları
- \`h!joins id\` - Giriş/çıkış geçmişi

**Ceza Komutları:**
- \`s!mute id süre\` - Mute ver
- \`s!unmute id\` - Mute kaldır
- \`h!timeout id süre\` - Timeout ver

**Sesli Kanal:**
- \`h!j id\` - Kullanıcının odasına gir
- \`h!pull id\` - Kullanıcıyı odana çek

Daha fazla bilgi için /commands sayfasını ziyaret edin.`,
  },
};

// ── Tip tanımları (json import için) ──────────────────────────────────────────

interface PenaltyItem {
  id: string;
  code: string;
  name: string;
  category: string;
  duration: string;
  description: string;
  conditions?: string[];
  alternatives?: string[];
  examples?: string[];
  keywords?: string[];
}

interface CommandItem {
  id: string;
  command: string;
  description?: string;
  usage?: string;
  category?: string;
  requiredRole?: string;
  examples?: string[];
  keywords?: string[];
}

interface GuideItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  keywords?: string[];
}

// ── İçerik arama yardımcı fonksiyonları ───────────────────────────────────────

function searchPenalties(query: string): PenaltyItem | null {
  const q = query.toLowerCase();
  const items = (penaltyData as { items: PenaltyItem[] }).items;
  return items.find(p =>
    p.name.toLowerCase().includes(q) ||
    (p.keywords ?? []).some(k => q.includes(k) || k.includes(q)) ||
    p.description.toLowerCase().includes(q) ||
    q.includes(p.name.toLowerCase())
  ) ?? null;
}

function searchCommands(query: string): CommandItem[] {
  const q = query.toLowerCase();
  const items = (commandData as { items: CommandItem[] }).items;
  return items.filter(c =>
    c.command.toLowerCase().includes(q) ||
    (c.description ?? '').toLowerCase().includes(q) ||
    (c.keywords ?? []).some(k => q.includes(k) || k.includes(q))
  ).slice(0, 5);
}

function searchGuide(query: string): GuideItem | null {
  const q = query.toLowerCase();
  const items = (guideData as { items: GuideItem[] }).items;
  return items.find(g =>
    g.title.toLowerCase().includes(q) ||
    (g.keywords ?? []).some(k => q.includes(k) || k.includes(q)) ||
    g.content.toLowerCase().includes(q.split(' ')[0] ?? q)
  ) ?? null;
}

function formatPenaltyResponse(p: PenaltyItem): string {
  let text = `**${p.name}** (${p.code})\n\n`;
  text += `📌 **Süre:** ${p.duration}\n`;
  text += `📋 **Açıklama:** ${p.description}\n\n`;
  if (p.conditions && p.conditions.length > 0) {
    text += `**Uygulanma Koşulları:**\n`;
    p.conditions.forEach(c => { text += `- ${c}\n`; });
    text += '\n';
  }
  if (p.alternatives && p.alternatives.length > 0) {
    text += `**Alternatifler:**\n`;
    p.alternatives.forEach(a => { text += `- ${a}\n`; });
    text += '\n';
  }
  text += `\n📋 CEZA KAYDI\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `İhlal: ${p.name}\n`;
  text += `Madde: ${p.code}\n`;
  text += `Süre: ${p.duration}\n`;
  text += `Gerekçe: ${p.description.split('.')[0]}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━`;
  return text;
}

// ── SSS (Sık Sorulan Sorular) ──────────────────────────────────────────────────

const FAQ: { keywords: string[]; answer: string | (() => string) }[] = [
  {
    keywords: ['merhaba', 'selam', 'hey', 'iyi günler', 'naber'],
    answer: `Merhaba! Ben SANIYE MODLARI Yetkili Kılavuzu AI Danışmanıyım.\n\nSana şu konularda yardımcı olabilirim:\n- 🔨 **Ceza soruları** ("hakaret cezası nedir?")\n- 💻 **Komut kullanımı** ("mute nasıl verilir?")\n- 📖 **Kılavuz içeriği** ("ceza prosedürü nedir?")\n- 📋 **Şablon ve kayıt formatları**\n\nNe sormak istersiniz?`,
  },
  {
    keywords: ['kaç üye', 'üye sayısı', 'kaç kişi', 'toplam üye'],
    answer: `Bu soruyu yanıtlayabilmem için sunucuya direkt erişimim gerekiyor. Güncel üye sayısı için Discord sunucusuna bakabilirsin.\n\n💡 Moderatör panelindeki istatistikleri kontrol etmeyi dene.`,
  },
  {
    keywords: ['nasıl çalış', 'ne yapabil', 'ne biliyorsun', 'yardım', 'help'],
    answer: `**Yetkili Kılavuzu AI Danışmanı**\n\nBen site içeriğine dayalı çalışan ücretsiz bir asistanım. Şunları yapabilirim:\n\n✅ **Yapabileceklerim:**\n- Ceza türlerini ve sürelerini açıklamak\n- Bot komutlarını göstermek\n- Kılavuz içeriğini özetlemek\n- Ceza kaydı formatı oluşturmak\n\n❌ **Yapamayacaklarım:**\n- Sunucu istatistiklerine erişmek\n- Gerçek zamanlı bilgi vermek\n- Kılavuzda olmayan konularda fikir beyan etmek\n\n💡 Bir konu hakkında sormak için direkt soru yaz: *"hakaret cezası nedir"*, *"ban komutu nasıl kullanılır"* gibi.`,
  },
  {
    keywords: ['teşekkür', 'sağol', 'eyw', 'tamam', 'anladım'],
    answer: `Rica ederim! Başka bir konuda yardıma ihtiyacın olursa buradayım. 👋`,
  },
  {
    keywords: ['ceza listesi', 'tüm cezalar', 'ceza türleri', 'ceza çeşit'],
    answer: () => {
      const items = (penaltyData as { items: PenaltyItem[] }).items;
      let text = `**Tüm Ceza Türleri** (${items.length} adet)\n\n`;
      const byCategory: Record<string, PenaltyItem[]> = {};
      items.forEach(p => {
        if (!byCategory[p.category]) byCategory[p.category] = [] as PenaltyItem[];
        (byCategory[p.category] as PenaltyItem[]).push(p);
      });
      const catLabels: Record<string, string> = { yazili: '📝 Yazılı', sesli: '🔊 Sesli', ekstra: '➕ Ekstra', marked: '🚩 Marked', blacklist: '💀 Blacklist' };
      Object.entries(byCategory).forEach(([cat, ps]) => {
        text += `**${catLabels[cat] ?? cat}:**\n`;
        ps.forEach(p => { text += `- ${p.name} (${p.code}) — ${p.duration}\n`; });
        text += '\n';
      });
      return text;
    },
  },
  {
    keywords: ['komut listesi', 'tüm komutlar', 'komutlar neler'],
    answer: () => {
      const items = (commandData as { items: CommandItem[] }).items;
      let text = `**Bot Komutları** (${items.length} adet)\n\n`;
      const byCategory: Record<string, CommandItem[]> = {};
      items.forEach(c => {
        const cat = c.category ?? 'diger';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(c);
      });
      Object.entries(byCategory).forEach(([cat, cmds]) => {
        text += `**${cat.charAt(0).toUpperCase() + cat.slice(1)}:**\n`;
        cmds.slice(0, 5).forEach(c => { text += `- \`${c.command}\` — ${c.description ?? ''}\n`; });
        if (cmds.length > 5) text += `- ... ve ${cmds.length - 5} daha\n`;
        text += '\n';
      });
      text += `Detaylı bilgi için /commands sayfasını ziyaret edin.`;
      return text;
    },
  },
  // ── İstatistik soruları ──
  {
    keywords: ['kaç ceza var', 'kaç çeşit ceza', 'ceza sayısı', 'toplam ceza'],
    answer: () => {
      const items = (penaltyData as { items: PenaltyItem[] }).items;
      const byCategory: Record<string, number> = {};
      items.forEach(p => { byCategory[p.category] = (byCategory[p.category] || 0) + 1; });
      const catLabels: Record<string, string> = { yazili: 'Yazılı', sesli: 'Sesli', ekstra: 'Ekstra', marked: 'Marked', blacklist: 'Blacklist' };
      let text = `**Ceza İstatistikleri**\n\nSistemde toplam **${items.length}** farklı ceza türü bulunuyor.\n\n**Kategorilere göre:**\n`;
      Object.entries(byCategory).forEach(([cat, count]) => {
        text += `- ${catLabels[cat] ?? cat}: ${count} adet\n`;
      });
      text += `\n**En sık uygulanan kategoriler:** Yazılı ve Sesli ihlaller\n💡 Detaylı liste için "ceza listesi" yazabilirsin.`;
      return text;
    },
  },
  {
    keywords: ['en ağır ceza', 'en büyük ceza', 'maksimum ceza', 'kalıcı ban'],
    answer: () => {
      const items = (penaltyData as { items: PenaltyItem[] }).items;
      const kalici = items.filter(p => p.duration.toLowerCase().includes('kalıcı') || p.duration.toLowerCase().includes('ban'));
      let text = `**En Ağır Cezalar**\n\nSunucuda kalıcı ceza gerektiren durumlar:\n\n`;
      kalici.slice(0, 6).forEach(p => {
        text += `🚫 **${p.name}** (${p.code})\n   Süre: ${p.duration}\n\n`;
      });
      text += `Bu cezalar blacklist kategorisinde yer alır ve üst yetkili onayı gerektirebilir.`;
      return text;
    },
  },
  {
    keywords: ['en hafif ceza', 'minimum ceza', 'en az ceza', 'uyarı cezası'],
    answer: () => {
      const items = (penaltyData as { items: PenaltyItem[] }).items;
      const hafif = items.filter(p => p.duration.includes('1 gün') || p.duration.includes('uyarı') || p.duration.includes('1d'));
      let text = `**En Hafif Cezalar**\n\nSunucuda en kısa süreli cezalar:\n\n`;
      (hafif.length > 0 ? hafif : items.slice(0, 4)).slice(0, 5).forEach(p => {
        text += `✅ **${p.name}** (${p.code}) — ${p.duration}\n`;
      });
      text += `\n💡 İlk ihlallerde genellikle bu cezalar uygulanır.`;
      return text;
    },
  },
  {
    keywords: ['prosedür listesi', 'tüm prosedürler', 'prosedürler neler', 'prosedür nedir'],
    answer: () => {
      const procs = (guideData as { items: GuideItem[] }).items;
      let text = `**Prosedür Listesi**\n\n`;
      procs.slice(0, 8).forEach((p, i) => {
        text += `${i + 1}. **${p.title}**\n`;
      });
      text += `\nDetaylar için /procedures sayfasını ziyaret edin.`;
      return text;
    },
  },
  {
    keywords: ['marked nedir', 'marked sistemi', 'marked ne zaman', 'marked nasıl'],
    answer: `**Marked Sistemi**\n\nMarked; sunucuda belirli sayıda ceza alan kullanıcılara verilen özel bir izleme statüsüdür.\n\n**Marked Alma Şartları:**\n- 30 gün içinde 3 ceza alan üye\n- Toplamda 6 ceza alan üye\n\n**Marked Kullanıcı Politikası:**\n- Tolerans düşüktür\n- Yeni ihlallerde ceza süreleri artırılabilir\n- Sürekli izleme altındadır\n\n**Marked Ekleme Komutu:**\n\`s!role5ever [id] marked\`\n\n**Gerekli Yetki:** Admin+`,
  },
  {
    keywords: ['blacklist nedir', 'blacklist sebepleri', 'blacklist ne zaman'],
    answer: `**Blacklist Nedir?**\n\nBlacklist; sunucuda kalıcı/uzun süreli yasaklama gerektiren ağır ihlaller için uygulanan en yüksek ceza kategorisidir.\n\n**Blacklist Sebepleri:**\n1. 🕌 **Dini Küfür** — Dini değerlere hakaret\n2. 🔞 **NSFW** — Yetişkin içerik paylaşımı\n3. 🏴 **Atatürk'e Hakaret** — Atatürk'e hakaret içerikli paylaşım\n4. 👶 **Pedofili** — Pedofili içerik veya davranış\n\n**Prosedür:**\n- Acil mute: \`s!mute [id] 999d\`\n- Üst yetkililere bildir\n- Kanıt topla ve God-Evrak'a kaydet\n- Üst yetkili onayıyla ban uygula\n\n⚠️ Blacklist vakalarında mutlaka üst yetkililere danışın.`,
  },
  {
    keywords: ['god evrak', 'god-evrak', 'kayıt kanalı', 'kayıt nereye'],
    answer: `**God-Evrak Kanalı**\n\nGod-Evrak, tüm ceza kayıtlarının ve kanıtların tutulduğu resmi kayıt kanalıdır.\n\n**Kayıt Formatı:**\n\`\`\`\n@Yetkili [ID] [ihlal] [süre] [rol] [God-Evrak (Kanıt)]\n\`\`\`\n\n**Örnek Kayıtlar:**\n- \`@Menos 1208226241002606644 hakaret 3 gün uyarılmış [God-Evrak (Kanıt)]\`\n- \`@Menos 1208226241002606644 vc troll 3 gün susturulmuş [God-Evrak (Kanıt)]\`\n\n**Önemli Notlar:**\n- Kayıtlar kısa ve net olmalı\n- Kanıt mutlaka eklenmelidir\n- Yanlış kayıtlar silinmemeli, üstü çizilmeli`,
  },
  {
    keywords: ['kkk nedir', 'kayıt kontrol', 'kayıt kontrolü', 'kkk'],
    answer: `**K.K.K — Kayıt Kontrol Kılavuzu**\n\nTüm ceza kayıtları oluşturulduktan sonra başka bir yetkili tarafından kontrol edilmelidir.\n\n**Süreç:**\n1. Kayıt oluşturulur\n2. Başka bir yetkili kontrol eder\n3. Hatalar nazikçe bildirilir\n4. Kayıt sahibi güncelleme yapar ve teşekkür eder\n\n**Hata Bildirme:**\n- Hatalı kayıt tespit edilirse mesaj linki alınır\n- Mod-chat'te nazikçe bildirilir\n\n**Kayıt Düzeltme:**\n- Yanlış kayıtlar silinmemeli\n- Üzerine çizgi çekilip yenisi eklenmelidir`,
  },
  {
    keywords: ['kaç prosedür', 'prosedür sayısı', 'kaç adım', 'istatistik'],
    answer: () => {
      const penalties = (penaltyData as { items: PenaltyItem[] }).items;
      const commands = (commandData as { items: CommandItem[] }).items;
      const guides = (guideData as { items: GuideItem[] }).items;
      return `**Site İstatistikleri**\n\n📊 Sistemde kayıtlı içerikler:\n\n- 🔨 **Ceza türleri:** ${penalties.length} adet\n- 💻 **Bot komutları:** ${commands.length} adet\n- 📖 **Kılavuz makaleleri:** ${guides.length} adet\n\n**Ceza kategorileri:**\n- Yazılı ihlaller\n- Sesli ihlaller\n- Ekstra cezalar\n- Marked sistemi\n- Blacklist vakaları\n\n💡 Herhangi bir konuda detaylı bilgi almak için soru sorabilirsin!`;
    },
  },
  {
    keywords: ['xp abuse', 'xp', 'ses xp', 'afk'],
    answer: `**XP Abuse İhlali**\n\nSesli kanallarda XP kazanmak için yapay şekilde bağlı kalmak (AFK, bot, müzik botu vs.) XP abuse sayılır.\n\n📋 CEZA KAYDI\n━━━━━━━━━━━━━━━━━━━━\nİhlal: XP Abuse\nMadde: Sesli-XP\nSüre: 1 gün uyarılmış + 2 gün noroompls\nGerekçe: Sesli kanalda XP istismarı\n━━━━━━━━━━━━━━━━━━━━\n\n**Komut:** \`s!temprole add [id] 1d uyarılmış\``,
  },
  {
    keywords: ['noroompls', 'no room', 'oda yasağı', 'oda ban'],
    answer: `**Noroompls Cezası**\n\nNoroompls; kullanıcının sesli kanallara katılmasını engelleyen bir cezadır.\n\n**Ne Zaman Verilir:**\n- XP abuse durumlarında ek ceza olarak\n- Sesli kanal ihlallerinin tekrarında\n\n**Komut:**\n\`s!temprole add [id] [süre] noroompls\`\n\n**Örnek:**\n\`s!temprole add 1208226241002606644 2d noroompls\``,
  },
  {
    keywords: ['pull', 'çek', 'kullanıcıyı çek', 'odaya çek'],
    answer: `**Pull Komutu**\n\n\`h!pull [id]\` — Kullanıcıyı kendi sesli kanalına çeker.\n\n**Ne Zaman Kullanılır:**\n- Kanıt olmayan durumlarda sorgu yapmak için\n- Kullanıcıyı uyarmak veya bilgilendirmek için\n\n**Dikkat:** Pull komutu sadece kullanıcı sesli kanalda iken çalışır.\n\n**Alternatif:**\n\`h!j [id]\` — Sen kullanıcının sesli kanalına katılırsın.`,
  },
  {
    keywords: ['eyp', 'neredesin', 'iyi misin', 'nasılsın'],
    answer: `İyiyim, teşekkürler! Ben bir AI danışmanım, her zaman buradayım 😊\n\nSana ceza, komut veya kılavuz konularında yardımcı olabilirim. Bir soru sormak ister misin?`,
  },
  {
    keywords: ['güzel', 'harika', 'süper', 'mükemmel', 'bravo'],
    answer: `Teşekkürler! 😊 Başka bir konuda yardıma ihtiyacın olursa buradayım.`,
  },
];

/**
 * İçerik tabanlı gelişmiş mock yanıt oluşturur — ücretsiz, API gerektirmez
 * Requirements: 4.3, 4.4
 */
export function generateEnhancedMockResponse(message: string): string {
  const q = message.toLowerCase().trim();

  // 1. SSS kontrolü
  for (const faq of FAQ) {
    if (faq.keywords.some(k => q.includes(k))) {
      return typeof faq.answer === 'function' ? faq.answer() : faq.answer;
    }
  }

  // 2. Eski mock yanıtları (keyword tabanlı)
  for (const [, config] of Object.entries(MOCK_RESPONSES)) {
    for (const keyword of config.keywords) {
      if (q.includes(keyword)) {
        return config.response;
      }
    }
  }

  // 3. Gerçek ceza verisi araması
  const penalty = searchPenalties(q);
  if (penalty) {
    return formatPenaltyResponse(penalty);
  }

  // 4. Komut araması
  const commands = searchCommands(q);
  if (commands.length > 0) {
    let text = `**Komut Sonuçları**\n\n`;
    commands.forEach(c => {
      text += `### \`${c.command}\`\n`;
      if (c.description) text += `${c.description}\n`;
      if (c.usage) text += `**Kullanım:** \`${c.usage}\`\n`;
      if (c.requiredRole) text += `**Gerekli Yetki:** ${c.requiredRole}\n`;
      if (c.examples && c.examples.length > 0) {
        text += `**Örnek:** \`${c.examples[0]}\`\n`;
      }
      text += '\n';
    });
    return text.trim();
  }

  // 5. Kılavuz araması
  const guide = searchGuide(q);
  if (guide) {
    const snippet = guide.content.replace(/#{1,6} /g, '').substring(0, 400);
    return `**${guide.title}**\n\n${snippet}...\n\nDaha fazlası için: /guide/${guide.slug}`;
  }

  // 6. Hiçbir şey bulunamadı
  const allPenalties = (penaltyData as { items: PenaltyItem[] }).items;
  const allCommands = (commandData as { items: CommandItem[] }).items;
  return `Bu konuda yeterli bilgi bulunamadı. Bu durumda üst yetkililere danışılmalıdır.\n\n**Yardımcı olabileceğim konular:**\n- 🔨 Cezalar: ${allPenalties.slice(0, 5).map(p => p.name).join(', ')} ...\n- 💻 Komutlar: ${allCommands.slice(0, 4).map(c => c.command).join(', ')} ...\n- 📖 Kılavuz bölümleri, işleyiş kuralları, prosedürler\n\n💡 Daha net bir soru sorabilir veya üst yetkililere danışabilirsiniz.`;
}

/**
 * OpenAI client'ı döndürür (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. ' +
          'Please add it to your .env file.'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Sistem prompt'u - AI'ın davranışını tanımlar
 */
const SYSTEM_PROMPT = `Sen "SANIYE MODLARI" Discord sunucusu için bir Yetkili Kılavuzu ve Ceza Danışmanısın.

## Görevin
- Yetkililere ceza verme, kayıt tutma ve karar alma konularında yardımcı olmak
- Sadece sana verilen "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermek
- Tutarlı ve doğru ceza önerileri sunmak

## Kurallar
1. SADECE sana verilen context (bağlam) bilgisine dayanarak yanıt ver
2. Context'te bulunmayan bilgiler hakkında tahmin yapma
3. Emin olmadığın durumlarda "Bu durumda üst yetkililere danışılmalıdır." de
4. Ceza önerirken mutlaka madde numarası, süre ve gerekçe belirt
5. Mümkünse alternatif cezaları veya esnetilebilir durumları da belirt
6. Türkçe yanıt ver

## Ceza Kaydı Formatı
Ceza önerdiğinde, aşağıdaki formatta kopyalanabilir kayıt metni oluştur:
\`\`\`
📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: [İhlal türü]
Madde: [Madde numarası]
Süre: [Ceza süresi]
Gerekçe: [Kısa gerekçe]
━━━━━━━━━━━━━━━━━━━━
\`\`\`

## Yanıt Stili
- Profesyonel ve net ol
- Gereksiz uzatma, özlü yanıtlar ver
- Emoji kullanabilirsin ama abartma
- Kaynak referanslarını belirt`;

/**
 * Context ile zenginleştirilmiş sistem prompt'u oluşturur
 */
function buildSystemPromptWithContext(context: string): string {
  if (!context || context.trim().length === 0) {
    return `${SYSTEM_PROMPT}

## Bağlam Bilgisi
⚠️ Bu soru için ilgili içerik bulunamadı. Lütfen kullanıcıya üst yetkililere danışmasını öner.`;
  }

  return `${SYSTEM_PROMPT}

## Bağlam Bilgisi (Yetkili Kılavuzu v2'den)
${context}`;
}

/**
 * Mesajın ceza ile ilgili olup olmadığını kontrol eder
 */
function isPenaltyRelatedQuery(message: string): boolean {
  const penaltyKeywords = [
    'ceza',
    'mute',
    'ban',
    'kick',
    'warn',
    'uyarı',
    'ihlal',
    'kural',
    'yasak',
    'adk',
    'hakaret',
    'spam',
    'reklam',
    'küfür',
    'flood',
    'caps',
    'mention',
    'süre',
    'gün',
    'saat',
    'kalıcı',
    'blacklist',
    'marked',
  ];

  const lowerMessage = message.toLowerCase();
  return penaltyKeywords.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * AI yanıtından ceza kaydı çıkarmaya çalışır
 */
function extractPenaltyRecord(response: string): PenaltyRecord | undefined {
  // Ceza kaydı formatını ara
  const recordMatch = response.match(
    /📋 CEZA KAYDI[\s\S]*?İhlal:\s*(.+?)[\n\r][\s\S]*?Madde:\s*(.+?)[\n\r][\s\S]*?Süre:\s*(.+?)[\n\r][\s\S]*?Gerekçe:\s*(.+?)[\n\r]/
  );

  if (recordMatch) {
    const [, violation, article, duration, reason] = recordMatch;
    
    // Kopyalanabilir metin oluştur
    const copyableText = `📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: ${violation?.trim() || ''}
Madde: ${article?.trim() || ''}
Süre: ${duration?.trim() || ''}
Gerekçe: ${reason?.trim() || ''}
━━━━━━━━━━━━━━━━━━━━`;

    return {
      violation: violation?.trim() || '',
      article: article?.trim() || '',
      duration: duration?.trim() || '',
      reason: reason?.trim() || '',
      copyableText,
    };
  }

  return undefined;
}

/**
 * Güven skorunu hesaplar
 * RAG sonuçlarının relevance skoruna ve chunk sayısına göre
 */
export function calculateConfidenceScore(ragResult: RAGRetrievalResult): number {
  // Hiç sonuç yoksa 0
  if (ragResult.chunks.length === 0) {
    return 0;
  }

  // Ortalama relevance skoru
  const avgRelevance = ragResult.averageRelevance;

  // Chunk sayısı faktörü (daha fazla ilgili chunk = daha yüksek güven)
  const chunkFactor = Math.min(ragResult.chunks.length / 5, 1);

  // En yüksek relevance skoru
  const maxRelevance = Math.max(...ragResult.chunks.map((c) => c.relevanceScore));

  // Ağırlıklı ortalama
  const score = avgRelevance * 0.5 + maxRelevance * 0.3 + chunkFactor * 0.2;

  return Math.min(Math.max(score, 0), 1);
}

/**
 * Güven skorundan güven seviyesi belirler
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) {
    return 'high';
  }
  if (score >= 0.4) {
    return 'medium';
  }
  return 'low';
}

/**
 * Mock AI yanıtı oluşturur (API key yokken veya test için)
 * Requirements: 4.1, 4.4
 */
async function generateMockResponse(
  message: string,
  ragResult: RAGRetrievalResult
): Promise<string> {
  // Önce keyword bazlı gelişmiş mock yanıtı dene
  const enhancedResponse = generateEnhancedMockResponse(message);
  
  // Eğer varsayılan yanıt değilse (keyword eşleşti), onu kullan
  if (!enhancedResponse.includes('Bu konuda yeterli bilgi bulunamadı.')) {
    return enhancedResponse;
  }
  
  // RAG sonuçlarını kontrol et
  const confidence = determineConfidenceLevel(ragResult);

  if (confidence === 'low' || ragResult.chunks.length === 0) {
    // Keyword eşleşmedi ve RAG sonucu da yok - varsayılan yanıt
    return enhancedResponse;
  }

  // Context'ten basit bir yanıt oluştur
  const firstChunk = ragResult.chunks[0];
  if (firstChunk) {
    if (isPenaltyRelatedQuery(message)) {
      return `**${firstChunk.title}** hakkında bilgi:

${firstChunk.content}

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: ${firstChunk.title}
Madde: ${firstChunk.sourceId}
Süre: Kılavuza göre belirlenir
Gerekçe: Kılavuz kurallarına aykırı davranış
━━━━━━━━━━━━━━━━━━━━

💡 Detaylı bilgi için ilgili kılavuz bölümüne bakabilirsiniz.`;
    }

    return `**${firstChunk.title}** hakkında bilgi:\n\n${firstChunk.content}\n\n💡 Daha fazla bilgi için kılavuzu inceleyebilirsiniz.`;
  }

  return enhancedResponse;
}

/**
 * OpenAI ile AI yanıtı oluşturur
 */
async function generateOpenAIResponse(
  message: string,
  context: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const client = getOpenAIClient();

  // Mesaj geçmişini hazırla
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPromptWithContext(context),
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user',
      content: message,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Ekonomik ve hızlı model
      messages,
      temperature: 0.3, // Düşük temperature = daha tutarlı yanıtlar
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'Yanıt oluşturulamadı.';
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API error:', error.message);
      throw new Error(`AI servisi hatası: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Ana chat fonksiyonu
 * Kullanıcı mesajını alır, RAG ile context oluşturur ve AI yanıtı döndürür
 */
export async function chat(request: ChatRequest): Promise<AIResponse> {
  const { message, conversationHistory = [], useMock = false } = request;

  // Boş mesaj kontrolü
  if (!message || message.trim().length === 0) {
    return {
      response: 'Lütfen bir soru veya mesaj girin.',
      sources: [],
      confidence: 'low',
      contextUsed: false,
    };
  }

  // RAG ile ilgili içeriği getir
  let ragResult: RAGRetrievalResult;

  if (isPenaltyRelatedQuery(message)) {
    // Ceza ile ilgili sorgular için özelleştirilmiş retrieval
    ragResult = await retrievePenaltyContext(message, {
      useMockEmbedding: useMock,
    });
  } else {
    // Genel sorgular için standart retrieval
    ragResult = await retrieveContext(message, {
      useMockEmbedding: useMock,
    });
  }

  // ── Mock mod: RAG güven kontrolünü atla, direkt keyword/içerik tabanlı yanıt ──
  if (useMock) {
    const mockResponse = generateEnhancedMockResponse(message);
    const penaltyRecord = extractPenaltyRecord(mockResponse);
    const isNoAnswer = mockResponse.includes('Bu konuda yeterli bilgi bulunamadı');

    // Keyword eşleşmesi varsa ilgili kaynak referansları oluştur
    const mockSources: SourceReference[] = [];
    if (!isNoAnswer) {
      const q = message.toLowerCase();
      const allPenalties = (penaltyData as { items: Array<{ id: string; code: string; name: string; category: string }> }).items;
      const matched = allPenalties.filter(
        (p) => q.includes(p.name.toLowerCase()) || q.includes(p.code.toLowerCase())
      ).slice(0, 3);
      matched.forEach((p) => {
        mockSources.push({ id: p.id, title: `${p.code} - ${p.name}`, type: 'penalty', category: p.category, relevanceScore: 0.9 });
      });
      // Genel eşleşme varsa kılavuzdan kaynak ekle
      if (mockSources.length === 0) {
        const guideItems = (guideData as { items: Array<{ id: string; title: string; category: string }> }).items;
        if (guideItems.length > 0) {
          const g = guideItems[0];
          if (g) {
            mockSources.push({ id: g.id, title: g.title, type: 'guide', category: g.category, relevanceScore: 0.8 });
          }
        }
      }
    }

    return {
      response: mockResponse,
      penaltyRecord,
      sources: mockSources,
      confidence: isNoAnswer ? 'low' : 'high',
      contextUsed: !isNoAnswer,
    };
  }

  // Güven skorunu hesapla
  const confidenceScore = calculateConfidenceScore(ragResult);
  const confidence = getConfidenceLevel(confidenceScore);

  // Context yoksa veya düşük güven varsa uyarı ver
  if (ragResult.chunks.length === 0 || confidence === 'low') {
    const lowConfidenceResponse =
      'Bu konuda yeterli bilgi bulunamadı. Bu durumda üst yetkililere danışılmalıdır.';

    return {
      response: lowConfidenceResponse,
      sources: ragResult.sources,
      confidence: 'low',
      contextUsed: false,
    };
  }

  // AI yanıtı oluştur
  let response: string;

  if (!process.env.OPENAI_API_KEY) {
    // API key yoksa
    response = await generateMockResponse(message, ragResult);
  } else {
    // Gerçek OpenAI yanıtı
    response = await generateOpenAIResponse(
      message,
      ragResult.context,
      conversationHistory
    );
  }

  // Kaynak referanslarını ekle
  const sourceCitation = formatSourcesForCitation(ragResult.sources);
  const fullResponse = response + sourceCitation;

  // Ceza kaydı çıkar (varsa)
  const penaltyRecord = extractPenaltyRecord(response);

  return {
    response: fullResponse,
    penaltyRecord,
    sources: ragResult.sources,
    confidence,
    contextUsed: true,
  };
}

/**
 * Ceza kaydı parametreleri
 */
export interface CreatePenaltyRecordParams {
  /** İhlal türü (zorunlu) */
  violation: string;
  /** Madde numarası (zorunlu) */
  article: string;
  /** Ceza süresi (zorunlu) */
  duration: string;
  /** Gerekçe (zorunlu) */
  reason: string;
  /** Ek notlar (opsiyonel) */
  notes?: string;
  /** Tarih (opsiyonel, varsayılan: şu anki tarih) */
  date?: Date;
}

/**
 * Tarihi Türkçe formatında döndürür
 */
function formatDateTurkish(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Ceza kaydı oluşturur
 * Verilen parametrelerle formatlanmış ceza kaydı metni döndürür
 * 
 * Requirements: 7.1, 7.2
 * - 7.1: Kopyalanabilir formatta ceza kaydı metni oluşturmalı
 * - 7.2: İhlal türü, ceza süresi, madde numarası ve gerekçeyi içermeli
 * 
 * @param params - Ceza kaydı parametreleri
 * @returns PenaltyRecord - Formatlanmış ceza kaydı
 * @throws Error - Zorunlu alanlar eksikse
 */
export function createPenaltyRecord(params: CreatePenaltyRecordParams): PenaltyRecord {
  const { violation, article, duration, reason, notes, date } = params;

  // Zorunlu alan validasyonu
  if (!violation || violation.trim().length === 0) {
    throw new Error('İhlal türü zorunludur');
  }
  if (!article || article.trim().length === 0) {
    throw new Error('Madde numarası zorunludur');
  }
  if (!duration || duration.trim().length === 0) {
    throw new Error('Ceza süresi zorunludur');
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('Gerekçe zorunludur');
  }

  // Değerleri temizle
  const cleanViolation = violation.trim();
  const cleanArticle = article.trim();
  const cleanDuration = duration.trim();
  const cleanReason = reason.trim();
  const cleanNotes = notes?.trim();

  // Tarih formatla
  const recordDate = date || new Date();
  const formattedDate = formatDateTurkish(recordDate);

  // Discord için kopyalanabilir format oluştur
  // Bu format Discord'da düzgün görünecek şekilde tasarlandı
  let copyableText = `📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
📅 Tarih: ${formattedDate}
⚠️ İhlal: ${cleanViolation}
📖 Madde: ${cleanArticle}
⏱️ Süre: ${cleanDuration}
📝 Gerekçe: ${cleanReason}`;

  // Ek notlar varsa ekle
  if (cleanNotes && cleanNotes.length > 0) {
    copyableText += `\n💡 Not: ${cleanNotes}`;
  }

  copyableText += `\n━━━━━━━━━━━━━━━━━━━━`;

  return {
    violation: cleanViolation,
    article: cleanArticle,
    duration: cleanDuration,
    reason: cleanReason,
    copyableText,
  };
}

/**
 * Basit ceza kaydı oluşturur (tarih ve notlar olmadan)
 * Hızlı kullanım için kısa format
 */
export function createSimplePenaltyRecord(
  violation: string,
  article: string,
  duration: string,
  reason: string
): PenaltyRecord {
  return createPenaltyRecord({ violation, article, duration, reason });
}

/**
 * AI servisinin hazır olup olmadığını kontrol eder
 */
export function isAIServiceAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
