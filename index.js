require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const path = require('path');

// === KONFIGURASI ===
const OWNER_NAME = process.env.OWNER_NAME || 'HELL';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6282298323211';
const BOT_NAME = process.env.BOT_NAME || 'BELLIALL-MD';
const PREFIX = process.env.PREFIX || '.';

let welcomeEnabled = false;
let reconnectDelay = 5000;
const MAX_DELAY = 300000;
let qrDisplayed = false;

// === MULAI BOT ===
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Mac OS', 'Chrome', '14.4.1'] // ANTI-LIMIT
    });

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // === QR CODE ===
        if (qr && !qrDisplayed) {
            qrDisplayed = true;
            console.log('\n📱 SCAN QR INI:');
            console.log(`👉 https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('📌 Copy link, buka di browser HP, scan QR dari layar.\n');
        }

        // === CONNECTION ===
        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} AKTIF!`);
            reconnectDelay = 5000;
            qrDisplayed = false;
        } else if (connection === 'close') {
            qrDisplayed = false;
            const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            
            // ANTI-LIMIT (405)
            if (statusCode === 405) {
                console.log(`⏳ Kena limit, tunggu ${reconnectDelay/1000} detik...`);
                await new Promise(resolve => setTimeout(resolve, reconnectDelay));
                reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
            } else {
                reconnectDelay = 5000;
            }
            
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Restart...');
                startBot();
            } else {
                console.log('❌ Logout, hapus folder auth_info!');
            }
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // === EVENT GROUP ===
    socket.ev.on('group-participants.update', async (update) => {
        if (!welcomeEnabled) return;
        const { id, participants, action } = update;
        if (action === 'add') {
            for (let user of participants) {
                await socket.sendMessage(id, { 
                    text: `👋 Selamat datang @${user.split('@')[0]} di grup!`, 
                    mentions: [user] 
                });
            }
        }
    });

    // === PESAN MASUK ===
    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const senderName = msg.pushName || 'User';
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || null;

        // === AUTO-REPLY ===
        if (!text.startsWith(PREFIX)) {
            if (text.toLowerCase().includes('assalamualaikum')) {
                await socket.sendMessage(sender, { text: 'Wa\'alaikumsalam warahmatullahi wabarakatuh 🌙' });
            }
            return;
        }

        const args = text.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();
        const fullArgs = args.join(' ');

        console.log(`📩 [${senderName}] ${command} ${fullArgs}`);

        // === MENU ===
        if (command === 'menu' || command === 'help') {
            const menuText = `╔═══ *${BOT_NAME}* ═══╗
║ 🤖 *Bot WhatsApp BELLIALL*
║ 📌 *Prefix:* ${PREFIX}
║ 👑 *Owner:* ${OWNER_NAME}
╠══════════════════╣
║ 🔥 *FITUR UTAMA*
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
╠══════════════════╣
║ 💀 *BELLIALL - 2026*
╚══════════════════╝`;
            await socket.sendMessage(sender, { text: menuText });
        }

        // === OWNER ===
        else if (command === 'owner') {
            await socket.sendMessage(sender, { 
                text: `👑 *Owner Bot*\n📌 Nama: ${OWNER_NAME}\n📞 wa.me/${OWNER_NUMBER}` 
            });
        }

        // === PING ===
        else if (command === 'ping') {
            const start = Date.now();
            await socket.sendMessage(sender, { text: '⏳ Pinging...' });
            const end = Date.now();
            await socket.sendMessage(sender, { text: `🏓 Pong! ${end - start}ms` });
        }

        // === RUNTIME ===
        else if (command === 'runtime') {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            await socket.sendMessage(sender, { 
                text: `⏰ Bot aktif: ${hours}j ${minutes}m ${seconds}d` 
            });
        }

        // === STIKER ===
        else if (command === 'stiker' || command === 'sticker') {
            if (!quoted || !quoted.imageMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas gambar dengan .stiker' });
            }
            try {
                const media = await downloadMediaMessage(quoted, 'buffer', {}, { 
                    reuploadRequest: socket.updateMediaMessage 
                });
                await socket.sendMessage(sender, { 
                    sticker: media, 
                    mimetype: 'image/webp' 
                });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // === STIKER GIF ===
        else if (command === 'stikergif' || command === 'stickergif') {
            if (!quoted || !quoted.videoMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas video dengan .stikergif' });
            }
            try {
                const media = await downloadMediaMessage(quoted, 'buffer', {}, {
                    reuploadRequest: socket.updateMediaMessage
                });
                await socket.sendMessage(sender, {
                    sticker: media,
                    mimetype: 'video/webp'
                });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // === YTMP3 ===
        else if (command === 'ytmp3') {
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Download audio...' });
                const info = await ytdl.getInfo(fullArgs);
                const title = info.videoDetails.title;
                const audioStream = ytdl(fullArgs, { quality: 'highestaudio', filter: 'audioonly' });
                const filePath = path.join(__dirname, `audio_${Date.now()}.mp3`);
                const writeStream = fs.createWriteStream(filePath);
                audioStream.pipe(writeStream);
                await new Promise(resolve => writeStream.on('finish', resolve));
                await socket.sendMessage(sender, { 
                    audio: fs.readFileSync(filePath), 
                    mimetype: 'audio/mp4', 
                    fileName: `${title}.mp3` 
                });
                fs.unlinkSync(filePath);
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Error: ${e.message}` });
            }
        }

        // === YTMP4 ===
        else if (command === 'ytmp4') {
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Download video...' });
                const info = await ytdl.getInfo(fullArgs);
                const title = info.videoDetails.title;
                const videoStream = ytdl(fullArgs, { quality: 'lowest' });
                const filePath = path.join(__dirname, `video_${Date.now()}.mp4`);
                const writeStream = fs.createWriteStream(filePath);
                videoStream.pipe(writeStream);
                await new Promise(resolve => writeStream.on('finish', resolve));
                await socket.sendMessage(sender, {
                    video: fs.readFileSync(filePath),
                    caption: `🎬 ${title}`,
                    fileName: `${title}.mp4`,
                    mimetype: 'video/mp4'
                });
                fs.unlinkSync(filePath);
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Error: ${e.message}` });
            }
        }

        // === WELCOME ===
        else if (command === 'welcome') {
            if (!isGroup) return socket.sendMessage(sender, { text: '❌ Hanya untuk grup!' });
            const setting = fullArgs.toLowerCase();
            if (setting === 'on') {
                welcomeEnabled = true;
                socket.sendMessage(sender, { text: '✅ Welcome aktif' });
            } else if (setting === 'off') {
                welcomeEnabled = false;
                socket.sendMessage(sender, { text: '❌ Welcome nonaktif' });
            } else {
                socket.sendMessage(sender, { 
                    text: `⚠️ .welcome on/off (saat ini: ${welcomeEnabled ? 'ON' : 'OFF'})` 
                });
            }
        }

        // === PUBLIC/PRIVATE ===
        else if (command === 'public') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) {
                return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            }
            socket.sendMessage(sender, { text: '🌍 Mode PUBLIC' });
        } else if (command === 'private') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) {
                return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            }
            socket.sendMessage(sender, { text: '🔒 Mode PRIVATE' });
        }

        // === CLEARALL ===
        else if (command === 'clearall') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) {
                return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            }
            try {
                const chats = await socket.groupFetchAllParticipating();
                for (let chat in chats) {
                    await socket.sendMessage(chat, { text: '🧹 Clear chat...' });
                }
                socket.sendMessage(sender, { text: '✅ Semua chat dibersihkan!' });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // === DEFAULT ===
        else {
            await socket.sendMessage(sender, { 
                text: `❌ Perintah "${command}" tidak dikenal.\nKetik .menu` 
            });
        }
    });

    console.log(`🔥 ${BOT_NAME} by ${OWNER_NAME} siap!`);
}

// === JALANKAN ===
startBot().catch(err => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
});

// === UNCAUGHT EXCEPTION ===
process.on('uncaughtException', (err) => {
    console.log('⚠️ Uncaught Exception:', err);
});
