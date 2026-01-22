/**
 * İçerik Yükleme Servisi
 * Yetkili Kılavuzu, Cezalar, Komutlar ve Prosedürler için içerik yönetimi
 *
 * Requirements: 4.1, 4.3, 4.4, 8.1, 10.2
 */

import {
  GuideContent,
  GuideContentIndex,
  PenaltyDefinition,
  PenaltyIndex,
  CommandDefinition,
  CommandIndex,
  ProcedureDefinition,
  ProcedureIndex,
  SearchResult,
  SearchResultType,
  PenaltyCategory,
} from '@/types/content';

import {
  PenaltyTemplate,
  TemplateCategory,
} from '@/types/templates';

// JSON dosyasından gelen ham şablon verisi tipi (tarihler string olarak gelir)
interface RawTemplateData {
  templates: Array<{
    id: string;
    name: string;
    category: string;
    message: string;
    editableBy: string[];
    createdAt: string;
    updatedAt: string;
  }>;
  lastUpdated: string;
  version: string;
}

// İçerik dosyalarını import et
import guideData from '../../content/guide/index.json';
import penaltyData from '../../content/penalties/index.json';
import commandData from '../../content/commands/index.json';
import procedureData from '../../content/procedures/index.json';
import templateData from '../../content/templates/index.json';

// Cache için içerik depoları
let guideCache: GuideContent[] | null = null;
let penaltyCache: PenaltyDefinition[] | null = null;
let commandCache: CommandDefinition[] | null = null;
let procedureCache: ProcedureDefinition[] | null = null;
let templateCache: PenaltyTemplate[] | null = null;

/**
 * Tüm kılavuz içeriğini yükler
 * Requirement 4.1: Yetkili Kılavuzu içeriğini bölümlere ayrılmış şekilde sunmalı
 */
export function loadGuideContent(): GuideContent[] {
  if (guideCache) {
    return guideCache;
  }

  const data = guideData as GuideContentIndex;
  guideCache = data.items.sort((a, b) => a.order - b.order);
  return guideCache;
}

/**
 * Tüm cezaları yükler
 * Requirement 4.3: Cezaları kategorilere ayırmalı (yazılı, sesli, ekstra, marked, blacklist)
 */
export function loadPenalties(): PenaltyDefinition[] {
  if (penaltyCache) {
    return penaltyCache;
  }

  const data = penaltyData as PenaltyIndex;
  penaltyCache = data.items.sort((a, b) => (a.order || 0) - (b.order || 0));
  return penaltyCache;
}

/**
 * Kategoriye göre cezaları filtreler
 * Requirement 4.3: Cezaları kategorilere ayırmalı
 */
export function loadPenaltiesByCategory(
  category: PenaltyCategory
): PenaltyDefinition[] {
  const penalties = loadPenalties();
  return penalties.filter((p) => p.category === category);
}

/**
 * Tüm komutları yükler
 * Requirement 4.4: Prosedürleri ve komutları ayrı bölümler olarak sunmalı
 */
export function loadCommands(): CommandDefinition[] {
  if (commandCache) {
    return commandCache;
  }

  const data = commandData as CommandIndex;
  commandCache = data.items.sort((a, b) => (a.order || 0) - (b.order || 0));
  return commandCache;
}

/**
 * Tüm prosedürleri yükler
 * Requirement 4.4: Prosedürleri ve komutları ayrı bölümler olarak sunmalı
 */
export function loadProcedures(): ProcedureDefinition[] {
  if (procedureCache) {
    return procedureCache;
  }

  const data = procedureData as ProcedureIndex;
  procedureCache = data.items.sort((a, b) => (a.order || 0) - (b.order || 0));
  return procedureCache;
}

/**
 * Tüm ceza şablonlarını yükler
 * Requirement 8.1: THE System SHALL provide pre-defined ban message templates for common scenarios
 *
 * @returns PenaltyTemplate[] - Tarih stringleri Date objelerine dönüştürülmüş şablon dizisi
 */
export function loadTemplates(): PenaltyTemplate[] {
  if (templateCache) {
    return templateCache;
  }

  try {
    const data = templateData as RawTemplateData;

    // JSON'dan gelen tarih stringlerini Date objelerine dönüştür
    // ve category/editableBy alanlarını doğru tiplere cast et
    templateCache = data.templates.map((template) => ({
      id: template.id,
      name: template.name,
      category: template.category as TemplateCategory,
      message: template.message,
      editableBy: template.editableBy as PenaltyTemplate['editableBy'],
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
    }));

    return templateCache;
  } catch (error) {
    console.error('Şablonlar yüklenirken hata oluştu:', error);
    return [];
  }
}

