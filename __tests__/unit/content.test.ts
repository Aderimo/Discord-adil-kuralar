/**
 * İçerik Servisi Unit Testleri
 * Requirements: 4.1, 4.3, 4.4, 10.2
 */

import {
  loadGuideContent,
  loadPenalties,
  loadPenaltiesByCategory,
  loadCommands,
  loadProcedures,
  getContentById,
  getGuideBySlug,
  getPenaltyByCode,
  getCommandByName,
  getProcedureBySlug,
  searchContent,
  searchByCommonTerm,
  clearContentCache,
  getContentStats,
} from '@/lib/content';

describe('İçerik Servisi', () => {
  beforeEach(() => {
    // Her test öncesi cache'i temizle
    clearContentCache();
  });

  describe('loadGuideContent', () => {
    it('kılavuz içeriğini yüklemeli', () => {
      const guides = loadGuideContent();
      expect(guides).toBeDefined();
      expect(Array.isArray(guides)).toBe(true);
      expect(guides.length).toBeGreaterThan(0);
    });

    it('kılavuz içeriği doğru yapıda olmalı', () => {
      const guides = loadGuideContent();
      const guide = guides[0];

      expect(guide).toHaveProperty('id');
      expect(guide).toHaveProperty('title');
      expect(guide).toHaveProperty('slug');
      expect(guide).toHaveProperty('category');
      expect(guide).toHaveProperty('content');
      expect(guide).toHaveProperty('keywords');
      expect(guide).toHaveProperty('relatedArticles');
      expect(guide).toHaveProperty('order');
    });

    it('kılavuz içeriği sıralı olmalı', () => {
      const guides = loadGuideContent();
      for (let i = 1; i < guides.length; i++) {
        expect(guides[i]!.order).toBeGreaterThanOrEqual(guides[i - 1]!.order);
      }
    });
  });

  describe('loadPenalties', () => {
    it('cezaları yüklemeli', () => {
      const penalties = loadPenalties();
      expect(penalties).toBeDefined();
      expect(Array.isArray(penalties)).toBe(true);
      expect(penalties.length).toBeGreaterThan(0);
    });

    it('ceza tanımı doğru yapıda olmalı', () => {
      const penalties = loadPenalties();
      const penalty = penalties[0];

      expect(penalty).toHaveProperty('id');
      expect(penalty).toHaveProperty('code');
      expect(penalty).toHaveProperty('name');
      expect(penalty).toHaveProperty('category');
      expect(penalty).toHaveProperty('duration');
      expect(penalty).toHaveProperty('description');
      expect(penalty).toHaveProperty('conditions');
      expect(penalty).toHaveProperty('examples');
    });

    it('tüm ceza kategorileri mevcut olmalı', () => {
      const penalties = loadPenalties();
      const categories = new Set(penalties.map((p) => p.category));

      expect(categories.has('yazili')).toBe(true);
      expect(categories.has('sesli')).toBe(true);
      expect(categories.has('ekstra')).toBe(true);
      expect(categories.has('marked')).toBe(true);
      expect(categories.has('blacklist')).toBe(true);
    });
  });

  describe('loadPenaltiesByCategory', () => {
    it('yazılı cezaları filtrelemeli', () => {
      const yaziliPenalties = loadPenaltiesByCategory('yazili');
      expect(yaziliPenalties.length).toBeGreaterThan(0);
      yaziliPenalties.forEach((p) => {
        expect(p.category).toBe('yazili');
      });
    });

    it('sesli cezaları filtrelemeli', () => {
      const sesliPenalties = loadPenaltiesByCategory('sesli');
      expect(sesliPenalties.length).toBeGreaterThan(0);
      sesliPenalties.forEach((p) => {
        expect(p.category).toBe('sesli');
      });
    });
  });

  describe('loadCommands', () => {
    it('komutları yüklemeli', () => {
      const commands = loadCommands();
      expect(commands).toBeDefined();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('komut tanımı doğru yapıda olmalı', () => {
      const commands = loadCommands();
      const command = commands[0];

      expect(command).toHaveProperty('id');
      expect(command).toHaveProperty('command');
      expect(command).toHaveProperty('description');
      expect(command).toHaveProperty('usage');
      expect(command).toHaveProperty('permissions');
      expect(command).toHaveProperty('examples');
    });
  });

  describe('loadProcedures', () => {
    it('prosedürleri yüklemeli', () => {
      const procedures = loadProcedures();
      expect(procedures).toBeDefined();
      expect(Array.isArray(procedures)).toBe(true);
      expect(procedures.length).toBeGreaterThan(0);
    });

    it('prosedür tanımı doğru yapıda olmalı', () => {
      const procedures = loadProcedures();
      const procedure = procedures[0];

      expect(procedure).toHaveProperty('id');
      expect(procedure).toHaveProperty('title');
      expect(procedure).toHaveProperty('slug');
      expect(procedure).toHaveProperty('description');
      expect(procedure).toHaveProperty('steps');
      expect(procedure).toHaveProperty('requiredPermissions');
      expect(procedure).toHaveProperty('relatedCommands');
      expect(procedure).toHaveProperty('relatedPenalties');
    });
  });

  describe('getContentById', () => {
    it('kılavuz içeriğini ID ile bulmalı', () => {
      const content = getContentById('guide-001');
      expect(content).not.toBeNull();
      expect(content?.id).toBe('guide-001');
    });

    it('cezayı ID ile bulmalı', () => {
      const content = getContentById('penalty-001');
      expect(content).not.toBeNull();
      expect(content?.id).toBe('penalty-001');
    });

    it('komutu ID ile bulmalı', () => {
      const content = getContentById('cmd-001');
      expect(content).not.toBeNull();
      expect(content?.id).toBe('cmd-001');
    });

    it('prosedürü ID ile bulmalı', () => {
      const content = getContentById('proc-001');
      expect(content).not.toBeNull();
      expect(content?.id).toBe('proc-001');
    });

    it('olmayan ID için null döndürmeli', () => {
      const content = getContentById('non-existent-id');
      expect(content).toBeNull();
    });
  });

  describe('getGuideBySlug', () => {
    it('kılavuzu slug ile bulmalı', () => {
      const guide = getGuideBySlug('giris');
      expect(guide).not.toBeNull();
      expect(guide?.slug).toBe('giris');
    });

    it('olmayan slug için null döndürmeli', () => {
      const guide = getGuideBySlug('non-existent-slug');
      expect(guide).toBeNull();
    });
  });

  describe('getPenaltyByCode', () => {
    it('cezayı kod ile bulmalı', () => {
      const penalty = getPenaltyByCode('ADK-001');
      expect(penalty).not.toBeNull();
      expect(penalty?.code).toBe('ADK-001');
    });

    it('büyük/küçük harf duyarsız olmalı', () => {
      const penalty = getPenaltyByCode('adk-001');
      expect(penalty).not.toBeNull();
      expect(penalty?.code).toBe('ADK-001');
    });

    it('olmayan kod için null döndürmeli', () => {
      const penalty = getPenaltyByCode('XXX-999');
      expect(penalty).toBeNull();
    });
  });

  describe('getCommandByName', () => {
    it('komutu isim ile bulmalı', () => {
      const command = getCommandByName('/mute');
      expect(command).not.toBeNull();
      expect(command?.command).toBe('/mute');
    });

    it('slash olmadan da bulmalı', () => {
      const command = getCommandByName('mute');
      expect(command).not.toBeNull();
      expect(command?.command).toBe('/mute');
    });

    it('olmayan komut için null döndürmeli', () => {
      const command = getCommandByName('/nonexistent');
      expect(command).toBeNull();
    });
  });

  describe('getProcedureBySlug', () => {
    it('prosedürü slug ile bulmalı', () => {
      const procedure = getProcedureBySlug('ceza-verme');
      expect(procedure).not.toBeNull();
      expect(procedure?.slug).toBe('ceza-verme');
    });

    it('olmayan slug için null döndürmeli', () => {
      const procedure = getProcedureBySlug('non-existent-slug');
      expect(procedure).toBeNull();
    });
  });

  describe('searchContent', () => {
    it('hakaret araması sonuç döndürmeli', () => {
      const results = searchContent('hakaret');
      expect(results.length).toBeGreaterThan(0);
    });

    it('mute araması sonuç döndürmeli', () => {
      const results = searchContent('mute');
      expect(results.length).toBeGreaterThan(0);
    });

    it('sonuçlar ilgililik skoruna göre sıralı olmalı', () => {
      const results = searchContent('ceza');
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.relevanceScore).toBeLessThanOrEqual(
          results[i - 1]!.relevanceScore
        );
      }
    });

    it('boş sorgu için boş dizi döndürmeli', () => {
      const results = searchContent('');
      expect(results).toEqual([]);
    });

    it('sonuç bulunamazsa boş dizi döndürmeli', () => {
      const results = searchContent('xyznonexistentterm123');
      expect(results).toEqual([]);
    });

    it('sonuçlar doğru yapıda olmalı', () => {
      const results = searchContent('hakaret');
      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('excerpt');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('relevanceScore');
      }
    });
  });

  describe('searchByCommonTerm', () => {
    it('hakaret terimi için sonuç döndürmeli', () => {
      const results = searchByCommonTerm('hakaret');
      expect(results.length).toBeGreaterThan(0);
    });

    it('xp abuse terimi için sonuç döndürmeli', () => {
      const results = searchByCommonTerm('xp abuse');
      expect(results.length).toBeGreaterThan(0);
    });

    it('adk terimi için sonuç döndürmeli', () => {
      const results = searchByCommonTerm('adk');
      expect(results.length).toBeGreaterThan(0);
    });

    it('noroom terimi için sonuç döndürmeli', () => {
      const results = searchByCommonTerm('noroom');
      expect(results.length).toBeGreaterThan(0);
    });

    it('pls terimi için sonuç döndürmeli', () => {
      const results = searchByCommonTerm('pls');
      expect(results.length).toBeGreaterThan(0);
    });

    it('bilinmeyen terim için normal arama yapmalı', () => {
      const results = searchByCommonTerm('bilinmeyen terim');
      // Normal arama yapılmalı, hata vermemeli
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getContentStats', () => {
    it('içerik istatistiklerini döndürmeli', () => {
      const stats = getContentStats();

      expect(stats).toHaveProperty('guideCount');
      expect(stats).toHaveProperty('penaltyCount');
      expect(stats).toHaveProperty('commandCount');
      expect(stats).toHaveProperty('procedureCount');
      expect(stats).toHaveProperty('totalCount');

      expect(stats.guideCount).toBeGreaterThan(0);
      expect(stats.penaltyCount).toBeGreaterThan(0);
      expect(stats.commandCount).toBeGreaterThan(0);
      expect(stats.procedureCount).toBeGreaterThan(0);
      expect(stats.totalCount).toBe(
        stats.guideCount +
          stats.penaltyCount +
          stats.commandCount +
          stats.procedureCount
      );
    });
  });

  describe('Cache Mekanizması', () => {
    it('cache temizlendikten sonra yeniden yüklemeli', () => {
      // İlk yükleme
      const guides1 = loadGuideContent();
      expect(guides1.length).toBeGreaterThan(0);

      // Cache temizle
      clearContentCache();

      // Tekrar yükle
      const guides2 = loadGuideContent();
      expect(guides2.length).toBeGreaterThan(0);
      expect(guides2.length).toBe(guides1.length);
    });
  });
});
