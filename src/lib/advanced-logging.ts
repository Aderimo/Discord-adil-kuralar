// Advanced Logging Service - Gelişmiş aktivite loglama servisi
// Mevcut logging.ts altyapısını genişleterek kapsamlı aktivite takibi sağlar
// Requirements: 2.4, 5.4, 10.3 - Metin truncation limitleri

/**
 * Ziyaretçi bilgileri interface'i
 * Anonim ve authenticated kullanıcılar için ortak yapı
 */
export interface VisitorInfo {
  ipAddress: string;
  userId: string | null;
  sessionId: string | null;
  userAgent: string;
  referrer: string | null;
}

/**
 * AI etkileşim log interface'i
 * Soru-cevap çiftlerini ve metadata'yı içerir
 */
export interface AIInteractionLog {
  question: string;
  response: string;
  confidence: 'high' | 'medium' | 'low';
  responseTime: number;
}

/**
 * Sayfa erişim log interface'i
 * Navigasyon ve erişim türü bilgilerini içerir
 */
export interface PageAccessLog {
  url: string;
  title: string;
  category: string;
  contentType: string;
  referrerUrl: string | null;
  accessType: 'direct' | 'navigation' | 'external';
}

/**
 * Arama log interface'i
 * Arama sorgusu ve sonuç bilgilerini içerir
 */
export interface SearchLog {
  query: string;
  resultsCount: number;
  selectedResult: string | null;
}

/**
 * Metin girişi log interface'i
 * Form alanı ve içerik bilgilerini içerir
 */
export interface TextInputLog {
  fieldId: string;
  formContext: string;
  content: string; // Max 1000 chars
  isSensitive: boolean;
}

/**
 * Metin kopyalama log interface'i
 * Kopyalanan metin ve pozisyon bilgilerini içerir
 */
export interface TextCopyLog {
  copiedText: string; // Max 500 chars
  sourcePage: string;
  elementContext: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Referrer log interface'i
 * Trafik kaynağı bilgilerini içerir
 */
export interface ReferrerLog {
  referrerUrl: string;
  sourceDomain: string;
  sourceType: 'social' | 'search' | 'direct' | 'other';
}

// ============================================================================
// Truncation Helper Functions
// Requirements: 2.4, 5.4, 10.3 - Metin truncation limitleri
// ============================================================================

/** AI metinleri için maksimum karakter limiti */
export const AI_TEXT_MAX_LENGTH = 2000;

/** Metin girişi için maksimum karakter limiti */
export const INPUT_TEXT_MAX_LENGTH = 1000;

/** Kopyalanan metin için maksimum karakter limiti */
export const COPY_TEXT_MAX_LENGTH = 500;

/**
 * Metni belirtilen maksimum uzunluğa kısaltır
 * @param text - Kısaltılacak metin
 * @param maxLength - Maksimum karakter sayısı
 * @returns Kısaltılmış metin
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength);
}

/**
 * AI metinlerini 2000 karaktere kısaltır
 * Requirement 2.4: THE Logging_System SHALL truncate question and response texts to a maximum of 2000 characters each
 * @param text - Kısaltılacak AI metni
 * @returns Kısaltılmış metin (max 2000 karakter)
 */
export function truncateAIText(text: string): string {
  return truncateText(text, AI_TEXT_MAX_LENGTH);
}

/**
 * Metin girişlerini 1000 karaktere kısaltır
 * Requirement 5.4: THE Logging_System SHALL truncate long text inputs to a maximum of 1000 characters
 * @param text - Kısaltılacak metin girişi
 * @returns Kısaltılmış metin (max 1000 karakter)
 */
export function truncateInputText(text: string): string {
  return truncateText(text, INPUT_TEXT_MAX_LENGTH);
}

/**
 * Kopyalanan metinleri 500 karaktere kısaltır
 * Requirement 10.3: THE Logging_System SHALL truncate copied text to a maximum of 500 characters
 * @param text - Kısaltılacak kopyalanan metin
 * @returns Kısaltılmış metin (max 500 karakter)
 */
export function truncateCopyText(text: string): string {
  return truncateText(text, COPY_TEXT_MAX_LENGTH);
}

// ============================================================================
// IP Validation Helper Functions
// Requirement 1.4: THE Logging_System SHALL store IP addresses in a consistent format (IPv4 or IPv6)
// ============================================================================

/** IPv4 regex pattern */
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/** IPv6 regex pattern - simplified but comprehensive */
const IPV6_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|::)$/;