/**
 * ID ile şablon getirir
 * Requirement 8.1: THE System SHALL provide pre-defined ban message templates
 *
 * @param id - Şablon ID'si (örn: "tpl-001")
 * @returns PenaltyTemplate | null - Bulunan şablon veya null
 */
export function getTemplateById(id: string): PenaltyTemplate | null {
  const templates = loadTemplates();
  return templates.find((t) => t.id === id) || null;
}

/**
 * Kategoriye göre şablonları filtreler
 * Requirement 8.1: THE System SHALL provide pre-defined ban message templates
 *
 * @param category - Şablon kategorisi (ban, mute, warn)
 * @returns PenaltyTemplate[] - Kategoriye ait şablonlar
 */
export function getTemplatesByCategory(category: TemplateCategory): PenaltyTemplate[] {
  const templates = loadTemplates();
  return templates.filter((t) => t.category === category);
}

/**
 * ID ile içerik getirir
 * Tüm içerik türlerinde arama yapar
 */
export function getContentById(
  id: string
):
  | GuideContent
  | PenaltyDefinition
  | CommandDefinition
  | ProcedureDefinition
  | null {
  // Kılavuz içeriğinde ara
  const guide = loadGuideContent().find((g) => g.id === id);
  if (guide) {
    return guide;
  }

  // Cezalarda ara
  const penalty = loadPenalties().find((p) => p.id === id);
  if (penalty) {
    return penalty;
  }

  // Komutlarda ara
  const command = loadCommands().find((c) => c.id === id);
  if (command) {
    return command;
  }

  // Prosedürlerde ara
  const procedure = loadProcedures().find((p) => p.id === id);
  if (procedure) {
    return procedure;
  }

  return null;
}

/**
 * Slug ile kılavuz içeriği getirir
 */
export function getGuideBySlug(slug: string): GuideContent | null {
  return loadGuideContent().find((g) => g.slug === slug) || null;
}

/**
 * Kod ile ceza getirir (örn: "ADK-001")
 */
export function getPenaltyByCode(code: string): PenaltyDefinition | null {
  return (
    loadPenalties().find((p) => p.code.toLowerCase() === code.toLowerCase()) ||
    null
  );
}

/**
 * Komut adı ile komut getirir (örn: "/mute")
 */
export function getCommandByName(command: string): CommandDefinition | null {
  const normalizedCommand = command.startsWith('/')
    ? command.toLowerCase()
    : `/${command.toLowerCase()}`;
  return (
    loadCommands().find((c) => c.command.toLowerCase() === normalizedCommand) ||
    null
  );
}

/**
 * Slug ile prosedür getirir
 */
export function getProcedureBySlug(slug: string): ProcedureDefinition | null {
  return loadProcedures().find((p) => p.slug === slug) || null;
}

/**
 * Metin içinde arama yapar ve ilgililik skoru hesaplar
 */
function calculateRelevanceScore(
  text: string,
  query: string,
  keywords: string[] = []
): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryTerms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);

  let score = 0;

  // Tam eşleşme kontrolü
  if (lowerText.includes(lowerQuery)) {
    score += 0.5;
  }

  // Her terim için ayrı kontrol
  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      score += 0.2;
    }
  }

  // Anahtar kelime eşleşmesi
  for (const keyword of keywords) {
    if (keyword.toLowerCase().includes(lowerQuery)) {
      score += 0.3;
    }
    for (const term of queryTerms) {
      if (keyword.toLowerCase().includes(term)) {
        score += 0.1;
      }
    }
  }

  // Skoru 0-1 arasında normalize et
  return Math.min(score, 1);
}

/**
 * Metinden özet çıkarır
 */
function extractExcerpt(content: string, query: string, maxLength = 150): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Sorgu teriminin geçtiği yeri bul
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    // Sorgu bulunamadıysa baştan al
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  // Sorgu etrafından özet çıkar
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + maxLength);
  let excerpt = content.slice(start, end);

  if (start > 0) {
    excerpt = '...' + excerpt;
  }
  if (end < content.length) {
    excerpt = excerpt + '...';
  }

  return excerpt;
}

/**
 * İçerikte arama yapar
 * Requirement 5.1, 5.2: Arama sistemi
 */
