const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'esenyurtcocg65@gmail.com' },
    include: { role: true }
  });
  
  console.log('User:', JSON.stringify(user, null, 2));
  
  // Tüm kullanıcıları listele
  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, email: true, status: true }
  });
  console.log('\nAll users:', JSON.stringify(allUsers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
