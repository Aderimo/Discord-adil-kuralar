"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export interface BreadcrumbItem {
  /** Breadcrumb öğesinin etiketi */
  label: string;
  /** Breadcrumb öğesinin linki */
  href: string;
}

export interface BreadcrumbProps {
  /** Breadcrumb öğeleri dizisi */
  items: BreadcrumbItem[];
  /** Ana sayfa ikonu gösterilsin mi */
  showHomeIcon?: boolean;
}

/**
 * Breadcrumb bileşeni - Dinamik navigasyon yolu gösterimi
 * Requirement 12.4: Breadcrumb navigasyonu sunmalı
 * 
 * @example
 * <Breadcrumb items={[
 *   { label: "Ana Sayfa", href: "/" },
 *   { label: "Cezalar", href: "/penalties" },
 *   { label: "Yazılı Cezalar", href: "/penalties/yazili" }
 * ]} />
 */
export function Breadcrumb({ items, showHomeIcon = true }: BreadcrumbProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav 
      aria-label="Breadcrumb navigasyonu" 
      className="flex items-center text-sm"
    >
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          return (
            <Fragment key={`${item.href}-${index}`}>
              <li className="flex items-center">
                {isLast ? (
                  <span 
                    className="text-discord-text font-medium"
                    aria-current="page"
                  >
                    {showHomeIcon && isFirst ? (
                      <span className="flex items-center gap-1.5">
                        <Home className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                    ) : (
                      item.label
                    )}
                  </span>
                ) : (
                  <Link
                    href={item.href as any}
                    className="text-discord-muted hover:text-discord-accent transition-colors"
                  >
                    {showHomeIcon && isFirst ? (
                      <span className="flex items-center gap-1.5">
                        <Home className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                    ) : (
                      item.label
                    )}
                  </Link>
                )}
              </li>
              
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="h-4 w-4 text-discord-muted mx-1" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
