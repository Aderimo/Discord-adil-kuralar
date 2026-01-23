/**
 * Founder (Site Kurucusu) Koruması
 * 
 * Bu dosya site kurucusunun email adresini tanımlar.
 * Founder'ın rolü hiçbir şekilde değiştirilemez ve her zaman owner olarak kalır.
 */

// Site kurucusu email adresi
export const FOUNDER_EMAIL = 'esenyurtcocg65@gmail.com';

/**
 * Verilen email'in founder olup olmadığını kontrol eder
 */
export function isFounder(email: string): boolean {
  return email === FOUNDER_EMAIL;
}

/**
 * Bir kullanıcının owner rolünü yönetip yönetemeyeceğini kontrol eder
 * Sadece founder owner rolünü atayabilir
 */
export function canManageOwnerRole(userEmail: string): boolean {
  return isFounder(userEmail);
}

/**
 * Founder'ın rolünü kontrol eder ve gerekirse düzeltir
 * Bu fonksiyon login sırasında çağrılabilir
 */
export async function ensureFounderRole(prisma: {
  role: {
    findUnique: (args: { where: { code: string } }) => Promise<{ id: string } | null>;
  };
  user: {
    update: (args: { where: { email: string }; data: { roleId: string } }) => Promise<unknown>;
  };
}): Promise<void> {
  const ownerRole = await prisma.role.findUnique({
    where: { code: 'owner' },
  });

  if (ownerRole) {
    await prisma.user.update({
      where: { email: FOUNDER_EMAIL },
      data: { roleId: ownerRole.id },
    });
  }
}
