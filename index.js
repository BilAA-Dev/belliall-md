const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const axios = require('axios');
const ytdl = require('ytdl-core');
const moment = require('moment');
const { exec } = require('child_process');
const path = require('path');

// === KONFIGURASI BELLIALL ===
const OWNER_NUMBER = '6282298323211'; // Ganti dengan nomor lo
const BOT_NAME = 'BELLIALL-MD';
const PREFIX = '.';
const SESSION_ID = process.env.SESSION_ID || ''; // Auto dari env

// === VARIABLE GLOBAL ===
let isPublic = true;
let welcomeEnabled = false;

// === FUNGSI UTAMA ===
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        browser: ['BELLIALL-MD', 'Chrome', '1.0.0']
    });

    // === EVENT CONNECTION ===
    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconnecting...');
                startBot();
            } else {
                console.log('❌ Logout, scan ulang QR!');
            }
        } else if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} aktif siap membantu!`);
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // === EVENT GROUP PARTICIPANT ===
    socket.ev.on('group-participants.update', async (update) => {
        if (!welcomeEnabled) return;
        const { id, participants, action } = update;
        if (action === 'add') {
            for (let user of participants) {
                const welcomeMsg = `👋 Selamat datang @${user.split('@')[0]} di grup ${id}\n\n📌 Baca deskripsi grup ya!`;
                await socket.sendMessage(id, { text: welcomeMsg, mentions: [user] });
            }
        }
    });

    // === EVENT PESAN MASUK ===
    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const senderName = msg.pushName || 'User';
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || null;

        // === FILTER PERINTAH ===
        if (!text.startsWith(PREFIX)) {
            // Auto-reply kata kunci (fitur tambahan)
            if (text.toLowerCase().includes('assalamualaikum')) {
                await socket.sendMessage(sender, { text: 'Wa\'alaikumsalam warahmatullahi wabarakatuh 🌙' });
            }
            return;
        }

        const args = text.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();
        const fullArgs = args.join(' ');

        console.log(`📩 [${senderName}] ${command} ${fullArgs}`);

        // === FITUR-FITUR BELLIALL ===

        // ----- MENU -----
        if (command === 'menu' || command === 'help') {
            const menuText = `╔═══ *${BOT_NAME}* ═══╗
║ 🤖 *Bot WhatsApp BELLIALL*
║ 📌 *Prefix:* ${PREFIX}
║ 👑 *Owner:* ${OWNER_NUMBER}
╠══════════════════╣
║ 🔥 *FITUR UTAMA*
║ ${PREFIX}menu - Tampilkan menu
║ ${PREFIX}owner - Info owner
║ ${PREFIX}ping - Cek status bot
║ ${PREFIX}runtime - Lama bot aktif
║
║ 🛠️ *FITUR MEDIA*
║ ${PREFIX}stiker - Buat stiker (balas gambar)
║ ${PREFIX}stikergif - Buat stiker GIF (balas video)
║ ${PREFIX}ytmp3 <url> - Download audio YT
║ ${PREFIX}ytmp4 <url> - Download video YT
║
║ 🎮 *FITUR LAIN*
║ ${PREFIX}welcome on/off - Welcome member
║ ${PREFIX}public - Bot public
║ ${PREFIX}private - Bot private
║ ${PREFIX}clearall - Hapus chat (owner)
╠══════════════════╣
║ 💀 *BELLIALL - 2026*
╚══════════════════╝`;
            await socket.sendMessage(sender, { text: menuText });
        }

        // ----- OWNER -----
        else if (command === 'owner') {
            const ownerText = `👑 *Owner Bot BELLIALL*
