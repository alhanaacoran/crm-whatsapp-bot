require('dotenv').config();

const {
    getPendingRegistrations,
    updateRegistrationStatus,
    subscribeToNewRegistrations
} = require('./src/supabase');

const {
    initWhatsApp,
    sendMessage,
    onMessageReceived,
    formatPhoneNumber
} = require('./src/whatsapp');

// Configuration
const STATUS_CONFIRMED = process.env.STATUS_CONFIRMED || 'confirmed';
const STATUS_PENDING = process.env.STATUS_PENDING || 'pending';
const COLUMN_FIRSTNAME = process.env.COLUMN_FIRSTNAME || 'prenom';
const COLUMN_LASTNAME = process.env.COLUMN_LASTNAME || 'nom';
const COLUMN_PHONE = process.env.COLUMN_PHONE || 'telephone';

// Messages personnalisés pour Institut Alhanaa
const MESSAGES = {
    welcome: `السلام عليكم ورحمة الله وبركاته
أنا هاجر من مؤسسة الهناء لتعليم القرآن للنساء

يسعدنا خدمتك، المرجو إخبارنا بطلبك من خلال اختيار أحد الخيارات التالية:

1️⃣ الاستفسار عن تفاصيل الدورة
2️⃣ معرفة تكلفة الدورة
3️⃣ التواصل معك من طرف مسؤولة التأكيد

المرجو إرسال رقم الخيار المناسب، وجزاكِ الله خيرًا.`,

    option1: `بالنسبة للبرنامج للنساء حصة واحدة في الأسبوع على ساعة 19h30 الى 21h00
برنامج شامل فيه كل شيء :
*تفسير الآيات ( تدبر )
*دروس الأحكام و قواعد التجويد ( نظرية و تطبيقية)
*حصة خاصة للاستضهار`,

    option2: `ثمن 350 كل 3 أشهر +50 درهم رسوم التسجيل`,

    option3: `تم تسجيل طلبك، وستقوم مسؤولة التأكيد بالتواصل معك في أقرب وقت إن شاء الله.

نرجو إبقاء هاتفك متاحًا، ونسعد بخدمتك دائمًا`
};

// Stockage temporaire des messages envoyés (pour matcher les réponses)
const pendingConfirmations = new Map();

/**
 * Traite une nouvelle inscription
 */
async function processRegistration(registration) {
    const phone = registration[COLUMN_PHONE];
    const fullName = `${registration[COLUMN_FIRSTNAME]} ${registration[COLUMN_LASTNAME]}`;

    if (!phone) {
        console.log(`⚠️ Pas de téléphone pour: ${fullName}`);
        return;
    }

    console.log(`\n📝 Traitement: ${fullName} (${phone})`);

    const success = await sendMessage(phone, MESSAGES.welcome);

    if (success) {
        // Stocker pour pouvoir matcher la réponse
        const formattedPhone = formatPhoneNumber(phone);
        pendingConfirmations.set(formattedPhone, {
            id: registration.id,
            name: fullName,
            timestamp: Date.now()
        });
        console.log(`✅ Message envoyé à ${fullName}`);
    }
}

/**
 * Traite les réponses des clients
 */
async function handleIncomingMessage(phone, text, message) {
    const normalizedText = text.trim();

    switch (normalizedText) {
        case '1':
            await sendMessage(phone, MESSAGES.option1);
            console.log(`📤 Option 1 envoyée à ${phone}`);
            break;

        case '2':
            await sendMessage(phone, MESSAGES.option2);
            console.log(`📤 Option 2 envoyée à ${phone}`);
            break;

        case '3':
            await sendMessage(phone, MESSAGES.option3);
            console.log(`📤 Option 3 envoyée à ${phone}`);

            // Mettre à jour le statut dans Supabase
            const pending = pendingConfirmations.get(phone);
            if (pending) {
                await updateRegistrationStatus(pending.id, STATUS_CONFIRMED);
                pendingConfirmations.delete(phone);
            }
            break;
    }
}

/**
 * Fonction principale
 */
async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   🤖 CRM WhatsApp Bot - Institut       ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
        // 1. Initialiser WhatsApp
        await initWhatsApp();

        // 2. Configurer le handler de messages entrants
        onMessageReceived(handleIncomingMessage);

        // 3. Traiter les inscriptions en attente
        console.log('\n📋 Vérification des inscriptions en attente...');
        const pending = await getPendingRegistrations();

        for (const registration of pending) {
            await processRegistration(registration);
            // Petit délai entre les messages pour éviter le ban
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 4. Écouter les nouvelles inscriptions en temps réel
        subscribeToNewRegistrations(async (newRegistration) => {
            await processRegistration(newRegistration);
        });

        console.log('\n✨ Bot prêt et en écoute!');
        console.log('   - Nouvelles inscriptions → Message auto');
        console.log('   - Réponse "OUI" → Confirmation dans CRM');
        console.log('\n⏹️  Appuyez Ctrl+C pour arrêter\n');

    } catch (error) {
        console.error('❌ Erreur fatale:', error);
        process.exit(1);
    }
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du bot...');
    process.exit(0);
});

// Lancer le bot
main();
