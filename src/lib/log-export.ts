// Log Export Service - Log dışa aktarma servisi
// Requirement 7.2: WHEN the Owner initiates download THEN THE Logging_System SHALL export logs in a structured format (CSV or JSON)
// Requirement 7.3: WHEN downloading logs THEN THE Logging_System SHALL include all log entries since the last download
// Requirement 7.5: THE Logging_System SHALL generate a unique filename with timestamp for each download

import { prisma } from './prisma';
import type { ActivityLog as PrismaActivityLog } from '@prisma/client';

// ============================================================================
// Interfaces
// Design.md'de tanımlanan ExportOptions ve ExportResult interface'leri
// ============================================================================

/**
 * Export seçenekleri interface'i
 * Log dışa aktarma için format ve filtre seçeneklerini tanımlar
 * 
 * Requirement 7.2: CSV veya JSON format desteği
 */
export interface ExportOptions {
  /** Dışa aktarma formatı: 'csv' veya 'json' */
  format: 'csv' | 'json';
  /** Başlangıç tarihi filtresi (opsiyonel) */
  startDate?: Date;
  /** Bitiş tarihi filtresi (opsiyonel) */
  endDate?: Date;
  /** Anonim kullanıcı loglarını dahil et */
  includeAnonymous: boolean;
}

/**
 * Export sonucu interface'i
 * Dışa aktarma işleminin sonucunu içerir
 * 
 * Requirement 7.5: Benzersiz dosya adı ve timestamp
 */
export interface ExportResult {
  /** Oluşturulan dosya adı (timestamp ile benzersiz) */
  filename: string;
  /** Dışa aktarılan içerik (CSV veya JSON string) */
  content: string;
  /** Dışa aktarılan kayıt sayısı */
  recordCount: number;
  /** Dışa aktarma tarihi */
  exportedAt: Date;
}


// ============================================================================
// Log Entry Interface for Export
// ============================================================================

/**
 * Dışa aktarılacak log kaydı interface'i
 * Prisma ActivityLog'dan dönüştürülmüş, export için uygun format
 */
export interface ExportLogEntry {
  id: string;
  userId: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO 8601 format
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prisma ActivityLog'u ExportLogEntry'ye dönüştürür
 * @param log - Prisma ActivityLog kaydı
 * @returns ExportLogEntry
 */
export function toExportLogEntry(log: PrismaActivityLog): ExportLogEntry {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    details: log.details,
    ipAddress: log.ipAddress,
    createdAt: log.timestamp.toISOString(),
  };
}

/**
 * Timestamp ile benzersiz dosya adı oluşturur
 * 
 * Requirement 7.5: THE Logging_System SHALL generate a unique filename with timestamp for each download
 * 
 * Format: logs_YYYYMMDD_HHmmss_SSS.{format}
 * Örnek: logs_20240115_143052_123.csv
 * 
 * @param format - Dosya formatı: 'csv' veya 'json'
 * @returns Benzersiz dosya adı
 */
export function generateFilename(format: 'csv' | 'json'): string {
  const now = new Date();
  
  // Tarih bileşenleri
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Saat bileşenleri
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  // Dosya adını oluştur
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
  
  return `logs_${timestamp}.${format}`;
}


// ============================================================================
// CSV Export Functions
// Requirement 7.2: CSV format desteği
// ============================================================================

/**
 * CSV header satırını oluşturur
 * @returns CSV header string
 */
export function generateCSVHeader(): string {
  return 'id,userId,action,details,ipAddress,createdAt';
}

/**
 * Tek bir log kaydını CSV satırına dönüştürür
 * CSV özel karakterlerini escape eder
 * 
 * @param entry - Export log kaydı
 * @returns CSV satırı
 */
export function logEntryToCSVRow(entry: ExportLogEntry): string {
  const escapeCSV = (value: string | null): string => {
    if (value === null || value === undefined) {
      return '';
    }
    // Çift tırnak, virgül veya yeni satır içeriyorsa escape et
    if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return [
    escapeCSV(entry.id),
    escapeCSV(entry.userId),
    escapeCSV(entry.action),
    escapeCSV(entry.details),
    escapeCSV(entry.ipAddress),
    escapeCSV(entry.createdAt),
  ].join(',');
}

/**
 * Log kayıtlarını CSV formatına dönüştürür
 * 
 * Requirement 7.2: CSV format desteği
 * 
 * @param entries - Export log kayıtları
 * @returns CSV içeriği (header + rows)
 */
export function logsToCSV(entries: ExportLogEntry[]): string {
  const header = generateCSVHeader();
  
  if (entries.length === 0) {
    return header; // Boş liste için sadece header döndür
  }
  
  const rows = entries.map(logEntryToCSVRow);
  return [header, ...rows].join('\n');
}

// ============================================================================
// JSON Export Functions
// Requirement 7.2: JSON format desteği
// ============================================================================

/**
 * Log kayıtlarını JSON formatına dönüştürür
 * 
 * Requirement 7.2: JSON format desteği
 * 
 * @param entries - Export log kayıtları
 * @returns JSON içeriği (pretty-printed)
 */
export function logsToJSON(entries: ExportLogEntry[]): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    recordCount: entries.length,
    logs: entries,
  };
  
  return JSON.stringify(exportData, null, 2);
}


