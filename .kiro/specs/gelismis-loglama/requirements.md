# Requirements Document

## Introduction

Bu doküman, Yetkili Kılavuzu uygulaması için gelişmiş loglama sisteminin gereksinimlerini tanımlar. Sistem, tüm ziyaretçilerin aktivitelerini detaylı şekilde kaydedecek, belirli eşiklerde owner'a bildirim gönderecek ve log yönetimi için indirme/silme yetkisi sağlayacaktır.

## Glossary

- **Logging_System**: Kullanıcı aktivitelerini kaydeden ve yöneten ana sistem bileşeni
- **Visitor**: Siteye giriş yapan herhangi bir kişi (authenticated veya anonymous)
- **Owner**: Sistem sahibi, log yönetim yetkisine sahip kullanıcı
- **Log_Entry**: Tek bir aktivite kaydı
- **Log_Page**: 20 log kaydından oluşan bir sayfa birimi
- **Notification_System**: Owner'a bildirim gönderen sistem bileşeni
- **Download_Permission**: Log indirme yetkisi
- **Delete_Permission**: Log silme yetkisi (tek seferlik)
- **Referrer**: Site linkini paylaşan veya kopyalayan kaynak
- **AI_Assistant**: Yapay zeka sohbet asistanı
- **Text_Copy_Event**: Kullanıcının siteden metin kopyalaması olayı

## Requirements

### Requirement 1: Ziyaretçi IP Loglama

**User Story:** As a site owner, I want to log every visitor's IP address, so that I can track all site access regardless of authentication status.

#### Acceptance Criteria

1. WHEN a visitor accesses any page THEN THE Logging_System SHALL record the visitor's IP address
2. WHEN an anonymous visitor accesses the site THEN THE Logging_System SHALL create a log entry with IP address and "anonymous" user identifier
3. WHEN an authenticated user accesses the site THEN THE Logging_System SHALL create a log entry with IP address and user ID
4. THE Logging_System SHALL store IP addresses in a consistent format (IPv4 or IPv6)

### Requirement 2: AI Soru-Cevap Loglama

**User Story:** As a site owner, I want to log all AI interactions, so that I can analyze user questions and AI responses.

#### Acceptance Criteria

1. WHEN a user submits a question to the AI_Assistant THEN THE Logging_System SHALL record the question text
2. WHEN the AI_Assistant generates a response THEN THE Logging_System SHALL record the response text
3. WHEN an AI interaction occurs THEN THE Logging_System SHALL link the question and response in a single log entry
4. THE Logging_System SHALL truncate question and response texts to a maximum of 2000 characters each
5. WHEN logging AI interactions THEN THE Logging_System SHALL include timestamp, user identifier, and session context

### Requirement 3: Sayfa Erişim Loglama

**User Story:** As a site owner, I want to log page visits, so that I can understand user navigation patterns.

#### Acceptance Criteria

1. WHEN a visitor navigates to any page THEN THE Logging_System SHALL record the page URL
2. WHEN logging page access THEN THE Logging_System SHALL include page title, category, and content type
3. WHEN a visitor accesses a page THEN THE Logging_System SHALL record the referrer URL if available
4. THE Logging_System SHALL distinguish between direct access and navigation from other pages

### Requirement 4: Arama Loglama

**User Story:** As a site owner, I want to log search queries, so that I can understand what users are looking for.

#### Acceptance Criteria

1. WHEN a user performs a search THEN THE Logging_System SHALL record the search query
2. WHEN logging search activity THEN THE Logging_System SHALL include the number of results returned
3. WHEN a user clicks on a search result THEN THE Logging_System SHALL record the selected result
4. THE Logging_System SHALL log both successful and zero-result searches

### Requirement 5: Metin Girişi Loglama

**User Story:** As a site owner, I want to log text inputs, so that I can analyze user interactions with forms and inputs.

#### Acceptance Criteria

1. WHEN a user submits text in any input field THEN THE Logging_System SHALL record the input content
2. WHEN logging text input THEN THE Logging_System SHALL include the input field identifier and form context
3. THE Logging_System SHALL exclude sensitive fields (password, personal data) from logging
4. THE Logging_System SHALL truncate long text inputs to a maximum of 1000 characters

