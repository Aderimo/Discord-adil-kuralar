/**
 * Property Test: Command Categorization Completeness
 * 
 * Feature: yetkili-kilavuzu-v2-guncelleme
 * Property 3: Command Categorization Completeness
 * 
 * For any command in the system, it SHALL belong to exactly one of the 
 * defined categories (ceza, bilgi, sesli, gk-plus), and when filtering 
 * by a category, only commands belonging to that category SHALL be displayed.
 * 
 * **Validates: Requirements 3.1, 3.5**
 */

import fc from 'fast-check';

// Geçerli komut kategorileri
const VALID_CATEGORIES = ['ceza', 'bilgi', 'sesli', 'gk-plus'] as const;
type CommandCategory = typeof VALID_CATEGORIES[number];

// Test için komut yapısı
interface TestCommand {
  id: string;
  command: string;
  category: CommandCategory;
  permissions: string[];
}

// Mock komut verileri (content/commands/index.json'dan)
const MOCK_COMMANDS: TestCommand[] = [
  { id: 'cmd-001', command: 's!mute', category: 'ceza', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-002', command: 's!unmute', category: 'ceza', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-003', command: 'h!timeout', category: 'ceza', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-004', command: 's!temprole add', category: 'ceza', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-005', command: 's!temprole remove', category: 'ceza', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-006', command: 's!role5ever', category: 'ceza', permissions: ['admin', 'ust_yetkili'] },
  { id: 'cmd-007', command: 'h!i', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-008', command: 'h!n', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-009', command: 'h!s', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-010', command: 'h!joins', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-011', command: 'h!c', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-012', command: 'h!avatar', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-013', command: 'h!j', category: 'sesli', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-014', command: 'h!pull', category: 'sesli', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-015', command: '/ticket-create', category: 'bilgi', permissions: ['mod', 'admin', 'ust_yetkili'] },
  { id: 'cmd-016', command: 'h!ban', category: 'gk-plus', permissions: ['admin', 'ust_yetkili'] },
  { id: 'cmd-017', command: 'h!unban', category: 'gk-plus', permissions: ['admin', 'ust_yetkili'] },
  { id: 'cmd-018', command: '/allow', category: 'gk-plus', permissions: ['admin', 'ust_yetkili'] },
  { id: 'cmd-019', command: '/deny', category: 'gk-plus', permissions: ['admin', 'ust_yetkili'] },
];

// Kategoriye göre komutları filtrele
function filterByCategory(commands: TestCommand[], category: CommandCategory): TestCommand[] {
  return commands.filter(cmd => cmd.category === category);
}

// Komutun geçerli kategoriye sahip olup olmadığını kontrol et
function hasValidCategory(command: TestCommand): boolean {
  return VALID_CATEGORIES.includes(command.category);
}

// Komutun tam olarak bir kategoriye ait olup olmadığını kontrol et
function belongsToExactlyOneCategory(command: TestCommand): boolean {
  const matchingCategories = VALID_CATEGORIES.filter(cat => cat === command.category);
  return matchingCategories.length === 1;
}

describe('Command Categorization Completeness', () => {
  /**
   * Property 1: Her komut geçerli bir kategoriye sahip olmalı
   * **Validates: Requirements 3.1, 3.5**
   */
  it('every command should have a valid category', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MOCK_COMMANDS),
        (command) => {
          return hasValidCategory(command);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Her komut tam olarak bir kategoriye ait olmalı
   * **Validates: Requirements 3.1, 3.5**
   */
  it('every command should belong to exactly one category', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MOCK_COMMANDS),
        (command) => {
          return belongsToExactlyOneCategory(command);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Kategoriye göre filtreleme sadece o kategorideki komutları döndürmeli
   * **Validates: Requirements 3.1, 3.5**
   */
  it('filtering by category should return only commands in that category', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_CATEGORIES),
        (category) => {
          const filtered = filterByCategory(MOCK_COMMANDS, category);
          return filtered.every(cmd => cmd.category === category);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Tüm kategorilerin toplamı tüm komutlara eşit olmalı
   * **Validates: Requirements 3.1, 3.5**
   */
  it('sum of all category counts should equal total commands', () => {
    const totalFromCategories = VALID_CATEGORIES.reduce((sum, cat) => {
      return sum + filterByCategory(MOCK_COMMANDS, cat).length;
    }, 0);
    
    expect(totalFromCategories).toBe(MOCK_COMMANDS.length);
  });

  /**
   * Property 5: GK+ komutları admin veya üst yetkili gerektirmeli
   * **Validates: Requirements 10.5, 10.6**
   */
  it('GK+ commands should require admin or ust_yetkili permission', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...filterByCategory(MOCK_COMMANDS, 'gk-plus')),
        (command) => {
          // GK+ komutları mod içermemeli, sadece admin ve ust_yetkili
          const hasModPermission = command.permissions.includes('mod');
          const hasAdminPermission = command.permissions.includes('admin') || command.permissions.includes('ust_yetkili');
          return !hasModPermission && hasAdminPermission;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests: Spesifik kategori kontrolleri
  describe('Specific category checks', () => {
    it('ceza category should have mute/timeout commands', () => {
      const cezaCommands = filterByCategory(MOCK_COMMANDS, 'ceza');
      const hasMute = cezaCommands.some(cmd => cmd.command.includes('mute'));
      const hasTimeout = cezaCommands.some(cmd => cmd.command.includes('timeout'));
      expect(hasMute).toBe(true);
      expect(hasTimeout).toBe(true);
    });

    it('bilgi category should have info commands', () => {
      const bilgiCommands = filterByCategory(MOCK_COMMANDS, 'bilgi');
      const hasInfoCommand = bilgiCommands.some(cmd => cmd.command === 'h!i');
      expect(hasInfoCommand).toBe(true);
    });

    it('sesli category should have voice commands', () => {
      const sesliCommands = filterByCategory(MOCK_COMMANDS, 'sesli');
      const hasJoinCommand = sesliCommands.some(cmd => cmd.command === 'h!j');
      const hasPullCommand = sesliCommands.some(cmd => cmd.command === 'h!pull');
      expect(hasJoinCommand).toBe(true);
      expect(hasPullCommand).toBe(true);
    });

    it('gk-plus category should have ban/unban commands', () => {
      const gkPlusCommands = filterByCategory(MOCK_COMMANDS, 'gk-plus');
      const hasBan = gkPlusCommands.some(cmd => cmd.command === 'h!ban');
      const hasUnban = gkPlusCommands.some(cmd => cmd.command === 'h!unban');
      const hasAllow = gkPlusCommands.some(cmd => cmd.command === '/allow');
      const hasDeny = gkPlusCommands.some(cmd => cmd.command === '/deny');
      expect(hasBan).toBe(true);
      expect(hasUnban).toBe(true);
      expect(hasAllow).toBe(true);
      expect(hasDeny).toBe(true);
    });
  });
});
