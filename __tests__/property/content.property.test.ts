/**
 * Content Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 5: İçerik Erişimi Tutarlılığı
 *
 * Bu test dosyası, içerik erişiminin tutarlılığını doğrular:
 * - Bir kullanıcı bir bölümü seçtiğinde, sistem ilgili içeriği göstermeli
 * - ID ile alınan içerik, slug ile alınan içerikle eşleşmeli
 * - Tüm içerik öğeleri gerekli alanlara sahip olmalı (id, title, content)
 * - İçerik yükleme birden fazla çağrıda tutarlı olmalı
 *
 * **Validates: Requirements 4.2**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import {
  loadGuideContent,
  loadPenalties,
  loadCommands,
  loadProcedures,
  getContentById,
  getGuideBySlug,
  getPenaltyByCode,
  getCommandByName,
  getProcedureBySlug,
  clearContentCache,
  getContentStats,
} from '@/lib/content';
import type {
  GuideContent,
  PenaltyDefinition,
  CommandDefinition,
  ProcedureDefinition,
} from '@/types/content';

// Her test öncesi cache'i temizle
beforeEach(() => {
  clearContentCache();
});

describe('Property Tests: Content - İçerik Erişimi Tutarlılığı', () => {
  /**
   * Property 5a: Tüm kılavuz içerikleri gerekli alanlara sahip olmalı
   *
   * *Herhangi bir* kılavuz içeriği için, id, title ve content alanları
   * tanımlı ve geçerli olmalıdır.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5a: Tüm kılavuz içerikleri gerekli alanlara sahip olmalı (id, title, content)',
    async () => {
      const guides = loadGuideContent();

      // Her kılavuz için property kontrolü
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, guides.length - 1) }),
          (index) => {
            if (guides.length === 0) return true;

            const guide = guides[index];
            if (!guide) return true;

            // Property 1: id alanı tanımlı ve boş olmayan string olmalı
            expect(guide.id).toBeDefined();
            expect(typeof guide.id).toBe('string');
            expect(guide.id.length).toBeGreaterThan(0);

            // Property 2: title alanı tanımlı ve boş olmayan string olmalı
            expect(guide.title).toBeDefined();
            expect(typeof guide.title).toBe('string');
            expect(guide.title.length).toBeGreaterThan(0);

            // Property 3: content alanı tanımlı ve boş olmayan string olmalı
            expect(guide.content).toBeDefined();
            expect(typeof guide.content).toBe('string');
            expect(guide.content.length).toBeGreaterThan(0);

            // Property 4: slug alanı tanımlı olmalı
            expect(guide.slug).toBeDefined();
            expect(typeof guide.slug).toBe('string');

            // Property 5: category alanı geçerli olmalı
            expect(guide.category).toBeDefined();
            expect(['kilavuz', 'ceza', 'komut', 'prosedur']).toContain(guide.category);

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5b: Tüm ceza tanımları gerekli alanlara sahip olmalı
   *
   * *Herhangi bir* ceza tanımı için, id, name, code, description alanları
   * tanımlı ve geçerli olmalıdır.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5b: Tüm ceza tanımları gerekli alanlara sahip olmalı',
    async () => {
      const penalties = loadPenalties();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, penalties.length - 1) }),
          (index) => {
            if (penalties.length === 0) return true;

            const penalty = penalties[index];
            if (!penalty) return true;

            // Property 1: id alanı tanımlı ve boş olmayan string olmalı
            expect(penalty.id).toBeDefined();
            expect(typeof penalty.id).toBe('string');
            expect(penalty.id.length).toBeGreaterThan(0);

            // Property 2: name alanı tanımlı ve boş olmayan string olmalı
            expect(penalty.name).toBeDefined();
            expect(typeof penalty.name).toBe('string');
            expect(penalty.name.length).toBeGreaterThan(0);

            // Property 3: code alanı tanımlı ve boş olmayan string olmalı
            expect(penalty.code).toBeDefined();
            expect(typeof penalty.code).toBe('string');
            expect(penalty.code.length).toBeGreaterThan(0);

            // Property 4: description alanı tanımlı olmalı
            expect(penalty.description).toBeDefined();
            expect(typeof penalty.description).toBe('string');

            // Property 5: category geçerli olmalı
            expect(penalty.category).toBeDefined();
            expect(['yazili', 'sesli', 'ekstra', 'marked', 'blacklist']).toContain(
              penalty.category
            );

            // Property 6: duration tanımlı olmalı
            expect(penalty.duration).toBeDefined();
            expect(typeof penalty.duration).toBe('string');

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5c: Tüm komut tanımları gerekli alanlara sahip olmalı
   *
   * *Herhangi bir* komut tanımı için, id, command, description alanları
   * tanımlı ve geçerli olmalıdır.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5c: Tüm komut tanımları gerekli alanlara sahip olmalı',
    async () => {
      const commands = loadCommands();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, commands.length - 1) }),
          (index) => {
            if (commands.length === 0) return true;

            const command = commands[index];
            if (!command) return true;

            // Property 1: id alanı tanımlı ve boş olmayan string olmalı
            expect(command.id).toBeDefined();
            expect(typeof command.id).toBe('string');
            expect(command.id.length).toBeGreaterThan(0);

            // Property 2: command alanı tanımlı ve boş olmayan string olmalı
            expect(command.command).toBeDefined();
            expect(typeof command.command).toBe('string');
            expect(command.command.length).toBeGreaterThan(0);

            // Property 3: description alanı tanımlı olmalı
            expect(command.description).toBeDefined();
            expect(typeof command.description).toBe('string');

            // Property 4: usage alanı tanımlı olmalı
            expect(command.usage).toBeDefined();
            expect(typeof command.usage).toBe('string');

            // Property 5: permissions array olmalı
            expect(command.permissions).toBeDefined();
            expect(Array.isArray(command.permissions)).toBe(true);

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5d: Tüm prosedür tanımları gerekli alanlara sahip olmalı
   *
   * *Herhangi bir* prosedür tanımı için, id, title, description, steps alanları
   * tanımlı ve geçerli olmalıdır.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5d: Tüm prosedür tanımları gerekli alanlara sahip olmalı',
    async () => {
      const procedures = loadProcedures();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, procedures.length - 1) }),
          (index) => {
            if (procedures.length === 0) return true;

            const procedure = procedures[index];
            if (!procedure) return true;

            // Property 1: id alanı tanımlı ve boş olmayan string olmalı
            expect(procedure.id).toBeDefined();
            expect(typeof procedure.id).toBe('string');
            expect(procedure.id.length).toBeGreaterThan(0);

            // Property 2: title alanı tanımlı ve boş olmayan string olmalı
            expect(procedure.title).toBeDefined();
            expect(typeof procedure.title).toBe('string');
            expect(procedure.title.length).toBeGreaterThan(0);

            // Property 3: description alanı tanımlı olmalı
            expect(procedure.description).toBeDefined();
            expect(typeof procedure.description).toBe('string');

            // Property 4: steps alanı tanımlı olmalı
            expect(procedure.steps).toBeDefined();
            expect(typeof procedure.steps).toBe('string');

            // Property 5: slug alanı tanımlı olmalı
            expect(procedure.slug).toBeDefined();
            expect(typeof procedure.slug).toBe('string');

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: Content - ID ve Slug Tutarlılığı', () => {
  /**
   * Property 5e: ID ile alınan kılavuz içeriği, slug ile alınan içerikle eşleşmeli
   *
   * *Herhangi bir* kılavuz içeriği için, getContentById ve getGuideBySlug
   * aynı içeriği döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5e: ID ile alınan kılavuz içeriği, slug ile alınan içerikle eşleşmeli',
    async () => {
      const guides = loadGuideContent();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, guides.length - 1) }),
          (index) => {
            if (guides.length === 0) return true;

            const guide = guides[index];
            if (!guide) return true;

            // ID ile içerik al
            const contentById = getContentById(guide.id);

            // Slug ile içerik al
            const contentBySlug = getGuideBySlug(guide.slug);

            // Property: Her iki yöntem de aynı içeriği döndürmeli
            expect(contentById).not.toBeNull();
            expect(contentBySlug).not.toBeNull();

            if (contentById && contentBySlug) {
              expect(contentById.id).toBe(contentBySlug.id);
              expect((contentById as GuideContent).title).toBe(contentBySlug.title);
              expect((contentById as GuideContent).content).toBe(contentBySlug.content);
              expect((contentById as GuideContent).slug).toBe(contentBySlug.slug);
            }

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5f: ID ile alınan ceza, kod ile alınan cezayla eşleşmeli
   *
   * *Herhangi bir* ceza tanımı için, getContentById ve getPenaltyByCode
   * aynı içeriği döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5f: ID ile alınan ceza, kod ile alınan cezayla eşleşmeli',
    async () => {
      const penalties = loadPenalties();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, penalties.length - 1) }),
          (index) => {
            if (penalties.length === 0) return true;

            const penalty = penalties[index];
            if (!penalty) return true;

            // ID ile içerik al
            const contentById = getContentById(penalty.id);

            // Kod ile içerik al
            const contentByCode = getPenaltyByCode(penalty.code);

            // Property: Her iki yöntem de aynı içeriği döndürmeli
            expect(contentById).not.toBeNull();
            expect(contentByCode).not.toBeNull();

            if (contentById && contentByCode) {
              expect(contentById.id).toBe(contentByCode.id);
              expect((contentById as PenaltyDefinition).code).toBe(contentByCode.code);
              expect((contentById as PenaltyDefinition).name).toBe(contentByCode.name);
              expect((contentById as PenaltyDefinition).description).toBe(
                contentByCode.description
              );
            }

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5g: ID ile alınan komut, isim ile alınan komutla eşleşmeli
   *
   * *Herhangi bir* komut tanımı için, getContentById ve getCommandByName
   * aynı içeriği döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5g: ID ile alınan komut, isim ile alınan komutla eşleşmeli',
    async () => {
      const commands = loadCommands();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, commands.length - 1) }),
          (index) => {
            if (commands.length === 0) return true;

            const command = commands[index];
            if (!command) return true;

            // ID ile içerik al
            const contentById = getContentById(command.id);

            // İsim ile içerik al
            const contentByName = getCommandByName(command.command);

            // Property: Her iki yöntem de aynı içeriği döndürmeli
            expect(contentById).not.toBeNull();
            expect(contentByName).not.toBeNull();

            if (contentById && contentByName) {
              expect(contentById.id).toBe(contentByName.id);
              expect((contentById as CommandDefinition).command).toBe(
                contentByName.command
              );
              expect((contentById as CommandDefinition).description).toBe(
                contentByName.description
              );
            }

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5h: ID ile alınan prosedür, slug ile alınan prosedürle eşleşmeli
   *
   * *Herhangi bir* prosedür tanımı için, getContentById ve getProcedureBySlug
   * aynı içeriği döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5h: ID ile alınan prosedür, slug ile alınan prosedürle eşleşmeli',
    async () => {
      const procedures = loadProcedures();

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, procedures.length - 1) }),
          (index) => {
            if (procedures.length === 0) return true;

            const procedure = procedures[index];
            if (!procedure) return true;

            // ID ile içerik al
            const contentById = getContentById(procedure.id);

            // Slug ile içerik al
            const contentBySlug = getProcedureBySlug(procedure.slug);

            // Property: Her iki yöntem de aynı içeriği döndürmeli
            expect(contentById).not.toBeNull();
            expect(contentBySlug).not.toBeNull();

            if (contentById && contentBySlug) {
              expect(contentById.id).toBe(contentBySlug.id);
              expect((contentById as ProcedureDefinition).title).toBe(
                contentBySlug.title
              );
              expect((contentById as ProcedureDefinition).slug).toBe(
                contentBySlug.slug
              );
            }

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: Content - Yükleme Tutarlılığı', () => {
  /**
   * Property 5i: İçerik yükleme birden fazla çağrıda tutarlı olmalı
   *
   * *Herhangi bir* içerik yükleme işlemi için, ardışık çağrılar
   * aynı sonucu döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5i: İçerik yükleme birden fazla çağrıda tutarlı olmalı',
    async () => {
      await fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (callCount) => {
          // Cache'i temizle
          clearContentCache();

          // İlk yükleme
          const firstGuides = loadGuideContent();
          const firstPenalties = loadPenalties();
          const firstCommands = loadCommands();
          const firstProcedures = loadProcedures();

          // Birden fazla kez yükle ve karşılaştır
          for (let i = 0; i < callCount; i++) {
            const guides = loadGuideContent();
            const penalties = loadPenalties();
            const commands = loadCommands();
            const procedures = loadProcedures();

            // Property 1: Kılavuz sayısı tutarlı olmalı
            expect(guides.length).toBe(firstGuides.length);

            // Property 2: Ceza sayısı tutarlı olmalı
            expect(penalties.length).toBe(firstPenalties.length);

            // Property 3: Komut sayısı tutarlı olmalı
            expect(commands.length).toBe(firstCommands.length);

            // Property 4: Prosedür sayısı tutarlı olmalı
            expect(procedures.length).toBe(firstProcedures.length);

            // Property 5: İçerik ID'leri tutarlı olmalı
            if (guides.length > 0) {
              expect(guides[0]?.id).toBe(firstGuides[0]?.id);
            }
            if (penalties.length > 0) {
              expect(penalties[0]?.id).toBe(firstPenalties[0]?.id);
            }
            if (commands.length > 0) {
              expect(commands[0]?.id).toBe(firstCommands[0]?.id);
            }
            if (procedures.length > 0) {
              expect(procedures[0]?.id).toBe(firstProcedures[0]?.id);
            }
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5j: Cache temizlendikten sonra içerik yeniden yüklenmeli ve tutarlı olmalı
   *
   * *Herhangi bir* cache temizleme işlemi sonrası, içerik yeniden yüklendiğinde
   * aynı veriler döndürülmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5j: Cache temizlendikten sonra içerik tutarlı olmalı',
    async () => {
      await fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (clearCount) => {
          // İlk yükleme
          const firstStats = getContentStats();

          for (let i = 0; i < clearCount; i++) {
            // Cache'i temizle
            clearContentCache();

            // Yeniden yükle
            const stats = getContentStats();

            // Property: İstatistikler tutarlı olmalı
            expect(stats.guideCount).toBe(firstStats.guideCount);
            expect(stats.penaltyCount).toBe(firstStats.penaltyCount);
            expect(stats.commandCount).toBe(firstStats.commandCount);
            expect(stats.procedureCount).toBe(firstStats.procedureCount);
            expect(stats.totalCount).toBe(firstStats.totalCount);
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: Content - Benzersiz ID Tutarlılığı', () => {
  /**
   * Property 5k: Tüm içerik ID'leri benzersiz olmalı
   *
   * *Herhangi bir* içerik koleksiyonu için, tüm ID'ler benzersiz olmalıdır.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5k: Tüm içerik ID\'leri benzersiz olmalı',
    async () => {
      const guides = loadGuideContent();
      const penalties = loadPenalties();
      const commands = loadCommands();
      const procedures = loadProcedures();

      // Tüm ID'leri topla
      const allIds = [
        ...guides.map((g) => g.id),
        ...penalties.map((p) => p.id),
        ...commands.map((c) => c.id),
        ...procedures.map((p) => p.id),
      ];

      // Property: Tüm ID'ler benzersiz olmalı
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);

      // Her kategori içinde de benzersiz olmalı
      const guideIds = new Set(guides.map((g) => g.id));
      expect(guideIds.size).toBe(guides.length);

      const penaltyIds = new Set(penalties.map((p) => p.id));
      expect(penaltyIds.size).toBe(penalties.length);

      const commandIds = new Set(commands.map((c) => c.id));
      expect(commandIds.size).toBe(commands.length);

      const procedureIds = new Set(procedures.map((p) => p.id));
      expect(procedureIds.size).toBe(procedures.length);
    },
    30000
  );

  /**
   * Property 5l: getContentById her zaman doğru içeriği döndürmeli
   *
   * *Herhangi bir* geçerli ID için, getContentById doğru içeriği döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5l: getContentById her zaman doğru içeriği döndürmeli',
    async () => {
      const guides = loadGuideContent();
      const penalties = loadPenalties();
      const commands = loadCommands();
      const procedures = loadProcedures();

      // Tüm içerikleri birleştir
      const allContent = [
        ...guides.map((g) => ({ id: g.id, type: 'guide' as const })),
        ...penalties.map((p) => ({ id: p.id, type: 'penalty' as const })),
        ...commands.map((c) => ({ id: c.id, type: 'command' as const })),
        ...procedures.map((p) => ({ id: p.id, type: 'procedure' as const })),
      ];

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allContent.length - 1) }),
          (index) => {
            if (allContent.length === 0) return true;

            const item = allContent[index];
            if (!item) return true;

            // ID ile içerik al
            const content = getContentById(item.id);

            // Property: İçerik bulunmalı ve ID eşleşmeli
            expect(content).not.toBeNull();
            expect(content?.id).toBe(item.id);

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 5m: Olmayan ID için null döndürülmeli
   *
   * *Herhangi bir* geçersiz ID için, getContentById null döndürmelidir.
   *
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5m: Olmayan ID için null döndürülmeli',
    async () => {
      await fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), {
            minLength: 10,
            maxLength: 30,
          }),
          (randomId) => {
            // Rastgele ID'nin mevcut içeriklerde olmadığından emin ol
            const prefixedId = `nonexistent-${randomId}`;

            // ID ile içerik al
            const content = getContentById(prefixedId);

            // Property: Olmayan ID için null döndürülmeli
            expect(content).toBeNull();

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

