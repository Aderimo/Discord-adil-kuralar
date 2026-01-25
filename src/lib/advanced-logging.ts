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

// ============================================================================
// Search Activity Details Interface
// ============================================================================

/**
 * Arama aktivitesi detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface SearchActivityDetails {
  event: 'search';
  query: string;
  resultsCount: number;
  selectedResult: string | null;
  timestamp: string;
}

// ============================================================================
// Search Activity Logging Function
// Requirements: 4.1, 4.2, 4.3, 4.4
// ============================================================================

/**
 * Arama aktivitesini loglar
 * 
 * Requirement 4.1: WHEN a user performs a search THEN THE Logging_System SHALL record the search query
 * Requirement 4.2: WHEN logging search activity THEN THE Logging_System SHALL include the number of results returned
 * Requirement 4.3: WHEN a user clicks on a search result THEN THE Logging_System SHALL record the selected result
 * Requirement 4.4: THE Logging_System SHALL log both successful and zero-result searches
 * 
 * @param userId - Kullanıcı ID'si
 * @param search - Arama bilgileri (query, resultsCount, selectedResult)
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logSearchActivity(
  userId: string,
  search: SearchLog,
  ip: string
): Promise<ActivityLog> {
  // IP adresini normalize et
  const normalizedIP = normalizeIP(ip);
  
  // Log detaylarını oluştur
  // Requirement 4.1: Arama sorgusunu kaydet
  // Requirement 4.2: Sonuç sayısını dahil et
  // Requirement 4.3: Seçilen sonucu kaydet (varsa)
  // Requirement 4.4: Hem başarılı hem de sonuçsuz aramaları logla
  const details: SearchActivityDetails = {
    event: 'search',
    query: search.query,
    resultsCount: search.resultsCount,
    selectedResult: search.selectedResult,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action: 'search',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

// ============================================================================
// Text Input Details Interface
// ============================================================================

/**
 * Metin girişi detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface TextInputDetails {
  event: 'text_input';
  fieldId: string;
  formContext: string;
  content: string;      // Max 1000 chars
  timestamp: string;
}

// ============================================================================
// Sensitive Field Detection
// Requirement 5.3: THE Logging_System SHALL exclude sensitive fields (password, personal data) from logging
// ============================================================================

/**
 * Hassas alan pattern'leri
 * Bu pattern'lere uyan alanlar loglanmaz
 */
export const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  // Password alanları
  /password/i,
  /passwd/i,
  /pwd/i,
  /parola/i,
  /sifre/i,
  /şifre/i,
  
  // Kişisel veri alanları
  /ssn/i,                    // Social Security Number
  /social.?security/i,
  /tc.?kimlik/i,             // TC Kimlik No
  /kimlik.?no/i,
  /identity.?number/i,
  /national.?id/i,
  
  // Finansal bilgiler
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /expiry/i,
  /iban/i,
  /account.?number/i,
  /hesap.?no/i,
  
  // İletişim bilgileri (hassas kabul edilebilir)
  /phone/i,
  /telefon/i,
  /mobile/i,
  /cep/i,
  
  // Sağlık bilgileri
  /health/i,
  /medical/i,
  /saglik/i,
  /sağlık/i,
  
  // Güvenlik soruları/cevapları
  /security.?question/i,
  /security.?answer/i,
  /secret/i,
  /pin/i,
  
  // Token ve API anahtarları
  /token/i,
  /api.?key/i,
  /auth/i,
  /bearer/i,
];

/**
 * Hassas form context pattern'leri
 * Bu pattern'lere uyan form context'leri loglanmaz
 */
export const SENSITIVE_FORM_PATTERNS: RegExp[] = [
  /login/i,
  /signin/i,
  /signup/i,
  /register/i,
  /password/i,
  /payment/i,
  /checkout/i,
  /billing/i,
  /credit/i,
  /bank/i,
];

/**
 * Bir alanın hassas olup olmadığını kontrol eder
 * Requirement 5.3: THE Logging_System SHALL exclude sensitive fields (password, personal data) from logging
 * 
 * @param fieldId - Alan ID'si
 * @param formContext - Form context'i
 * @returns Alanın hassas olup olmadığı
 */