📌 Nama: Palz
📞 Nomor: wa.me/${OWNER_NUMBER}
🎯 Role: Master & Creator
⚡ Bot: ${BOT_NAME}`;
            await socket.sendMessage(sender, { text: ownerText });
        }

        // ----- PING -----
        else if (command === 'ping') {
            const start = Date.now();
            await socket.sendMessage(sender, { text: '⏳ Pinging...' });
            const end = Date.now();
            await socket.sendMessage(sender, { text: `🏓 Pong! ${end - start}ms ✅` });
        }

        // ----- RUNTIME -----
        else if (command === 'runtime') {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            await socket.sendMessage(sender, { text: `⏰ Bot aktif selama: ${hours} jam ${minutes} menit ${seconds} detik` });
        }

        // ----- STIKER (Gambar) -----
        else if (command === 'stiker' || command === 'sticker') {
            if (!quoted || !quoted.imageMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas gambar dengan perintah .stiker' });
            }
            try {
                const media = await downloadMediaMessage(quoted, 'buffer', {}, { 
                    logger: pino({ level: 'silent' }),
                    reuploadRequest: socket.updateMediaMessage
                });
                await socket.sendMessage(sender, { 
                    sticker: media,
                    mimetype: 'image/webp'
                });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal buat stiker: ${e.message}` });
            }
        }

        // ----- STIKER GIF -----
        else if (command === 'stikergif' || command === 'stickergif') {
            if (!quoted || !quoted.videoMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas video dengan perintah .stikergif' });
            }
            try {
                const media = await downloadMediaMessage(quoted, 'buffer', {}, {
                    logger: pino({ level: 'silent' }),
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

        // ----- DOWNLOAD YTMP3 -----
        else if (command === 'ytmp3') {
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube. Contoh: .ytmp3 https://youtu.be/xxx' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Mengunduh audio, tunggu sebentar...' });
                const info = await ytdl.getInfo(fullArgs);
                const title = info.videoDetails.title;
                const audioStream = ytdl(fullArgs, { quality: 'highestaudio', filter: 'audioonly' });
                const filePath = path.join(__dirname, `audio_${Date.now()}.mp3`);
                const writeStream = fs.createWriteStream(filePath);
                audioStream.pipe(writeStream);
                await new Promise((resolve) => writeStream.on('finish', resolve));
                
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

        // ----- DOWNLOAD YTMP4 -----
        else if (command === 'ytmp4') {
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube. Contoh: .ytmp4 https://youtu.be/xxx' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Mengunduh video, tunggu...' });
                const info = await ytdl.getInfo(fullArgs);
                const title = info.videoDetails.title;
                const videoStream = ytdl(fullArgs, { quality: 'lowest' });
                const filePath = path.join(__dirname, `video_${Date.now()}.mp4`);
                const writeStream = fs.createWriteStream(filePath);
                videoStream.pipe(writeStream);
                await new Promise((resolve) => writeStream.on('finish', resolve));
                
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

        // ----- WELCOME ON/OFF -----
        else if (command === 'welcome') {
            if (!isGroup) return socket.sendMessage(sender, { text: '❌ Ini hanya untuk grup!' });
            const setting = fullArgs.toLowerCase();
            if (setting === 'on') {
                welcomeEnabled = true;
                socket.sendMessage(sender, { text: '✅ Welcome message diaktifkan!' });
            } else if (setting === 'off') {
                welcomeEnabled = false;
                socket.sendMessage(sender, { text: '❌ Welcome message dinonaktifkan!' });
            } else {
                socket.sendMessage(sender, { text: `⚠️ Gunakan .welcome on/off. Saat ini: ${welcomeEnabled ? 'ON' : 'OFF'}` });
            }
        }

        // ----- PUBLIC/PRIVATE -----
        else if (command === 'public') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            isPublic = true;
            socket.sendMessage(sender, { text: '🌍 Bot mode PUBLIC' });
        } else if (command === 'private') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            isPublic = false;
            socket.sendMessage(sender, { text: '🔒 Bot mode PRIVATE' });
        }

        // ----- CLEAR ALL (OWNER) -----
        else if (command === 'clearall') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            try {
                const chats = await socket.groupFetchAllParticipating();
                for (let chat in chats) {
                    await socket.sendMessage(chat, { text: '🧹 Bot akan clear chat...' });
                }
                socket.sendMessage(sender, { text: '✅ Semua chat dibersihkan!' });
            } catch (e) {
                socket.sendMessage(sender, { text: `❌ Gagal: ${e.message}` });
            }
        }

        // ----- DEFAULT (command tidak dikenal) -----
        else {
            await socket.sendMessage(sender, { 
                text: `❌ Perintah "${command}" tidak dikenal.\nKetik .menu untuk lihat daftar perintah.` 
            });
        }
    });

    console.log(`🔥 ${BOT_NAME} by Palz-Coder siap digunakan!`);
}

// === JALANKAN BOT ===
startBot().catch((err) => console.log('❌ Error fatal:', err));

// === HANDLE UNCAUGHT EXCEPTION ===
process.on('uncaughtException', (err) => {
    console.log('⚠️ Uncaught Exception:', err);
});
