const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up test users...');
  
  // Test kullanıcılarını sil (system ve esenyurtcocg65@gmail.com hariç)
  const deleted = await prisma.user.deleteMany({
    where: {
      email: {
        notIn: ['esenyurtcocg65@gmail.com', 'system@yetkili-kilavuzu.local']
      }
    }
  });
  console.log(`  ✅ Deleted ${deleted.count} test users`);

  // Rolleri kontrol et ve yoksa oluştur
  console.log('\n🔧 Checking roles...');
  const ownerRole = await prisma.role.findUnique({
    where: { code: 'owner' }
  });

  if (!ownerRole) {
    console.log('  ⚠️ Owner role not found, creating...');
    await prisma.role.create({
      data: {
        code: 'owner',
        name: 'Owner',
        shortName: 'OWNER',
        hierarchy: 7,
        color: '#FFFFFF',
        description: 'Site kurucusu ve yardımcılarına verilir. Tüm yetkilere sahiptir.',
        permissions: JSON.stringify([
          'VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT',
          'VIEW_USERS', 'EDIT_USERS', 'DELETE_USERS',
          'VIEW_LOGS', 'VIEW_NOTIFICATIONS', 'EDIT_TEMPLATES', 'MANAGE_ROLES'
        ]),
        isSystem: true
      }
    });
    console.log('  ✅ Owner role created');
  } else {
    console.log('  ✅ Owner role exists');
  }

  // Owner rolünü tekrar al
  const role = await prisma.role.findUnique({
    where: { code: 'owner' }
  });

  // esenyurtcocg65@gmail.com kullanıcısını kontrol et
  console.log('\n👑 Setting up owner user...');
  const existingUser = await prisma.user.findUnique({
    where: { email: 'esenyurtcocg65@gmail.com' }
  });

  if (existingUser) {
    // Kullanıcı varsa, owner yap ve onayla
    await prisma.user.update({
      where: { email: 'esenyurtcocg65@gmail.com' },
      data: {
        roleId: role.id,
        status: 'approved'
      }
    });
    console.log(`  ✅ Updated existing user "${existingUser.username}" to Owner`);
  } else {
    // Kullanıcı yoksa oluştur
    const passwordHash = await bcrypt.hash('Owner2024!', 10);
    await prisma.user.create({
      data: {
        username: 'Aderimo',
        email: 'esenyurtcocg65@gmail.com',
        passwordHash,
        status: 'approved',
        roleId: role.id
      }
    });
    console.log('  ✅ Created owner user: Aderimo (esenyurtcocg65@gmail.com)');
    console.log('  📝 Default password: Owner2024!');
  }

  // Sonucu göster
  console.log('\n📊 Current users:');
  const users = await prisma.user.findMany({
    include: { role: true },
    select: {
      id: true,
      username: true,
      email: true,
      status: true,
      role: { select: { code: true, name: true } }
    }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('\n🎉 Setup complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