// ============================================================================
// Main Export Function
// Requirements: 7.2, 7.3, 7.5
// ============================================================================

/**
 * Logları dışa aktarır
 * 
 * Requirement 7.2: WHEN the Owner initiates download THEN THE Logging_System SHALL export logs in a structured format (CSV or JSON)
 * Requirement 7.3: WHEN downloading logs THEN THE Logging_System SHALL include all log entries since the last download
 * Requirement 7.5: THE Logging_System SHALL generate a unique filename with timestamp for each download
 * 
 * @param options - Export seçenekleri (format, tarih filtreleri, anonim dahil etme)
 * @returns Export sonucu (filename, content, recordCount, exportedAt)
 */
export async function exportLogs(options: ExportOptions): Promise<ExportResult> {
  // Filtre koşullarını oluştur
  const whereClause: {
    timestamp?: {
      gte?: Date;
      lte?: Date;
    };
    userId?: {
      not: string;
    };
  } = {};

  // Tarih filtreleri
  if (options.startDate || options.endDate) {
    whereClause.timestamp = {};
    
    if (options.startDate) {
      whereClause.timestamp.gte = options.startDate;
    }
    
    if (options.endDate) {
      whereClause.timestamp.lte = options.endDate;
    }
  }

  // Anonim kullanıcı filtresi
  // Not: Anonim loglar system user ile kaydedilir
  if (!options.includeAnonymous) {
    // System user'ı bul
    const systemUser = await prisma.user.findUnique({
      where: { email: 'system@yetkili-kilavuzu.local' },
    });
    
    if (systemUser) {
      whereClause.userId = { not: systemUser.id };
    }
  }

  // Logları veritabanından çek (kronolojik sırada)
  const logs = await prisma.activityLog.findMany({
    where: whereClause,
    orderBy: { timestamp: 'asc' },
  });

  // Prisma loglarını export formatına dönüştür
  const exportEntries = logs.map(toExportLogEntry);

  // Formata göre içerik oluştur
  let content: string;
  
  if (options.format === 'csv') {
    content = logsToCSV(exportEntries);
  } else {
    content = logsToJSON(exportEntries);
  }

  // Benzersiz dosya adı oluştur
  const filename = generateFilename(options.format);

  // Export sonucunu döndür
  const result: ExportResult = {
    filename,
    content,
    recordCount: exportEntries.length,
    exportedAt: new Date(),
  };

  return result;
}


// ============================================================================
// Export Since Last Download Function
// Requirement 7.3: Son indirmeden sonraki tüm logları dahil et
// ============================================================================

/**
 * Son indirmeden sonraki logları dışa aktarır
 * 
 * Requirement 7.3: WHEN downloading logs THEN THE Logging_System SHALL include all log entries since the last download
 * 
 * @param userId - Kullanıcı ID'si (yetki kontrolü için)
 * @param format - Export formatı: 'csv' veya 'json'
 * @returns Export sonucu
 */
export async function exportLogsSinceLastDownload(
  userId: string,
  format: 'csv' | 'json'
): Promise<ExportResult> {
  // Kullanıcının son indirme tarihini al
  const permission = await prisma.logPermission.findUnique({
    where: { userId },
  });

  // Export seçeneklerini oluştur
  const options: ExportOptions = {
    format,
    includeAnonymous: true, // Tüm log türlerini dahil et (Requirement 7.3)
  };

  // Son indirme tarihi varsa, o tarihten sonraki logları al
  if (permission?.downloadedAt) {
    options.startDate = permission.downloadedAt;
  }

  return exportLogs(options);
}

// ============================================================================
// Pure Functions for Testing (Veritabanı bağımsız)
// ============================================================================

/**
 * CSV satırını parse eder (test amaçlı)
 * @param csvRow - CSV satırı
 * @returns Parse edilmiş değerler dizisi
 */
export function parseCSVRow(csvRow: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvRow.length; i++) {
    const char = csvRow[i];
    const nextChar = csvRow[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  // Son alanı ekle
  result.push(current);
  
  return result;
}

/**
 * CSV içeriğini parse eder (test amaçlı)
 * @param csvContent - CSV içeriği
 * @returns Parse edilmiş log kayıtları
 */
export function parseCSV(csvContent: string): ExportLogEntry[] {
  const lines = csvContent.split('\n');
  
  if (lines.length <= 1) {
    return []; // Sadece header veya boş
  }
  
  // Header'ı atla, veri satırlarını parse et
  const dataLines = lines.slice(1).filter(line => line.trim() !== '');
  
  return dataLines.map(line => {
    const values = parseCSVRow(line);
    return {
      id: values[0] || '',
      userId: values[1] || '',
      action: values[2] || '',
      details: values[3] || null,
      ipAddress: values[4] || null,
      createdAt: values[5] || '',
    };
  });
}

/**
 * JSON içeriğini parse eder (test amaçlı)
 * @param jsonContent - JSON içeriği
 * @returns Parse edilmiş log kayıtları
 */
export function parseJSON(jsonContent: string): ExportLogEntry[] {
  try {
    const data = JSON.parse(jsonContent);
    return data.logs || [];
  } catch {
    return [];
  }
}