/** Default IP address for invalid inputs */
export const DEFAULT_IP_ADDRESS = '0.0.0.0';

/** Anonymous user identifier */
export const ANONYMOUS_USER_ID = 'anonymous';

/**
 * IPv4 adresini doğrular
 * @param ip - Doğrulanacak IP adresi
 * @returns IP'nin geçerli IPv4 olup olmadığı
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  return IPV4_REGEX.test(ip.trim());
}

/**
 * IPv6 adresini doğrular
 * @param ip - Doğrulanacak IP adresi
 * @returns IP'nin geçerli IPv6 olup olmadığı
 */
export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  return IPV6_REGEX.test(ip.trim());
}

/**
 * IP adresini doğrular (IPv4 veya IPv6)
 * Requirement 1.4: THE Logging_System SHALL store IP addresses in a consistent format (IPv4 or IPv6)
 * @param ip - Doğrulanacak IP adresi
 * @returns IP'nin geçerli olup olmadığı
 */
export function isValidIP(ip: string): boolean {
  return isValidIPv4(ip) || isValidIPv6(ip);
}

/**
 * IP adresini normalize eder
 * Geçersiz IP'ler için varsayılan değer döndürür
 * @param ip - Normalize edilecek IP adresi
 * @returns Normalize edilmiş IP adresi
 */
export function normalizeIP(ip: string): string {
  if (!ip || typeof ip !== 'string') {
    return DEFAULT_IP_ADDRESS;
  }
  
  const trimmedIP = ip.trim();
  
  if (isValidIP(trimmedIP)) {
    return trimmedIP;
  }
  
  return DEFAULT_IP_ADDRESS;
}

/**
 * IP adresinin türünü döndürür
 * @param ip - IP adresi
 * @returns 'ipv4', 'ipv6' veya 'invalid'
 */
export function getIPType(ip: string): 'ipv4' | 'ipv6' | 'invalid' {
  if (isValidIPv4(ip)) {
    return 'ipv4';
  }
  if (isValidIPv6(ip)) {
    return 'ipv6';
  }
  return 'invalid';
}

// ============================================================================
// Visitor Access Details Interface
// ============================================================================

/**
 * Ziyaretçi erişim detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface VisitorAccessDetails {
  event: 'visitor_access';
  userAgent: string;
  referrer: string | null;
  isAnonymous: boolean;
  timestamp: string;
}

// ============================================================================
// Visitor Access Logging Function
// Requirements: 1.1, 1.2, 1.3, 1.4
// ============================================================================

import { prisma } from './prisma';
import { toAppActivityLog } from './db';
import type { ActivityLog } from '@/types';

/**
 * Ziyaretçi erişimini loglar
 * 
 * Requirement 1.1: WHEN a visitor accesses any page THEN THE Logging_System SHALL record the visitor's IP address
 * Requirement 1.2: WHEN an anonymous visitor accesses the site THEN THE Logging_System SHALL create a log entry with IP address and "anonymous" user identifier
 * Requirement 1.3: WHEN an authenticated user accesses the site THEN THE Logging_System SHALL create a log entry with IP address and user ID
 * Requirement 1.4: THE Logging_System SHALL store IP addresses in a consistent format (IPv4 or IPv6)
 * 
 * @param visitor - Ziyaretçi bilgileri
 * @returns Oluşturulan log kaydı
 */
