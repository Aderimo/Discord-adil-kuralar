const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'esenyurtcocg65@gmail.com';
  const newPassword = 'Hamzacan123';
  
  console.log(`🔐 Resetting password for ${email}...`);
  
  // Şifreyi hashle
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  // Kullanıcıyı güncelle
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
    include: { role: true }
  });
  
  console.log(`✅ Password updated for user: ${user.username}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Status: ${user.status}`);
  console.log(`   Role: ${user.role?.name || 'None'}`);
  console.log(`\n🔑 New password: ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