### Requirement 6: Log Birikimi Bildirimi

**User Story:** As a site owner, I want to receive notifications when logs accumulate, so that I can manage storage and review activity.

#### Acceptance Criteria

1. WHEN the log count reaches 50 pages (1000 entries) THEN THE Notification_System SHALL send a notification to the Owner
2. WHEN sending log accumulation notification THEN THE Notification_System SHALL include the message "Log geçmişi 50 sayfa oldu"
3. WHEN the notification is sent THEN THE Notification_System SHALL grant Download_Permission to the Owner
4. THE Notification_System SHALL send only one notification per 50-page threshold
5. IF the Owner has not downloaded logs from previous notification THEN THE Notification_System SHALL not send duplicate notifications

### Requirement 7: Log İndirme

**User Story:** As a site owner, I want to download accumulated logs, so that I can archive and analyze them offline.

#### Acceptance Criteria

1. WHEN the Owner clicks on the log notification THEN THE Logging_System SHALL display a download option
2. WHEN the Owner initiates download THEN THE Logging_System SHALL export logs in a structured format (CSV or JSON)
3. WHEN downloading logs THEN THE Logging_System SHALL include all log entries since the last download
4. WHEN download completes successfully THEN THE Logging_System SHALL grant Delete_Permission to the Owner
5. THE Logging_System SHALL generate a unique filename with timestamp for each download

### Requirement 8: Log Silme Yetkisi

**User Story:** As a site owner, I want to delete logs after downloading, so that I can manage storage and maintain privacy.

#### Acceptance Criteria

1. WHEN the Owner has Delete_Permission THEN THE Logging_System SHALL display a delete option
2. WHEN the Owner initiates deletion THEN THE Logging_System SHALL remove all downloaded log entries
3. WHEN deletion completes THEN THE Logging_System SHALL revoke Delete_Permission from the Owner
4. WHEN Delete_Permission is revoked THEN THE Logging_System SHALL require 50 more pages to accumulate before granting new permission
5. IF the Owner attempts deletion without Delete_Permission THEN THE Logging_System SHALL reject the request
6. THE Logging_System SHALL log the deletion action itself before removing entries

### Requirement 9: Referrer Takibi

**User Story:** As a site owner, I want to track who shares my site links, so that I can understand traffic sources.

#### Acceptance Criteria

1. WHEN a visitor arrives via an external link THEN THE Logging_System SHALL record the referrer URL
2. WHEN a user copies the site URL THEN THE Logging_System SHALL record the copy event with page context
3. WHEN logging referrer data THEN THE Logging_System SHALL extract and store the source domain
4. THE Logging_System SHALL distinguish between social media, search engines, and direct referrers
5. WHEN a referrer is detected THEN THE Logging_System SHALL increment a counter for that source

### Requirement 10: Metin Kopyalama Takibi

**User Story:** As a site owner, I want to track text copying, so that I can understand which content is most valuable to users.

#### Acceptance Criteria

1. WHEN a user copies text from the site THEN THE Logging_System SHALL record the copied text
2. WHEN logging text copy THEN THE Logging_System SHALL include the source page and element context
3. THE Logging_System SHALL truncate copied text to a maximum of 500 characters
4. WHEN text is copied THEN THE Logging_System SHALL record the selection start and end positions
5. THE Logging_System SHALL aggregate copy events by content section for analytics

### Requirement 11: Log Veri Bütünlüğü

**User Story:** As a site owner, I want logs to be reliable and complete, so that I can trust the data for analysis.

#### Acceptance Criteria

1. THE Logging_System SHALL persist all log entries to the database immediately
2. IF a logging operation fails THEN THE Logging_System SHALL retry up to 3 times before discarding
3. THE Logging_System SHALL maintain chronological order of log entries
4. WHEN storing log entries THEN THE Logging_System SHALL validate data format before persistence
5. THE Logging_System SHALL prevent duplicate log entries for the same event
