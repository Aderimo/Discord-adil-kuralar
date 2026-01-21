/**
 * Breadcrumb Bileşeni Unit Testleri
 * 
 * Bu testler Breadcrumb bileşeninin doğru çalıştığını doğrular.
 * Validates: Requirements 12.4
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Breadcrumb, BreadcrumbItem } from "@/components/navigation/Breadcrumb";

// Next.js Link bileşenini mock'la
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
  return MockLink;
});

describe("Breadcrumb Bileşeni", () => {
  describe("Temel Render", () => {
    it("boş items dizisi ile null döndürmeli", () => {
      const { container } = render(<Breadcrumb items={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("tek öğe ile doğru render etmeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      // Son öğe olduğu için tıklanamaz olmalı (span)
      const element = screen.getByText("Ana Sayfa");
      expect(element).toBeInTheDocument();
      expect(element.closest("a")).toBeNull(); // Link olmamalı
    });

    it("birden fazla öğe ile doğru render etmeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Cezalar", href: "/penalties" },
        { label: "Yazılı Cezalar", href: "/penalties/yazili" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      // İlk iki öğe tıklanabilir link olmalı
      const homeLink = screen.getByRole("link", { name: /Ana Sayfa/i });
      expect(homeLink).toHaveAttribute("href", "/");
      
      const penaltiesLink = screen.getByRole("link", { name: /Cezalar/i });
      expect(penaltiesLink).toHaveAttribute("href", "/penalties");
      
      // Son öğe tıklanamaz olmalı
      const lastItem = screen.getByText("Yazılı Cezalar");
      expect(lastItem.closest("a")).toBeNull();
    });
  });

  describe("Tıklanabilirlik", () => {
    it("son öğe hariç tüm öğeler tıklanabilir olmalı", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Komutlar", href: "/commands" },
        { label: "Moderasyon", href: "/commands/moderation" },
        { label: "Ban Komutu", href: "/commands/moderation/ban" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      // İlk 3 öğe link olmalı
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(3);
      
      // Son öğe link olmamalı
      const lastItem = screen.getByText("Ban Komutu");
      expect(lastItem.closest("a")).toBeNull();
    });

    it("son öğe aria-current='page' attribute'una sahip olmalı", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Mevcut Sayfa", href: "/current" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      const currentPage = screen.getByText("Mevcut Sayfa");
      expect(currentPage).toHaveAttribute("aria-current", "page");
    });
  });

  describe("Ayırıcılar", () => {
    it("öğeler arasında ChevronRight ayırıcı göstermeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Cezalar", href: "/penalties" },
        { label: "ADK", href: "/penalties/adk" }
      ];
      
      const { container } = render(<Breadcrumb items={items} />);
      
      // 3 öğe için 2 ayırıcı olmalı (SVG ikonları)
      const separatorSvgs = container.querySelectorAll('li[aria-hidden="true"] svg');
      expect(separatorSvgs).toHaveLength(2);
    });

    it("son öğeden sonra ayırıcı göstermemeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Son Sayfa", href: "/last" }
      ];
      
      const { container } = render(<Breadcrumb items={items} />);
      
      // Sadece 1 ayırıcı olmalı (2 öğe arasında)
      const separatorSvgs = container.querySelectorAll('li[aria-hidden="true"] svg');
      expect(separatorSvgs).toHaveLength(1);
    });
  });

  describe("Erişilebilirlik", () => {
    it("nav elementi aria-label içermeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "Breadcrumb navigasyonu");
    });

    it("ordered list (ol) kullanmalı", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Sayfa", href: "/page" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      const list = screen.getByRole("list");
      expect(list.tagName).toBe("OL");
    });
  });

  describe("Ana Sayfa İkonu", () => {
    it("showHomeIcon=true ile ilk öğede Home ikonu göstermeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Cezalar", href: "/penalties" }
      ];
      
      render(<Breadcrumb items={items} showHomeIcon={true} />);
      
      // Home ikonu SVG olarak render edilmeli
      const homeLink = screen.getByRole("link", { name: /Ana Sayfa/i });
      const svg = homeLink.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("showHomeIcon=false ile Home ikonu göstermemeli", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Cezalar", href: "/penalties" }
      ];
      
      render(<Breadcrumb items={items} showHomeIcon={false} />);
      
      const homeLink = screen.getByRole("link", { name: /Ana Sayfa/i });
      const svg = homeLink.querySelector("svg");
      expect(svg).toBeNull();
    });
  });

  describe("Gerçek Kullanım Senaryoları", () => {
    it("Ceza sayfası breadcrumb örneği", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Cezalar", href: "/penalties" },
        { label: "Yazılı Cezalar", href: "/penalties/yazili" },
        { label: "ADK Cezası", href: "/penalties/yazili/adk" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      // Tüm öğeler görünür olmalı
      expect(screen.getByText(/Ana Sayfa/i)).toBeInTheDocument();
      expect(screen.getByText("Cezalar")).toBeInTheDocument();
      expect(screen.getByText("Yazılı Cezalar")).toBeInTheDocument();
      expect(screen.getByText("ADK Cezası")).toBeInTheDocument();
      
      // Son öğe hariç hepsi link
      expect(screen.getAllByRole("link")).toHaveLength(3);
    });

    it("Komut sayfası breadcrumb örneği", () => {
      const items: BreadcrumbItem[] = [
        { label: "Ana Sayfa", href: "/" },
        { label: "Komutlar", href: "/commands" },
        { label: "Mute Komutu", href: "/commands/mute" }
      ];
      
      render(<Breadcrumb items={items} />);
      
      expect(screen.getByText(/Ana Sayfa/i)).toBeInTheDocument();
      expect(screen.getByText("Komutlar")).toBeInTheDocument();
      expect(screen.getByText("Mute Komutu")).toBeInTheDocument();
    });
  });
});
