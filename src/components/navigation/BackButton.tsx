"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BackButtonProps {
  /** Varsayılan geri URL (history yoksa) */
  fallbackUrl?: string;
  /** Buton metni */
  label?: string;
}

/**
 * BackButton bileşeni - Tarayıcı history'si varsa geri gider,
 * yoksa fallbackUrl'e yönlendirir.
 * 
 * @example
 * // Varsayılan kullanım (ana sayfaya fallback)
 * <BackButton />
 * 
 * @example
 * // Özel fallback URL ile
 * <BackButton fallbackUrl="/penalties" label="Cezalara Dön" />
 */
export function BackButton({ 
  fallbackUrl = "/", 
  label = "Geri" 
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    // Tarayıcı history'sinde önceki sayfa var mı kontrol et
    // window.history.length > 1 ise history var demektir
    if (typeof window !== "undefined" && window.history.length > 1) {
      // History'de önceki sayfa varsa geri git
      router.back();
    } else {
      // History yoksa fallback URL'e yönlendir
      window.location.href = fallbackUrl;
    }
  }, [router, fallbackUrl]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="gap-2 text-discord-muted hover:text-discord-text"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}

export default BackButton;