export function isSensitiveField(fieldId: string, formContext: string): boolean {
  // Boş değerler hassas kabul edilmez
  if (!fieldId && !formContext) {
    return false;
  }
  
  // Field ID kontrolü
  if (fieldId) {
    for (const pattern of SENSITIVE_FIELD_PATTERNS) {
      if (pattern.test(fieldId)) {
        return true;
      }
    }
  }
  
  // Form context kontrolü
  if (formContext) {
    for (const pattern of SENSITIVE_FORM_PATTERNS) {
      if (pattern.test(formContext)) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================================================
// Text Input Logging Function
// Requirements: 5.1, 5.2, 5.3, 5.4
// ============================================================================

/**
 * Metin girişini loglar
 * 
 * Requirement 5.1: WHEN a user submits text in any input field THEN THE Logging_System SHALL record the input content
 * Requirement 5.2: WHEN logging text input THEN THE Logging_System SHALL include the input field identifier and form context
 * Requirement 5.3: THE Logging_System SHALL exclude sensitive fields (password, personal data) from logging
 * Requirement 5.4: THE Logging_System SHALL truncate long text inputs to a maximum of 1000 characters
 * 
 * @param userId - Kullanıcı ID'si
 * @param input - Metin girişi bilgileri (fieldId, formContext, content, isSensitive)
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı veya null (hassas alan ise)
 * @throws Error - Hassas alan loglanmaya çalışılırsa
 */
export async function logTextInput(
  userId: string,
  input: TextInputLog,
  ip: string
): Promise<ActivityLog | null> {
  // Requirement 5.3: Hassas alanları kontrol et
  // Önce input'un kendi isSensitive flag'ini kontrol et
  if (input.isSensitive) {
    // Hassas alan olarak işaretlenmiş, loglama
    return null;
  }
  
  // Field ID ve form context'e göre hassas alan kontrolü
  if (isSensitiveField(input.fieldId, input.formContext)) {
    // Hassas alan tespit edildi, loglama
    return null;
  }
  
  // IP adresini normalize et
  const normalizedIP = normalizeIP(ip);
  
  // Requirement 5.4: İçeriği 1000 karaktere kısalt
  const truncatedContent = truncateInputText(input.content);
  
  // Log detaylarını oluştur
  // Requirement 5.1: Metin girişi içeriğini kaydet
  // Requirement 5.2: Alan ID'si ve form context'i dahil et
  const details: TextInputDetails = {
    event: 'text_input',
    fieldId: input.fieldId,
    formContext: input.formContext,
    content: truncatedContent,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action: 'text_input',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

// ============================================================================
// Text Copy Details Interface
// ============================================================================

/**
 * Metin kopyalama detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface TextCopyDetails {
  event: 'text_copy';
  copiedText: string;    // Max 500 chars
  sourcePage: string;
  elementContext: string;
  selectionStart: number;
  selectionEnd: number;
  timestamp: string;
}

// ============================================================================
// Text Copy Logging Function
// Requirements: 10.1, 10.2, 10.3, 10.4
// ============================================================================

/**
 * Metin kopyalama olayını loglar
 * 
 * Requirement 10.1: WHEN a user copies text from the site THEN THE Logging_System SHALL record the copied text
 * Requirement 10.2: WHEN logging text copy THEN THE Logging_System SHALL include the source page and element context
 * Requirement 10.3: THE Logging_System SHALL truncate copied text to a maximum of 500 characters
 * Requirement 10.4: WHEN text is copied THEN THE Logging_System SHALL record the selection start and end positions
 * 
 * @param userId - Kullanıcı ID'si
 * @param copy - Metin kopyalama bilgileri (copiedText, sourcePage, elementContext, selectionStart, selectionEnd)
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logTextCopy(
  userId: string,
  copy: TextCopyLog,
  ip: string
): Promise<ActivityLog> {
  // IP adresini normalize et
  const normalizedIP = normalizeIP(ip);
  
  // Requirement 10.3: Kopyalanan metni 500 karaktere kısalt
  const truncatedCopiedText = truncateCopyText(copy.copiedText);
  
  // Log detaylarını oluştur
  // Requirement 10.1: Kopyalanan metni kaydet
  // Requirement 10.2: Kaynak sayfa ve element context'i dahil et
  // Requirement 10.4: Selection start/end pozisyonlarını kaydet
  const details: TextCopyDetails = {
    event: 'text_copy',
    copiedText: truncatedCopiedText,
    sourcePage: copy.sourcePage,
    elementContext: copy.elementContext,
    selectionStart: copy.selectionStart,
    selectionEnd: copy.selectionEnd,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action: 'text_copy',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

// ============================================================================
// Referrer Tracking Details Interface
// ============================================================================

/**
 * Referrer takip detayları interface'i
 * Design.md'de tanımlanan yapı
 */
export interface ReferrerTrackDetails {
  event: 'referrer_track';
  referrerUrl: string;
  sourceDomain: string;
  sourceType: string;
  sourceCount: number;
  timestamp: string;
}

// ============================================================================
// Source Type Classification
// Requirement 9.4: THE Logging_System SHALL distinguish between social media, search engines, and direct referrers
// ============================================================================

/**
 * Sosyal medya domain'leri
 * Requirement 9.4: Social media referrer'ları ayırt et
 */
export const SOCIAL_MEDIA_DOMAINS: string[] = [
  'facebook.com',
  'fb.com',
  'twitter.com',
  'x.com',
  't.co',
  'instagram.com',
  'linkedin.com',
  'discord.com',
  'discord.gg',
  'reddit.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
];

/**
 * Arama motoru domain'leri
 * Requirement 9.4: Search engine referrer'ları ayırt et
 */
export const SEARCH_ENGINE_DOMAINS: string[] = [
  'google.com',
  'google.com.tr',
  'google.co.uk',
  'google.de',
  'google.fr',
  'bing.com',
  'yahoo.com',
  'duckduckgo.com',
  'yandex.com',
  'yandex.ru',
  'baidu.com',
];

/**
 * URL'den domain'i çıkarır
 * Requirement 9.3: WHEN logging referrer data THEN THE Logging_System SHALL extract and store the source domain
 * 
 * @param url - Referrer URL
 * @returns Çıkarılan domain veya boş string
 */
export function extractDomain(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  try {
    // URL'yi temizle
    const trimmedUrl = url.trim();
    
    // Boş URL kontrolü
    if (!trimmedUrl) {
      return '';
    }
    
    // URL constructor ile parse et
    // Eğer protocol yoksa ekle
    let urlToParse = trimmedUrl;
    if (!trimmedUrl.includes('://')) {
      urlToParse = 'https://' + trimmedUrl;
    }
    
    const parsedUrl = new URL(urlToParse);
    let hostname = parsedUrl.hostname.toLowerCase();
    
    // www. prefix'ini kaldır
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch {
    // URL parse edilemezse boş string döndür
    return '';
  }
}

/**
 * Domain'in belirli bir listedeki domain'lerden biriyle eşleşip eşleşmediğini kontrol eder
 * Subdomain desteği ile (örn: m.facebook.com -> facebook.com)
 * 
 * @param domain - Kontrol edilecek domain
 * @param domainList - Eşleştirilecek domain listesi
 * @returns Eşleşme durumu
 */
export function matchesDomainList(domain: string, domainList: string[]): boolean {
  if (!domain) {
    return false;
  }
  
  const lowerDomain = domain.toLowerCase();
  
  for (const listDomain of domainList) {
    const lowerListDomain = listDomain.toLowerCase();
    
    // Tam eşleşme
    if (lowerDomain === lowerListDomain) {
      return true;
    }
    
    // Subdomain eşleşmesi (örn: m.facebook.com, mobile.twitter.com)
    if (lowerDomain.endsWith('.' + lowerListDomain)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Referrer URL'sinden kaynak türünü belirler
 * Requirement 9.4: THE Logging_System SHALL distinguish between social media, search engines, and direct referrers
 * 
 * @param referrerUrl - Referrer URL
 * @param currentDomain - Mevcut site domain'i (direct referrer kontrolü için)
 * @returns Kaynak türü: 'social' | 'search' | 'direct' | 'other'
 */
export function classifySourceType(
  referrerUrl: string,
  currentDomain?: string
): 'social' | 'search' | 'direct' | 'other' {
  // Boş referrer = direct
  if (!referrerUrl || referrerUrl.trim() === '') {
    return 'direct';
  }
  
  const domain = extractDomain(referrerUrl);
  
  // Domain çıkarılamadıysa = direct
  if (!domain) {
    return 'direct';
  }
  
  // Aynı domain = direct (internal navigation)
  if (currentDomain) {
    const currentDomainLower = currentDomain.toLowerCase();
    const domainLower = domain.toLowerCase();
    
    // Tam eşleşme veya subdomain eşleşmesi
    if (domainLower === currentDomainLower || 
        domainLower.endsWith('.' + currentDomainLower) ||
        currentDomainLower.endsWith('.' + domainLower)) {
      return 'direct';
    }
  }
  
  // Sosyal medya kontrolü
  if (matchesDomainList(domain, SOCIAL_MEDIA_DOMAINS)) {
    return 'social';
  }
  
  // Arama motoru kontrolü
  if (matchesDomainList(domain, SEARCH_ENGINE_DOMAINS)) {
    return 'search';
  }
  
  // Diğer tüm durumlar
  return 'other';
}

// ============================================================================
// In-Memory Source Counter (for session-based counting)
// Requirement 9.5: WHEN a referrer is detected THEN THE Logging_System SHALL increment a counter for that source
// ============================================================================

/**
 * Kaynak sayaçları - domain bazında
 * Not: Production'da bu Redis veya veritabanında tutulmalı
 */
const sourceCounters: Map<string, number> = new Map();

/**
 * Kaynak sayacını artırır
 * Requirement 9.5: WHEN a referrer is detected THEN THE Logging_System SHALL increment a counter for that source
 * 
 * @param sourceDomain - Kaynak domain
 * @returns Yeni sayaç değeri
 */
export function incrementSourceCounter(sourceDomain: string): number {
  if (!sourceDomain) {
    return 0;
  }
  
  const lowerDomain = sourceDomain.toLowerCase();
  const currentCount = sourceCounters.get(lowerDomain) || 0;
  const newCount = currentCount + 1;
  sourceCounters.set(lowerDomain, newCount);
  
  return newCount;
}

/**
 * Kaynak sayacını döndürür
 * 
 * @param sourceDomain - Kaynak domain
 * @returns Mevcut sayaç değeri
 */
export function getSourceCounter(sourceDomain: string): number {
  if (!sourceDomain) {
    return 0;
  }
  
  return sourceCounters.get(sourceDomain.toLowerCase()) || 0;
}

/**
 * Tüm kaynak sayaçlarını döndürür
 * 
 * @returns Tüm sayaçlar
 */
export function getAllSourceCounters(): Map<string, number> {
  return new Map(sourceCounters);
}

/**
 * Kaynak sayaçlarını sıfırlar (test amaçlı)
 */
export function resetSourceCounters(): void {
  sourceCounters.clear();
}

// ============================================================================
// Referrer Logging Function
// Requirements: 9.1, 9.3, 9.4, 9.5
// ============================================================================

/**
 * Referrer bilgisini loglar
 * 
 * Requirement 9.1: WHEN a visitor arrives via an external link THEN THE Logging_System SHALL record the referrer URL
 * Requirement 9.3: WHEN logging referrer data THEN THE Logging_System SHALL extract and store the source domain
 * Requirement 9.4: THE Logging_System SHALL distinguish between social media, search engines, and direct referrers
 * Requirement 9.5: WHEN a referrer is detected THEN THE Logging_System SHALL increment a counter for that source
 * 
 * @param visitor - Ziyaretçi bilgileri
 * @param referrer - Referrer bilgileri
 * @returns Oluşturulan log kaydı
 */
export async function logReferrer(
  visitor: VisitorInfo,
  referrer: ReferrerLog
): Promise<ActivityLog> {
  // IP adresini normalize et
  const normalizedIP = normalizeIP(visitor.ipAddress);
  
  // Kullanıcı ID'sini belirle
  const isAnonymous = !visitor.userId;
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
  
  // Requirement 9.5: Kaynak sayacını artır
  const sourceCount = incrementSourceCounter(referrer.sourceDomain);
  
  // Log detaylarını oluştur
  // Requirement 9.1: Referrer URL'sini kaydet
  // Requirement 9.3: Source domain'i kaydet
  // Requirement 9.4: Source type'ı kaydet
  const details: ReferrerTrackDetails = {
    event: 'referrer_track',
    referrerUrl: referrer.referrerUrl,
    sourceDomain: referrer.sourceDomain,
    sourceType: referrer.sourceType,
    sourceCount,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId: logUserId,
      action: 'referrer_track',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

/**
 * Referrer bilgisini otomatik olarak parse edip loglar
 * Helper fonksiyon - URL'den domain ve type otomatik çıkarılır
 * 
 * @param visitor - Ziyaretçi bilgileri
 * @param referrerUrl - Referrer URL
 * @param currentDomain - Mevcut site domain'i (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logReferrerFromUrl(
  visitor: VisitorInfo,
  referrerUrl: string,
  currentDomain?: string
): Promise<ActivityLog> {
  // Domain'i çıkar
  const sourceDomain = extractDomain(referrerUrl);
  
  // Kaynak türünü belirle
  const sourceType = classifySourceType(referrerUrl, currentDomain);
  
  // ReferrerLog oluştur
  const referrer: ReferrerLog = {
    referrerUrl,
    sourceDomain,
    sourceType,
  };
  
  return logReferrer(visitor, referrer);
}


// ============================================================================
// URL Copy Details Interface
// ============================================================================

/**
 * URL kopyalama detayları interface'i
 * Requirement 9.2: WHEN a user copies the site URL THEN THE Logging_System SHALL record the copy event with page context
 */
export interface URLCopyDetails {
  event: 'url_copy';
  copiedUrl: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
}

/**
 * URL kopyalama log interface'i
 * Kopyalanan URL ve sayfa context bilgilerini içerir
 */
export interface URLCopyLog {
  copiedUrl: string;
  pageUrl: string;
  pageTitle: string;
}

// ============================================================================
// URL Copy Logging Function
// Requirement 9.2
// ============================================================================

/**
 * URL kopyalama olayını loglar
 * 
 * Requirement 9.2: WHEN a user copies the site URL THEN THE Logging_System SHALL record the copy event with page context
 * 
 * @param userId - Kullanıcı ID'si
 * @param urlCopy - URL kopyalama bilgileri (copiedUrl, pageUrl, pageTitle)
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logURLCopy(
  userId: string,
  urlCopy: URLCopyLog,
  ip: string
): Promise<ActivityLog> {
  // IP adresini normalize et
  const normalizedIP = normalizeIP(ip);
  
  // Log detaylarını oluştur
  // Requirement 9.2: URL kopyalama olayını sayfa context'i ile kaydet
  const details: URLCopyDetails = {
    event: 'url_copy',
    copiedUrl: urlCopy.copiedUrl,
    pageUrl: urlCopy.pageUrl,
    pageTitle: urlCopy.pageTitle,
    timestamp: new Date().toISOString(),
  };
  
  // Log kaydını oluştur
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action: 'url_copy',
      details: JSON.stringify(details),
      ipAddress: normalizedIP,
    },
  });
  
  return toAppActivityLog(log);
}

/**
 * Anonim kullanıcı için URL kopyalama olayını loglar
 * Helper fonksiyon - userId olmadan çağrılabilir
 * 
 * @param urlCopy - URL kopyalama bilgileri
 * @param ip - Kullanıcının IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logURLCopyAnonymous(
  urlCopy: URLCopyLog,
  ip: string
): Promise<ActivityLog> {
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

  return logURLCopy(systemUser.id, urlCopy, ip);
}
