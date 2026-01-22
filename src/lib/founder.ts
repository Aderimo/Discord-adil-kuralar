// Founder Configuration - Site Kurucusu Ayarları
// Bu dosya sadece bir kez oluşturulur ve değiştirilmemelidir

/**
 * Site kurucusu bilgileri
 * SADECE bu kullanıcı başka kullanıcılara owner rolü atayabilir
 * Diğer owner'lar bu yetkiye sahip değildir
 */
export const FOUNDER_CONFIG = {
    email: 'esenyurtcocg65@gmail.com',
    username: 'Aderimo',
} as const;

/**
 * Kullanıcının site kurucusu olup olmadığını kontrol eder
 * @param email - Kontrol edilecek kullanıcı email adresi
 * @returns Site kurucusu ise true
 */
export function isFounder(email: string | null | undefined): boolean {
    if (!email) return false;
    return email.toLowerCase() === FOUNDER_CONFIG.email.toLowerCase();
}

/**
 * Kullanıcının owner rolünü yönetip yönetemeyeceğini kontrol eder
 * Sadece site kurucusu owner rolü atayabilir veya kaldırabilir
 * @param userEmail - İşlemi yapan kullanıcının email adresi
 * @param targetRoleCode - Atanmak/kaldırılmak istenen rol kodu
 * @returns Owner yönetimi yapabilir ise true
 */
export function canManageOwnerRole(
    userEmail: string | null | undefined,
    targetRoleCode: string
): boolean {
    // Eğer owner rolü ile ilgili bir işlem değilse, izin ver
    if (targetRoleCode !== 'owner') {
        return true;
    }

    // Owner rolü için sadece site kurucusu izinli
    return isFounder(userEmail);
}

/**
 * Kullanıcı silme/düzenleme izni kontrolü
 * Owner kullanıcıları sadece founder silebilir/düzenleyebilir
 * @param actorEmail - İşlemi yapan kullanıcının email adresi  
 * @param targetRoleCode - Hedef kullanıcının rol kodu
 * @returns İşlem yapabilir ise true
 */
export function canModifyUserWithRole(
    actorEmail: string | null | undefined,
    targetRoleCode: string | null | undefined
): boolean {
    // Eğer hedef owner değilse, normal yetki kontrolleri geçerli
    if (targetRoleCode !== 'owner') {
        return true;
    }

    // Owner kullanıcıları sadece founder düzenleyebilir
    return isFounder(actorEmail);
}