export function searchContent(query: string): SearchResult[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const results: SearchResult[] = [];
  const normalizedQuery = query.trim().toLowerCase();

  // Kılavuz içeriğinde ara
  for (const guide of loadGuideContent()) {
    const searchText = `${guide.title} ${guide.content}`;
    const score = calculateRelevanceScore(
      searchText,
      normalizedQuery,
      guide.keywords
    );

    if (score > 0) {
      results.push({
        id: guide.id,
        type: 'madde' as SearchResultType,
        title: guide.title,
        excerpt: extractExcerpt(guide.content, normalizedQuery),
        category: guide.category,
        relevanceScore: score,
      });
    }
  }

  // Cezalarda ara
  for (const penalty of loadPenalties()) {
    const searchText = `${penalty.name} ${penalty.code} ${penalty.description} ${penalty.examples.join(' ')}`;
    const score = calculateRelevanceScore(
      searchText,
      normalizedQuery,
      penalty.keywords
    );

    if (score > 0) {
      results.push({
        id: penalty.id,
        type: 'ceza' as SearchResultType,
        title: `${penalty.code} - ${penalty.name}`,
        excerpt: penalty.description,
        category: penalty.category,
        relevanceScore: score,
      });
    }
  }

  // Komutlarda ara
  for (const command of loadCommands()) {
    const searchText = `${command.command} ${command.description} ${command.examples.join(' ')}`;
    const score = calculateRelevanceScore(
      searchText,
      normalizedQuery,
      command.keywords
    );

    if (score > 0) {
      results.push({
        id: command.id,
        type: 'komut' as SearchResultType,
        title: command.command,
        excerpt: command.description,
        category: 'komut',
        relevanceScore: score,
      });
    }
  }

  // Prosedürlerde ara
  for (const procedure of loadProcedures()) {
    const searchText = `${procedure.title} ${procedure.description} ${procedure.steps}`;
    const score = calculateRelevanceScore(
      searchText,
      normalizedQuery,
      procedure.keywords
    );

    if (score > 0) {
      results.push({
        id: procedure.id,
        type: 'prosedur' as SearchResultType,
        title: procedure.title,
        excerpt: procedure.description,
        category: 'prosedur',
        relevanceScore: score,
      });
    }
  }

  // İlgililik skoruna göre sırala
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return results;
}

/**
 * Yaygın terimleri tanır ve ilgili içeriği döndürür
 * Requirement 5.3: Yaygın terimleri tanımalı
 */
export function searchByCommonTerm(term: string): SearchResult[] {
  const commonTermMappings: Record<string, string[]> = {
    hakaret: ['penalty-001'],
    küfür: ['penalty-001'],
    spam: ['penalty-002'],
    'xp abuse': ['penalty-003'],
    xp: ['penalty-003'],
    adk: ['penalty-001', 'penalty-002', 'penalty-003'],
    'banlanana kadar mute': ['penalty-007'],
    noroom: ['cmd-007'],
    pls: ['cmd-008'],
    mute: ['cmd-001', 'penalty-001', 'penalty-002'],
    ban: ['cmd-002', 'penalty-005', 'penalty-007'],
    blacklist: ['penalty-007'],
    marked: ['penalty-006'],
  };

  const lowerTerm = term.toLowerCase();
  
  // JavaScript'in yerleşik property'lerini kontrol et
  if (!Object.prototype.hasOwnProperty.call(commonTermMappings, lowerTerm)) {
    return searchContent(term);
  }
  
  const matchedIds = commonTermMappings[lowerTerm];

  if (!matchedIds || !Array.isArray(matchedIds)) {
    return searchContent(term);
  }

  const results: SearchResult[] = [];

  for (const id of matchedIds) {
    const content = getContentById(id);
    if (!content) {
      continue;
    }

    if ('code' in content) {
      // PenaltyDefinition
      results.push({
        id: content.id,
        type: 'ceza',
        title: `${content.code} - ${content.name}`,
        excerpt: content.description,
        category: content.category,
        relevanceScore: 1,
      });
    } else if ('command' in content) {
      // CommandDefinition
      results.push({
        id: content.id,
        type: 'komut',
        title: content.command,
        excerpt: content.description,
        category: 'komut',
        relevanceScore: 1,
      });
    }
  }

  return results;
}

/**
 * Cache'i temizler (test amaçlı)
 */
export function clearContentCache(): void {
  guideCache = null;
  penaltyCache = null;
  commandCache = null;
  procedureCache = null;
  templateCache = null;
}

/**
 * Tüm içerik istatistiklerini döndürür
 */
export function getContentStats(): {
  guideCount: number;
  penaltyCount: number;
  commandCount: number;
  procedureCount: number;
  templateCount: number;
  totalCount: number;
} {
  const guideCount = loadGuideContent().length;
  const penaltyCount = loadPenalties().length;
  const commandCount = loadCommands().length;
  const procedureCount = loadProcedures().length;
  const templateCount = loadTemplates().length;

  return {
    guideCount,
    penaltyCount,
    commandCount,
    procedureCount,
    templateCount,
    totalCount: guideCount + penaltyCount + commandCount + procedureCount + templateCount,
  };
}
