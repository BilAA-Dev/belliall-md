require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const path = require('path');

// ========== KONFIGURASI ==========
const OWNER_NAME = process.env.OWNER_NAME || 'HELL';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6282298323211';
const BOT_NAME = process.env.BOT_NAME || 'BELLIALL-MD';
const PREFIX = process.env.PREFIX || '.';
const PHONE_NUMBER = process.env.PHONE_NUMBER || '6282298323211';

let welcomeEnabled = false;

// ========== FUNGSI PAIRING ==========
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['BELLIALL-MD', 'Chrome', '1.0.0']
    });

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 Mencoba pairing code...');
            try {
                const code = await socket.requestPairingCode(PHONE_NUMBER);
                console.log(`🔐 KODE PAIRING: ${code}`);
                console.log(`📲 Buka WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat -> Masukkan kode: ${code}`);
            } catch (e) {
                console.log('❌ Pairing gagal, scan QR di browser:');
                console.log(`👉 https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            }
        }

        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} AKTIF!`);
        } else if (connection === 'close') {
            const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Bot restart...');
                startBot();
            }
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // ========== EVENT PESAN MASUK (FULL FITUR) ==========
    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || null;

        if (!text.startsWith(PREFIX)) {
            if (text.toLowerCase().includes('assalamualaikum')) {
                await socket.sendMessage(sender, { text: 'Wa\'alaikumsalam warahmatullahi wabarakatuh 🌙' });
            }
            return;
        }

        const args = text.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();
        const fullArgs = args.join(' ');

        // ===== MENU =====
        if (command === 'menu' || command === 'help') {
            const menu = `╔═══ *${BOT_NAME}* ═══╗
║ 🤖 *BELLIALL-MD*
║ 📌 Prefix: ${PREFIX}
║ 👑 Owner: ${OWNER_NAME}
╠══════════════════╣
║ 🔥 *FITUR*
║ ${PREFIX}menu - Menu
║ ${PREFIX}owner - Owner
║ ${PREFIX}ping - Ping
║ ${PREFIX}runtime - Runtime
║ ${PREFIX}stiker - Stiker
║ ${PREFIX}stikergif - Stiker GIF
║ ${PREFIX}ytmp3 <url> - Audio YT
║ ${PREFIX}ytmp4 <url> - Video YT
║ ${PREFIX}welcome on/off - Welcome
║ ${PREFIX}clearall - Clear chat
╚══════════════════╝`;
            await socket.sendMessage(sender, { text: menu });
        }

        // ===== OWNER =====
        else if (command === 'owner') {
            await socket.sendMessage(sender, { text: `👑 *Owner*\nNama: ${OWNER_NAME}\nNomor: wa.me/${OWNER_NUMBER}` });
        }

        // ===== PING =====
        else if (command === 'ping') {
            const start = Date.now();
            await socket.sendMessage(sender, { text: '⏳ Pinging...' });
            const end = Date.now();
            await socket.sendMessage(sender, { text: `🏓 Pong! ${end - start}ms` });
        }

        // ===== RUNTIME =====
        else if (command === 'runtime') {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            await socket.sendMessage(sender, { text: `⏰ Bot aktif: ${hours}h ${minutes}m ${seconds}s` });
        }

        // ===== STIKER =====
        else if (command === 'stiker') {
            if (!quoted || !quoted.imageMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas gambar dengan perintah .stiker' });
            }
            try {
                const media = await downloadMediaMessage(quoted, 'buffer', {}, { reuploadRequest: socket.updateMediaMessage });
                await socket.sendMessage(sender, { sticker: media, mimetype: 'image/webp' });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // ===== STIKER GIF =====
        else if (command === 'stikergif') {
            if (!quoted || !quoted.videoMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas video dengan perintah .stikergif' });
            }
            try {
                const media = await downloadMediaMessage(quoted, 'buffer', {}, { reuploadRequest: socket.updateMediaMessage });
                await socket.sendMessage(sender, { sticker: media, mimetype: 'video/webp' });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // ===== YTMP3 =====
        else if (command === 'ytmp3') {
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Mengunduh audio...' });
                const info = await ytdl.getInfo(fullArgs);
                const title = info.videoDetails.title;
                const audioStream = ytdl(fullArgs, { quality: 'highestaudio', filter: 'audioonly' });
                const filePath = path.join(__dirname, `audio_${Date.now()}.mp3`);
                const writeStream = fs.createWriteStream(filePath);
                audioStream.pipe(writeStream);
                await new Promise(resolve => writeStream.on('finish', resolve));
                await socket.sendMessage(sender, { audio: fs.readFileSync(filePath), mimetype: 'audio/mp4', fileName: `${title}.mp3` });
                fs.unlinkSync(filePath);
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Error: ${e.message}` });
            }
        }

        // ===== YTMP4 =====
        else if (command === 'ytmp4') {
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Mengunduh video...' });
                const info = await ytdl.getInfo(fullArgs);
                const title = info.videoDetails.title;
                const videoStream = ytdl(fullArgs, { quality: 'lowest' });
                const filePath = path.join(__dirname, `video_${Date.now()}.mp4`);
                const writeStream = fs.createWriteStream(filePath);
                videoStream.pipe(writeStream);
                await new Promise(resolve => writeStream.on('finish', resolve));
                await socket.sendMessage(sender, { video: fs.readFileSync(filePath), caption: `🎬 ${title}`, fileName: `${title}.mp4`, mimetype: 'video/mp4' });
                fs.unlinkSync(filePath);
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Error: ${e.message}` });
            }
        }

        // ===== WELCOME =====
        else if (command === 'welcome') {
            if (!isGroup) return socket.sendMessage(sender, { text: '❌ Hanya untuk grup!' });
            const setting = fullArgs.toLowerCase();
            if (setting === 'on') { welcomeEnabled = true; socket.sendMessage(sender, { text: '✅ Welcome aktif' }); }
            else if (setting === 'off') { welcomeEnabled = false; socket.sendMessage(sender, { text: '❌ Welcome nonaktif' }); }
            else { socket.sendMessage(sender, { text: `⚠️ .welcome on/off (saat ini: ${welcomeEnabled ? 'ON' : 'OFF'})` }); }
        }

        // ===== CLEARALL =====
        else if (command === 'clearall') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            try {
                const chats = await socket.groupFetchAllParticipating();
                for (let chat in chats) {
                    await socket.sendMessage(chat, { text: '🧹 Clear chat...' });
                }
                socket.sendMessage(sender, { text: '✅ Chat dibersihkan!' });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // ===== DEFAULT =====
        else {
            await socket.sendMessage(sender, { text: `❌ Perintah "${command}" tidak dikenal.\nKetik .menu` });
        }
    });

    console.log(`🔥 ${BOT_NAME} by ${OWNER_NAME} siap digunakan!`);
}

startBot().catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
