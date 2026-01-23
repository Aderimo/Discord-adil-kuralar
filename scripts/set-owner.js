const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OWNER_EMAIL = 'esenyurtcocg65@gmail.com';

async function main() {
  // Owner rolünü bul
  const ownerRole = await prisma.role.findUnique({
    where: { code: 'owner' }
  });

  if (!ownerRole) {
    console.error('Owner rolü bulunamadı!');
    return;
  }

  // Kullanıcıyı owner yap
  const user = await prisma.user.update({
    where: { email: OWNER_EMAIL },
    data: { 
      roleId: ownerRole.id,
      status: 'approved'
    },
    include: { role: true }
  });

  console.log('Kullanıcı owner olarak ayarlandı:');
  console.log('Email:', user.email);
  console.log('Username:', user.username);
  console.log('Role:', user.role?.name);
  console.log('Status:', user.status);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
