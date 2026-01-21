"use client";

/**
 * AI Chat Bubble Bileşeni
 * Sağ alt köşede floating button ve açılır sohbet penceresi
 *
 * Requirements: 6.1, 6.2, 7.1, 7.3
 * - AI ceza sorusu için site içeriğinden doğru ceza süresini bulup yanıtlamalı
 * - Kullanıcı mesajı stili (farklı renk ve pozisyon)
 * - Asistan mesajı stili (bot avatarı ile)
 * - Ceza kaydı kartı (kopyala butonu ile)
 * - Yükleniyor durumu (spinner ve "Düşünüyor..." metni)
 */

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, Copy, Check, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
 * Chat mesajı
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  penaltyRecord?: PenaltyRecord | undefined;
}

/**
 * AI Chat Props
 */
export interface AIChatProps {
  /** Sohbet penceresinin açık olup olmadığı */
  isOpen: boolean;
  /** Açma/kapama toggle fonksiyonu */
  onToggle: () => void;
  /** Mesaj geçmişi */
  messages: ChatMessage[];
  /** Mesaj gönderme fonksiyonu */
  onSendMessage: (message: string) => Promise<void>;
  /** Yükleniyor durumu */
  isLoading?: boolean;
}

/**
 * Mesaj Bileşeni
 * Kullanıcı ve asistan mesajlarını farklı stillerle gösterir
 * Requirements: 6.2, 7.1, 7.3
 */
function ChatMessageItem({
  message,
  onCopyPenalty,
}: {
  message: ChatMessage;
  onCopyPenalty?: (text: string) => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const isUser = message.role === "user";

  const handleCopy = useCallback(async () => {
    if (message.penaltyRecord?.copyableText) {
      try {
        await navigator.clipboard.writeText(message.penaltyRecord.copyableText);
        setCopied(true);
        onCopyPenalty?.(message.penaltyRecord.copyableText);
        
        // Toast bildirimi göster
        toast({
          title: "Kopyalandı!",
          description: "Ceza kaydı panoya kopyalandı.",
          variant: "success",
        });
        
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Kopyalama hatası:", err);
        toast({
          title: "Kopyalama Hatası",
          description: "Ceza kaydı kopyalanamadı. Lütfen tekrar deneyin.",
          variant: "destructive",
        });
      }
    }
  }, [message.penaltyRecord, onCopyPenalty, toast]);

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg transition-colors",
        isUser 
          ? "bg-discord-accent/10 ml-8 border-l-2 border-discord-accent" 
          : "bg-discord-light mr-8 border-l-2 border-discord-green"
      )}
      data-testid={isUser ? "user-message" : "assistant-message"}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md",
          isUser ? "bg-discord-accent" : "bg-discord-green"
        )}
        aria-label={isUser ? "Kullanıcı avatarı" : "Bot avatarı"}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Mesaj İçeriği */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "text-sm font-medium",
            isUser ? "text-discord-accent" : "text-discord-green"
          )}>
            {isUser ? "Sen" : "AI Asistan"}
          </span>
          <span className="text-xs text-discord-muted">
            {message.timestamp.toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Mesaj Metni */}
        <div className="text-sm text-discord-text whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Ceza Kaydı Kartı - Requirements 7.1, 7.2, 7.3 */}
        {message.penaltyRecord && (
          <div 
            className="mt-3 p-4 bg-discord-darker rounded-lg border border-discord-accent/30 shadow-lg"
            data-testid="penalty-record-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-discord-accent" />
                <span className="text-sm font-semibold text-discord-accent">
                  Ceza Kaydı
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className={cn(
                  "h-7 px-3 text-xs transition-all",
                  copied 
                    ? "bg-discord-green/20 border-discord-green text-discord-green" 
                    : "hover:bg-discord-accent/20 hover:border-discord-accent"
                )}
                data-testid="copy-penalty-button"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Kopyala
                  </>
                )}
              </Button>
            </div>
            
            {/* Ceza Detayları - Requirements 7.2 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-discord-muted min-w-[60px]">İhlal:</span>
                <span className="text-discord-text font-medium">
                  {message.penaltyRecord.violation}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-discord-muted min-w-[60px]">Madde:</span>
                <span className="text-discord-yellow font-mono">
                  {message.penaltyRecord.article}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-discord-muted min-w-[60px]">Süre:</span>
                <span className="text-discord-red font-semibold">
                  {message.penaltyRecord.duration}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-discord-muted min-w-[60px]">Gerekçe:</span>
                <span className="text-discord-text">
                  {message.penaltyRecord.reason}
                </span>
              </div>
            </div>
            
            {/* Kopyalanabilir Metin Önizleme */}
            <div className="mt-3 pt-3 border-t border-discord-light">
              <p className="text-xs text-discord-muted mb-1">Kopyalanacak metin:</p>
              <pre className="text-xs text-discord-text bg-discord-dark p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {message.penaltyRecord.copyableText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Yükleniyor Göstergesi
 * Requirements: 6.2 - Yükleniyor durumu
 */
