// Prisma Seed Script - Varsayılan roller
// Bu script veritabanına varsayılan rolleri ekler

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultRoles = [
  {
    code: 'reg',
    name: 'Regülatör',
    shortName: 'REG',
    hierarchy: 1,
    color: '#57F287', // Yeşil
    description:
      'Stajyerlik sürecini tamamlayarak kadroya geçmiş ana regülatör rolü. Öncelikli olarak sesli kanallar ve genel sunucuyu gözlemleyip denetler. Olumsuzlukları ve gelen şikayetleri güvenilir, kanıtlı ve işlem uygulanabilir şekilde üst moderatör ekibine iletir. Sunucunun kalabalığında gelen sahte şikayetlerin arasında doğru raporları filtreleyen önemli bir rol üstlenir.',
    permissions: JSON.stringify(['VIEW_CONTENT']),
    isSystem: true,
  },
  {
    code: 'op',
    name: 'Operatör',
    shortName: 'OP',
    hierarchy: 2,
    color: '#3498DB', // Mavi
    description:
      'Ana operatör rolü. Sunucudaki sesli ve yazılı kanalları denetleyen, gerektiğinde işlem uygulayabilen yetkililerdir. Sunucu hakkındaki konularda danışılabilecek, genel sunucu düzenini sağlamak ve şikayetleri değerlendirmekle sorumlu kişilerdir. Bir sorun yaşadığın zaman yüksek rütbelerden ziyade bu rütbedeki yetkililere danışman önerilir.',
    permissions: JSON.stringify(['VIEW_CONTENT', 'EDIT_CONTENT']),
    isSystem: true,
  },
  {
    code: 'gk',
    name: 'GateKeeper',
    shortName: 'GK',
    hierarchy: 3,
    color: '#E67E22', // Turuncu
    description:
      'Operatörlerin bir üstü olup sunucudan yasaklama yetkisine sahiptir. Operatörlerin ilettiği kullanıcıları uzaklaştırır ve genel moderasyon işlemlerinin doğruluğunu denetleyerek düzenin korunmasına yardımcı olur.',
    permissions: JSON.stringify(['VIEW_CONTENT', 'EDIT_CONTENT', 'VIEW_USERS']),
    isSystem: true,
  },
  {
    code: 'council',
    name: 'Council',
    shortName: 'COUNCIL',
    hierarchy: 4,
    color: '#9B59B6', // Mor
    description:
      'GateKeeper ve Operatörlerin Supervisor\'ı/gözetmeni gibi düşünebilirsiniz. Kararsız kalınan işlemlerde sunucu kurallarına göre doğru işlemi ve süreyi belirlemede yardımcı olur.',
    permissions: JSON.stringify([
      'VIEW_CONTENT',
      'EDIT_CONTENT',
      'VIEW_USERS',
      'EDIT_USERS',
    ]),
    isSystem: true,
  },
  {
    code: 'gm',
    name: 'GM',
    shortName: 'GM',
    hierarchy: 5,
    color: '#E74C3C', // Kırmızı
    description:
      'GM+\'dan tek farkı yönetici yetkisi yoktur. Sunucunun genel yönetimiyle ilgilenir.',
    permissions: JSON.stringify([
      'VIEW_CONTENT',
      'EDIT_CONTENT',
      'VIEW_USERS',
      'EDIT_USERS',
      'VIEW_LOGS',
    ]),
    isSystem: true,
  },
  {
    code: 'gm_plus',
    name: '🔖 GM+',
    shortName: 'GM+',
    hierarchy: 6,
    color: '#F1C40F', // Altın
    description:
      'Owner\'dan sonraki en yüksek yetkili roldür. Sunucunun genel yönetimiyle ilgilenir.',
    permissions: JSON.stringify([
      'VIEW_CONTENT',
      'EDIT_CONTENT',
      'DELETE_CONTENT',
      'VIEW_USERS',
      'EDIT_USERS',
      'VIEW_LOGS',
      'VIEW_NOTIFICATIONS',
      'EDIT_TEMPLATES',
    ]),
    isSystem: true,
  },
  {
    code: 'owner',
    name: 'Owner',
    shortName: 'OWNER',
    hierarchy: 7,
    color: '#FFFFFF', // Beyaz
    description:
      'Site kurucusu ve yardımcılarına verilir. Tüm yetkilere sahiptir.',
    permissions: JSON.stringify([
      'VIEW_CONTENT',
      'EDIT_CONTENT',
      'DELETE_CONTENT',
      'VIEW_USERS',
      'EDIT_USERS',
      'DELETE_USERS',
      'VIEW_LOGS',
      'VIEW_NOTIFICATIONS',
      'EDIT_TEMPLATES',
      'MANAGE_ROLES',
    ]),
    isSystem: true,
  },
];

async function main() {
  console.log('🌱 Seeding database with default roles...');

  for (const role of defaultRoles) {
    const existingRole = await prisma.role.findUnique({
      where: { code: role.code },
    });

    if (existingRole) {
      console.log(`  ⏭️  Role "${role.name}" already exists, skipping...`);
      continue;
    }

    await prisma.role.create({
      data: role,
    });
    console.log(`  ✅ Created role: ${role.name} (${role.shortName})`);
  }

  // Founder/Owner kullanıcısını ayarla
  // Requirement 11.9: esenyurtcocg65@gmail.com (Aderimo) owner olarak ayarlanmalı
  console.log('\n👑 Setting up founder/owner user...');
  
  const founderEmail = 'esenyurtcocg65@gmail.com';
  
  const ownerRole = await prisma.role.findUnique({
    where: { code: 'owner' },
  });

  if (!ownerRole) {
    console.log('  ❌ Owner role not found, skipping founder setup...');
  } else {
    const existingFounder = await prisma.user.findUnique({
      where: { email: founderEmail },
    });

    if (existingFounder) {
      // Kullanıcı varsa, owner rolünü ata ve onayla
      await prisma.user.update({
        where: { email: founderEmail },
        data: {
          roleId: ownerRole.id,
          status: 'approved',
        },
      });
      console.log(`  ✅ Updated existing user "${existingFounder.username}" to Owner role`);
    } else {
      console.log(`  ℹ️  Founder user "${founderEmail}" not found. Will be set as owner when registered.`);
    }
  }

  console.log('\n🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
