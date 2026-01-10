const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client = null;
let isReady = false;

/**
 * Initialise le client WhatsApp
 */
function initWhatsApp() {
    return new Promise((resolve, reject) => {
        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            }
        });

        client.on('qr', (qr) => {
            console.log('\n📱 Scannez ce QR code avec WhatsApp:\n');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', () => {
            console.log('✅ WhatsApp connecté!');
            isReady = true;
            resolve(client);
        });

        client.on('authenticated', () => {
            console.log('🔐 Authentification réussie');
        });

        client.on('auth_failure', (msg) => {
            console.error('❌ Échec authentification:', msg);
            reject(new Error('Auth failed'));
        });

        client.on('disconnected', (reason) => {
            console.log('📴 WhatsApp déconnecté:', reason);
            isReady = false;
        });

        console.log('🚀 Initialisation WhatsApp...');
        client.initialize();
    });
}

/**
 * Envoie un message WhatsApp
 * @param {string} phone - Numéro de téléphone (format: 212612345678)
 * @param {string} message - Message à envoyer
 */
async function sendMessage(phone, message) {
    if (!isReady) {
        console.error('❌ WhatsApp non connecté');
        return false;
    }

    // Formater le numéro (ajouter @c.us)
    const formattedPhone = formatPhoneNumber(phone);
    const chatId = `${formattedPhone}@c.us`;

    try {
        await client.sendMessage(chatId, message);
        console.log(`📤 Message envoyé à ${formattedPhone}`);
        return true;
    } catch (error) {
        console.error(`❌ Erreur envoi à ${formattedPhone}:`, error.message);
        return false;
    }
}

/**
 * Formate un numéro de téléphone pour WhatsApp
 */
function formatPhoneNumber(phone) {
    // Supprimer espaces, tirets, parenthèses
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

    // Si commence par 0, remplacer par 212 (Maroc)
    if (cleaned.startsWith('0')) {
        cleaned = '212' + cleaned.substring(1);
    }

    // Si commence par +, supprimer
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    return cleaned;
}

/**
 * Configure un handler pour les messages entrants
 */
function onMessageReceived(callback) {
    if (!client) {
        console.error('❌ Client WhatsApp non initialisé');
        return;
    }

    client.on('message', async (message) => {
        // Ignorer les messages de groupe et les statuts
        if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
            return;
        }

        const phone = message.from.replace('@c.us', '');
        const text = message.body;

        console.log(`📩 Message reçu de ${phone}: "${text}"`);
        callback(phone, text, message);
    });

    console.log('👂 Écoute des messages entrants...');
}

/**
 * Vérifie si WhatsApp est prêt
 */
function isWhatsAppReady() {
    return isReady;
}

module.exports = {
    initWhatsApp,
    sendMessage,
    onMessageReceived,
    isWhatsAppReady,
    formatPhoneNumber
};
