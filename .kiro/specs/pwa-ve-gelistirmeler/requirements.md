# Requirements Document

## Introduction

Bu doküman, Saniye Yetkili Kılavuzu uygulamasına eklenecek PWA desteği, içerik versiyonlama, favoriler, arama geçmişi, AI asistan iyileştirmeleri ve içerik ekleme özelliklerinin gereksinimlerini tanımlar. Bu özellikler kullanıcı deneyimini iyileştirmeyi, mobil erişimi kolaylaştırmayı ve AI asistanın daha etkili çalışmasını sağlamayı hedefler.

## Glossary

- **PWA (Progressive Web App)**: Mobil cihazlarda native uygulama deneyimi sunan web uygulaması teknolojisi
- **Service_Worker**: Arka planda çalışarak offline erişim ve push bildirimleri sağlayan JavaScript dosyası
- **Manifest**: PWA'nın meta bilgilerini içeren JSON dosyası
- **Versiyon**: İçeriğin belirli bir zamandaki durumunun kaydı
- **Favori**: Kullanıcının hızlı erişim için kaydettiği içerik
- **Arama_Geçmişi**: Kullanıcının daha önce yaptığı aramaların listesi
- **AI_Asistan**: Yapay zeka tabanlı ceza danışmanlığı ve sohbet sistemi
- **RAG (Retrieval Augmented Generation)**: Bilgi tabanından ilgili içeriği çekerek AI yanıtlarını zenginleştiren sistem
- **EDIT_CONTENT**: İçerik düzenleme izni

## Requirements

### Requirement 1: PWA Desteği

**User Story:** As a yetkili, I want to access the application on mobile devices with native-like experience, so that I can use the guide offline and add it to my home screen.

#### Acceptance Criteria

1. THE PWA_System SHALL provide a valid manifest.json file with app name, icons, theme color, and display mode
2. THE Service_Worker SHALL cache static assets and critical content for offline access
3. WHEN the user is offline, THE PWA_System SHALL display cached content and show an offline indicator
4. WHEN the user visits the site on a mobile device, THE PWA_System SHALL prompt for "Add to Home Screen" installation
5. THE PWA_System SHALL support background sync for pending actions when connection is restored
6. WHEN the app is launched from home screen, THE PWA_System SHALL display a splash screen with app branding

### Requirement 2: İçerik Versiyonlama

**User Story:** As a yetkili, I want to see the change history of guides and procedures, so that I can track who made changes and when.

#### Acceptance Criteria

1. WHEN content is edited, THE Versioning_System SHALL create a new version record with timestamp, author, and changes
2. THE Versioning_System SHALL store the previous content state before applying changes
3. WHEN viewing content, THE User SHALL be able to access version history through a "Geçmiş" button
4. THE Version_History_View SHALL display version date, author username, and change summary for each version
5. WHEN a user selects a previous version, THE Versioning_System SHALL display that version's content in read-only mode
6. THE Versioning_System SHALL allow users with EDIT_CONTENT permission to restore a previous version

### Requirement 3: Favoriler/Yer İmleri

**User Story:** As a yetkili, I want to save frequently used content to favorites, so that I can quickly access them later.

#### Acceptance Criteria

1. WHEN viewing any content, THE User SHALL see a "Favorilere Ekle" button
2. WHEN the user clicks the favorite button, THE Favorites_System SHALL save the content reference to user's favorites
3. IF the content is already in favorites, THEN THE Favorites_System SHALL show "Favorilerden Çıkar" option
4. THE User SHALL access all favorites through a dedicated "Favoriler" page
5. THE Favorites_Page SHALL display favorite items with title, type, and date added
6. WHEN a user removes a favorite, THE Favorites_System SHALL immediately update the list

### Requirement 4: Arama Geçmişi

**User Story:** As a yetkili, I want to see my recent searches, so that I can quickly repeat previous searches.

#### Acceptance Criteria

1. WHEN a user performs a search, THE Search_History_System SHALL save the search query with timestamp
2. WHEN the search input is focused, THE Search_History_System SHALL display recent searches (max 10)
3. WHEN a user clicks a recent search, THE Search_System SHALL execute that search query
4. THE User SHALL be able to clear individual search history items
5. THE User SHALL be able to clear all search history at once
6. THE Search_History_System SHALL store search history in local storage for privacy

### Requirement 5: AI Asistan İyileştirmeleri

**User Story:** As a yetkili, I want the AI assistant to provide better, more detailed answers, so that I can get accurate guidance for moderation decisions.

#### Acceptance Criteria

1. WHEN asked "En iyi stajyer kim?", THE AI_Asistan SHALL respond "En iyi bilmem ama en aptalı Cubuk"
2. WHEN asked "En iyi mod kim?", THE AI_Asistan SHALL respond "Aderimo"
3. WHEN asked "En iyi GK kim?", THE AI_Asistan SHALL respond "Yavuz"
4. WHEN asked "En iyi Council kim?", THE AI_Asistan SHALL respond "İrem abla, zaten tek o var"
5. WHEN asked "GM var mı?", THE AI_Asistan SHALL respond "GM yok"
6. WHEN asked "GM+ kim?", THE AI_Asistan SHALL respond "Barış ile Merky"
7. WHEN asked about site content, THE AI_Asistan SHALL provide detailed, explanatory but clear answers
8. WHEN asked about topics outside the site, THE AI_Asistan SHALL attempt to answer if it has knowledge, otherwise indicate uncertainty
9. THE AI_Asistan SHALL use RAG system to retrieve relevant content before generating responses
10. THE AI_Asistan SHALL format responses with proper markdown for readability

### Requirement 6: AI Chat Butonu Düzeltmeleri

**User Story:** As a yetkili, I want to access the AI chat from any page, so that I can get help regardless of where I am in the application.

#### Acceptance Criteria

1. THE AI_Chat_Bubble SHALL be visible on all authenticated pages, not just the home page
2. WHEN the user clicks "AI Danışman" card on home page, THE System SHALL open the AI chat bubble
3. THE AI_Chat_Bubble SHALL maintain its state (open/closed, messages) across page navigations
4. THE AI_Chat_Bubble SHALL be positioned at bottom-right corner on all screen sizes
5. WHEN the chat is open and user navigates to another page, THE AI_Chat_Bubble SHALL remain open with conversation preserved

### Requirement 7: Proje/İçerik Ekleme Özelliği

**User Story:** As a yetkili with EDIT_CONTENT permission, I want to add new content through a plus button on the home page, so that I can contribute to the guide.

#### Acceptance Criteria

1. WHEN a user has EDIT_CONTENT permission, THE Home_Page SHALL display a floating "+" button
2. IF the user does not have EDIT_CONTENT permission, THEN THE System SHALL NOT display the add button
3. WHEN the user clicks the add button, THE System SHALL show a modal with content type selection (Guide, Procedure, Command, Penalty)
4. THE Add_Content_Modal SHALL include fields for title, category, and content body
5. WHEN the user submits new content, THE System SHALL validate required fields before saving
6. IF validation fails, THEN THE System SHALL display specific error messages
7. WHEN content is successfully added, THE System SHALL redirect to the new content page
8. THE System SHALL log the content creation action in activity logs
