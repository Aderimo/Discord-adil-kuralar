// Founder kullanıcısını owner olarak ayarla
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setFounderAsOwner() {
    console.log('🔍 Founder ayarlama işlemi başlıyor...');

    // Owner rolünü bul
    const ownerRole = await prisma.role.findUnique({
        where: { code: 'owner' },
    });

    if (!ownerRole) {
        console.log('❌ Owner rolü bulunamadı! Önce seed çalıştırın.');
        return;
    }

    console.log(`✅ Owner rolü bulundu: ${ownerRole.id}`);

    // Founder kullanıcısını bul
    const founderEmail = 'esenyurtcocg65@gmail.com';
    const user = await prisma.user.findFirst({
        where: { email: founderEmail },
    });

    if (!user) {
        console.log(`❌ Kullanıcı bulunamadı: ${founderEmail}`);
        console.log('💡 Lütfen önce bu email ile kayıt olun.');
        return;
    }

    console.log(`✅ Kullanıcı bulundu: ${user.username} (${user.email})`);

    // Kullanıcıyı owner olarak güncelle
    await prisma.user.update({
        where: { id: user.id },
        data: {
            roleId: ownerRole.id,
            status: 'approved',
        },
    });

    console.log(`🎉 ${user.username} artık Owner!`);
}

setFounderAsOwner()
    .catch((e) => {
        console.error('❌ Hata:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
