require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const path = require('path');
const qrTerminal = require('qrcode-terminal');

// === KONFIGURASI ===
const OWNER_NAME = process.env.OWNER_NAME || 'HELL';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6282298323211';
const BOT_NAME = process.env.BOT_NAME || 'BELLIALL-MD';
const PREFIX = process.env.PREFIX || '.';

let welcomeEnabled = false;
let qrDisplayed = false;

// === START BOT ===
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Ubuntu', 'Chrome', '120.0.0.0']
    });

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !qrDisplayed) {
            qrDisplayed = true;
            console.log('\n📱 SCAN QR CODE INI DENGAN WHATSAPP:\n');
            qrTerminal.generate(qr, { small: true });
            console.log('\n⚠️ Atau scan lewat: WhatsApp → Perangkat Tertaut → Tautkan Perangkat\n');
        }

        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} AKTIF!`);
            qrDisplayed = false;
        } else if (connection === 'close') {
            qrDisplayed = false;
            const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Restart...');
                startBot();
            } else {
                console.log('❌ Logout, hapus folder auth_info!');
            }
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // === GROUP WELCOME ===
    socket.ev.on('group-participants.update', async (update) => {
        if (!welcomeEnabled) return;
        const { id, participants, action } = update;
        if (action === 'add') {
            for (let user of participants) {
                await socket.sendMessage(id, { 
                    text: `👋 Selamat datang @${user.split('@')[0]} di grup!\n📌 Baca deskripsi grup ya!`, 
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
║ 👑 *Owner:* ${OWNER_NAME} (${OWNER_NUMBER})
╠══════════════════╣
║ 🔥 *FITUR UTAMA*
║ ${PREFIX}menu - Tampilkan menu
║ ${PREFIX}owner - Info owner
║ ${PREFIX}ping - Cek status bot
║ ${PREFIX}runtime - Lama bot aktif
║ ${PREFIX}stiker - Buat stiker (balas gambar)
║ ${PREFIX}stikergif - Buat stiker GIF (balas video)
║ ${PREFIX}ytmp3 <url> - Download audio YT
║ ${PREFIX}ytmp4 <url> - Download video YT
║ ${PREFIX}welcome on/off - Welcome member
║ ${PREFIX}clearall - Hapus chat (owner)
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
                text: `⏰ Bot aktif selama: ${hours} jam ${minutes} menit ${seconds} detik` 
            });
        }

        // === STIKER (Gambar) ===
        else if (command === 'stiker' || command === 'sticker') {
            if (!quoted || !quoted.imageMessage) {
                return socket.sendMessage(sender, { text: '❌ Balas gambar dengan perintah .stiker' });
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
                return socket.sendMessage(sender, { text: '❌ Balas video dengan perintah .stikergif' });
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
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube. Contoh: .ytmp3 https://youtu.be/xxx' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Mengunduh audio, tunggu sebentar...' });
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
            if (!fullArgs) return socket.sendMessage(sender, { text: '❌ Masukkan URL YouTube. Contoh: .ytmp4 https://youtu.be/xxx' });
            try {
                await socket.sendMessage(sender, { text: '⏳ Mengunduh video, tunggu...' });
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
            if (!isGroup) return socket.sendMessage(sender, { text: '❌ Ini hanya untuk grup!' });
            const setting = fullArgs.toLowerCase();
            if (setting === 'on') {
                welcomeEnabled = true;
                socket.sendMessage(sender, { text: '✅ Welcome message diaktifkan!' });
            } else if (setting === 'off') {
                welcomeEnabled = false;
                socket.sendMessage(sender, { text: '❌ Welcome message dinonaktifkan!' });
            } else {
                socket.sendMessage(sender, { 
                    text: `⚠️ Gunakan .welcome on/off. Saat ini: ${welcomeEnabled ? 'ON' : 'OFF'}` 
                });
            }
        }

        // === CLEARALL ===
        else if (command === 'clearall') {
            if (sender !== `${OWNER_NUMBER}@s.whatsapp.net`) {
                return socket.sendMessage(sender, { text: '❌ Khusus owner!' });
            }
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

        // === DEFAULT ===
        else {
            await socket.sendMessage(sender, { 
                text: `❌ Perintah "${command}" tidak dikenal.\nKetik .menu untuk lihat daftar perintah.` 
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