export async function logVisitorAccess(visitor: VisitorInfo): Promise<ActivityLog> {
  // IP adresini normalize et (geçersiz IP'ler için varsayılan değer kullan)
  const normalizedIP = normalizeIP(visitor.ipAddress);
  
  // Kullanıcı ID'sini belirle (anonim veya authenticated)
  // Requirement 1.2: Anonim ziyaretçiler için "anonymous" identifier
  // Requirement 1.3: Authenticated kullanıcılar için user ID
  const isAnonymous = !visitor.userId;
  
  // Anonim kullanıcılar için sistem kullanıcısını bul veya oluştur
  let logUserId: string;
  
  if (isAnonymous) {
    // Sistem kullanıcısını bul veya oluştur
    let systemUser = await prisma.user.findUnique({
      where: { email: 'system@yetkili-kilavuzu.local' },
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          username: 'system',
          email: 'system@yetkili-kilavuzu.local',
          passwordHash: 'SYSTEM_USER_NO_LOGIN',
          status: 'approved',
          roleId: null,
        },
      });
    }

    logUserId = systemUser.id;
  } else {
    logUserId = visitor.userId!;
  }
  
  // Log detaylarını oluştur
  const details: VisitorAccessDetails = {
    event: 'visitor_access',
    userAgent: visitor.userAgent || '',
    referrer: visitor.referrer,
    isAnonymous,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId: logUserId,
      action: 'visitor_access',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

// ============================================================================
// AI Interaction Details Interface
// ============================================================================

/**
 * AI etkileşim detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface AIInteractionDetails {
  event: 'ai_interaction';
  question: string;      // Max 2000 chars
  response: string;      // Max 2000 chars
  confidence: string;
  responseTime: number;
  timestamp: string;
}

// ============================================================================
// AI Interaction Logging Function
// Requirements: 2.1, 2.2, 2.3, 2.5
// ============================================================================

/**
 * AI etkileşimini loglar
 * 
 * Requirement 2.1: WHEN a user submits a question to the AI_Assistant THEN THE Logging_System SHALL record the question text
 * Requirement 2.2: WHEN the AI_Assistant generates a response THEN THE Logging_System SHALL record the response text
 * Requirement 2.3: WHEN an AI interaction occurs THEN THE Logging_System SHALL link the question and response in a single log entry
 * Requirement 2.5: WHEN logging AI interactions THEN THE Logging_System SHALL include timestamp, user identifier, and session context
 * 
 * @param userId - Kullanıcı ID'si
 * @param interaction - AI etkileşim bilgileri (soru, cevap, confidence, responseTime)
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logAIInteraction(
  userId: string,
  interaction: AIInteractionLog,
  ip: string
): Promise<ActivityLog> {
  // IP adresini normalize et
  const normalizedIP = normalizeIP(ip);
  
  // Soru ve cevap metinlerini truncate et (max 2000 karakter)
  // Requirement 2.4: THE Logging_System SHALL truncate question and response texts to a maximum of 2000 characters each
  const truncatedQuestion = truncateAIText(interaction.question);
  const truncatedResponse = truncateAIText(interaction.response);
  
  // Log detaylarını oluştur
  // Requirement 2.3: Soru ve cevap tek bir log kaydında birlikte
  // Requirement 2.5: Timestamp, user identifier ve session context dahil
  const details: AIInteractionDetails = {
    event: 'ai_interaction',
    question: truncatedQuestion,
    response: truncatedResponse,
    confidence: interaction.confidence,
    responseTime: interaction.responseTime,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action: 'ai_interaction',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

// ============================================================================
// Page Access Details Interface
// ============================================================================

/**
 * Sayfa erişim detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface PageAccessDetails {
  event: 'page_access';
  url: string;
  title: string;
  category: string;
  contentType: string;
  referrerUrl: string | null;
  accessType: string;
  timestamp: string;
}

// ============================================================================
// Page Access Logging Function
// Requirements: 3.1, 3.2, 3.3, 3.4
// ============================================================================

/**
 * Sayfa erişimini loglar
 * 
 * Requirement 3.1: WHEN a visitor navigates to any page THEN THE Logging_System SHALL record the page URL
 * Requirement 3.2: WHEN logging page access THEN THE Logging_System SHALL include page title, category, and content type
 * Requirement 3.3: WHEN a visitor accesses a page THEN THE Logging_System SHALL record the referrer URL if available
 * Requirement 3.4: THE Logging_System SHALL distinguish between direct access and navigation from other pages
 * 
 * @param userId - Kullanıcı ID'si
 * @param access - Sayfa erişim bilgileri (url, title, category, contentType, referrerUrl, accessType)
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logPageAccess(
  userId: string,
  access: PageAccessLog,
  ip: string
): Promise<ActivityLog> {
  // IP adresini normalize et
  const normalizedIP = normalizeIP(ip);
  
  // Log detaylarını oluştur
  // Requirement 3.1: Sayfa URL'sini kaydet
  // Requirement 3.2: Sayfa başlığı, kategori ve içerik türünü dahil et
  // Requirement 3.3: Referrer URL'sini kaydet (varsa)
  // Requirement 3.4: Erişim türünü ayırt et (direct/navigation/external)
  const details: PageAccessDetails = {
    event: 'page_access',
    url: access.url,
    title: access.title,
    category: access.category,
    contentType: access.contentType,
    referrerUrl: access.referrerUrl,
    accessType: access.accessType,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action: 'page_access',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}
