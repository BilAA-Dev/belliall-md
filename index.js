require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');

// === KONFIGURASI ===
const OWNER_NAME = process.env.OWNER_NAME || 'HELL';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6282298323211';
const BOT_NAME = process.env.BOT_NAME || 'BELLIALL-MD';
const PREFIX = process.env.PREFIX || '.';
const PHONE_NUMBER = process.env.PHONE_NUMBER || '6282298323211';

let isPublic = true;
let welcomeEnabled = false;
let pairingStarted = false;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['BELLIALL-MD', 'Chrome', '2.0.0']
    });

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} AKTIF!`);
            pairingStarted = false;
        } else if (connection === 'close') {
            const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting...');
                startBot();
            } else {
                console.log('❌ Logout, ulangi proses.');
            }
        } else if (connection === 'connecting') {
            if (!pairingStarted) {
                pairingStarted = true;
                console.log(`⏳ Mencoba pairing untuk nomor: ${PHONE_NUMBER}`);
                try {
                    const code = await socket.requestPairingCode(PHONE_NUMBER);
                    console.log(`\n🔐 KODE PAIRING: ${code}`);
                    console.log(`📲 Buka WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat -> Masukkan kode: ${code}\n`);
                } catch (error) {
                    console.error(`❌ Error: ${error.message}`);
                    console.log('🔄 Coba ulang dalam 15 detik...');
                    pairingStarted = false;
                    setTimeout(startBot, 15000);
                }
            }
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // === EVENT PESAN ===
    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        // Auto-reply sederhana biar tau bot hidup
        if (text === '.ping') {
            await socket.sendMessage(sender, { text: 'Pong! 🏓' });
        }
    });

    console.log(`🔥 ${BOT_NAME} by ${OWNER_NAME} siap digunakan!`);
}

startBot().catch(err => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
});
