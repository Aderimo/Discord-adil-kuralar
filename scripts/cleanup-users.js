const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FOUNDER_EMAIL = 'esenyurtcocg65@gmail.com';

async function main() {
  // Founder dışındaki tüm kullanıcıları bul
  const usersToDelete = await prisma.user.findMany({
    where: {
      email: { not: FOUNDER_EMAIL }
    },
    select: { id: true, email: true, username: true }
  });

  console.log('Silinecek kullanıcılar:');
  usersToDelete.forEach(u => console.log(`  - ${u.username} (${u.email})`));

  if (usersToDelete.length === 0) {
    console.log('Silinecek kullanıcı yok.');
    return;
  }

  // İlişkili verileri sil
  const userIds = usersToDelete.map(u => u.id);

  // Sessions
  const deletedSessions = await prisma.session.deleteMany({
    where: { userId: { in: userIds } }
  });
  console.log(`${deletedSessions.count} oturum silindi.`);

  // Activity logs
  const deletedLogs = await prisma.activityLog.deleteMany({
    where: { userId: { in: userIds } }
  });
  console.log(`${deletedLogs.count} aktivite logu silindi.`);

  // Notifications
  const deletedNotifications = await prisma.notification.deleteMany({
    where: { userId: { in: userIds } }
  });
  console.log(`${deletedNotifications.count} bildirim silindi.`);

  // Users
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: userIds } }
  });
  console.log(`${deletedUsers.count} kullanıcı silindi.`);

  // Kalan kullanıcıları göster
  const remainingUsers = await prisma.user.findMany({
    include: { role: true }
  });
  console.log('\nKalan kullanıcılar:');
  remainingUsers.forEach(u => console.log(`  - ${u.username} (${u.email}) - ${u.role?.name || 'Rol yok'}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
