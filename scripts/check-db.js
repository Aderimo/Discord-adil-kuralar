const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'esenyurtcocg65@gmail.com' },
    include: { role: true }
  });
  console.log('User:', JSON.stringify(user, null, 2));
  
  const roles = await prisma.role.findMany();
  console.log('Roles:', JSON.stringify(roles, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
