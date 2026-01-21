'use client';

/**
 * Global Error - Root Layout Hata Sayfası
 * 
 * Root layout'ta oluşan hataları yakalayan global error boundary.
 * html ve body etiketlerini içermesi zorunludur.
 * Discord dark theme stilinde tasarlanmıştır.
 * 
 * @requirement Hata yönetimi - Genel hata boundary
 */

import React, { useEffect } from 'react';

// Hata ikonu SVG
function ErrorIcon({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps): React.ReactElement {
  useEffect(() => {
    // Hatayı konsola logla (production'da error tracking servisine gönderilebilir)
    console.error('Global hata:', error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1e1f22' }}>
        <div 
          className="w-full max-w-md rounded-lg border p-6"
          style={{ 
            backgroundColor: '#2b2d31', 
            borderColor: '#3f4147' 
          }}
        >
          {/* Header */}
          <div className="space-y-4 text-center pb-4">
            {/* Hata ikonu */}
            <div className="flex justify-center">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(237, 66, 69, 0.1)' }}
              >
                <ErrorIcon className="w-10 h-10" style={{ color: '#ed4245' }} />
              </div>
            </div>
            
            <h1 
              className="text-xl font-bold"
              style={{ color: '#f2f3f5' }}
            >
              Kritik Hata Oluştu
            </h1>
            
            <p 
              className="text-sm"
              style={{ color: '#949ba4' }}
            >
              Hata Kodu: Global Error
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4 text-center">
            <div 
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(64, 68, 75, 0.5)' }}
            >
              <p 
                className="text-sm leading-relaxed"
                style={{ color: '#f2f3f5' }}
              >
                Uygulamada{' '}
                <span className="font-medium" style={{ color: '#ed4245' }}>kritik bir hata</span>{' '}
                oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
              </p>
            </div>

            {error.digest && (
              <div 
                className="p-3 rounded-lg border"
                style={{ 
                  backgroundColor: '#1e1f22', 
                  borderColor: '#3f4147' 
                }}
              >
                <p 
                  className="text-xs font-mono"
                  style={{ color: '#949ba4' }}
                >
                  Hata ID: {error.digest}
                </p>
              </div>
            )}

            <div className="space-y-2 text-left">
              <p className="text-sm" style={{ color: '#949ba4' }}>
                <span style={{ color: '#5865f2' }}>•</span>{' '}
                Sayfayı yenilemeyi deneyin
              </p>
              <p className="text-sm" style={{ color: '#949ba4' }}>
                <span style={{ color: '#5865f2' }}>•</span>{' '}
                Tarayıcı önbelleğini temizleyin
              </p>
              <p className="text-sm" style={{ color: '#949ba4' }}>
                <span style={{ color: '#5865f2' }}>•</span>{' '}
                Sorun devam ederse yöneticiye bildirin
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col space-y-3 pt-4">
            <button
              onClick={reset}
              className="w-full py-2 px-4 rounded-md font-medium transition-colors"
              style={{ 
                backgroundColor: '#5865f2', 
                color: '#ffffff' 
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(88, 101, 242, 0.9)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#5865f2'}
            >
              Tekrar Dene
            </button>
            
            <p 
              className="text-xs text-center"
              style={{ color: '#949ba4' }}
            >
              SANIYE MODLARI Yetkili Kılavuzu
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