function LoadingIndicator(): React.ReactElement {
  return (
    <div 
      className="flex gap-3 p-3 rounded-lg bg-discord-light mr-8 border-l-2 border-discord-green animate-pulse"
      data-testid="loading-indicator"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-discord-green flex items-center justify-center shadow-md">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-discord-accent" />
        <span className="text-sm text-discord-muted">Düşünüyor...</span>
      </div>
    </div>
  );
}

/**
 * AI Chat Bubble Ana Bileşeni
 */
export function AIChatBubble({
  isOpen,
  onToggle,
  messages,
  onSendMessage,
  isLoading = false,
}: AIChatProps): React.ReactElement {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mesajlar değiştiğinde en alta scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Pencere açıldığında input'a focus
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Mesaj gönderme
  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      const trimmedValue = inputValue.trim();
      if (!trimmedValue || isLoading) {
        return;
      }

      setInputValue("");
      await onSendMessage(trimmedValue);
    },
    [inputValue, isLoading, onSendMessage]
  );

  // Enter tuşu ile gönderme
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed z-50 rounded-full shadow-lg",
          // Mobil: Daha küçük ve sağ alt köşede
          "bottom-4 right-4 w-12 h-12 sm:bottom-6 sm:right-6 sm:w-14 sm:h-14",
          "flex items-center justify-center transition-all duration-300",
          "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-discord-accent focus:ring-offset-2 focus:ring-offset-discord-darker",
          isOpen
            ? "bg-discord-red hover:bg-discord-red/90"
            : "bg-discord-accent hover:bg-discord-accent/90"
        )}
        aria-label={isOpen ? "Sohbeti kapat" : "AI Asistan'ı aç"}
      >
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        ) : (
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        )}
      </button>

      {/* Chat Penceresi */}
      <div
        className={cn(
          "fixed z-40",
          // Mobil: Tam genişlik, alt kısımda
          "bottom-0 left-0 right-0 sm:bottom-24 sm:left-auto sm:right-6",
          // Tablet ve üstü: Sabit genişlik
          "w-full sm:w-96 sm:max-w-[calc(100vw-3rem)]",
          "bg-discord-dark border-t sm:border border-discord-light sm:rounded-xl shadow-2xl",
          "flex flex-col overflow-hidden transition-all duration-300",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none sm:translate-y-4"
        )}
        style={{ 
          height: isOpen 
            ? "min(600px, calc(100vh - 4rem))" 
            : "0",
          maxHeight: "calc(100vh - 4rem)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-discord-lighter border-b border-discord-light">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-discord-green flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-discord-text">
                AI Ceza Danışmanı
              </h3>
              <p className="text-xs text-discord-muted">
                Yetkili Kılavuzu v2 tabanlı
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
            aria-label="Sohbeti kapat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Mesajlar Alanı */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <div className="w-16 h-16 rounded-full bg-discord-light flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-discord-accent" />
              </div>
              <h4 className="text-sm font-medium text-discord-text mb-2">
                AI Ceza Danışmanı
              </h4>
              <p className="text-xs text-discord-muted max-w-[250px]">
                Ceza soruları sorun, olay anlatın veya kılavuz hakkında bilgi
                isteyin. Yanıtlar Yetkili Kılavuzu v2&apos;ye dayanır.
              </p>
              <div className="mt-4 space-y-2 w-full">
                <p className="text-xs text-discord-muted">Örnek sorular:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "ADK cezası kaç gün?",
                    "Hakaret cezası nedir?",
                    "Spam yapan kullanıcıya ne yapmalıyım?",
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setInputValue(example);
                        inputRef.current?.focus();
                      }}
                      className="text-xs px-2 py-1 rounded-full bg-discord-light hover:bg-discord-lighter text-discord-text transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessageItem key={message.id} message={message} />
              ))}
              {isLoading && <LoadingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Alanı */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-discord-light bg-discord-lighter"
        >
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bir soru sorun..."
              disabled={isLoading}
              className="flex-1 bg-discord-dark"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

export default AIChatBubble;
