const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

/** Preset trận: giới hạn slot + cooldown admin + cooldown theo user TikTok (chống spam quà) */
const PRESETS = {
    chill: {
        label: 'Chill',
        maxFighters: 12,
        adminSpawnMs: 520,
        adminBuffMs: 850,
        giftSpawnMs: 480,
        giftBuffMs: 1100
    },
    normal: {
        label: 'Chuẩn',
        maxFighters: 10,
        adminSpawnMs: 300,
        adminBuffMs: 420,
        giftSpawnMs: 300,
        giftBuffMs: 750
    },
    chaos: {
        label: 'Hỗn loạn',
        maxFighters: 14,
        adminSpawnMs: 110,
        adminBuffMs: 200,
        giftSpawnMs: 140,
        giftBuffMs: 380
    }
};

let currentPreset = 'normal';
const getConfig = () => PRESETS[currentPreset];

/** Cooldown lệnh admin (toàn cục — mọi socket) */
let lastAdminSpawnAt = 0;
let lastAdminBuffAt = 0;

/** Cooldown theo TikTok uniqueId */
const giftCooldown = new Map();

function nowMs() {
    return Date.now();
}

function broadcastMatchConfig() {
    const c = getConfig();
    io.emit('match-config', {
        preset: currentPreset,
        label: c.label,
        maxFighters: c.maxFighters,
        adminSpawnMs: c.adminSpawnMs,
        adminBuffMs: c.adminBuffMs
    });
}

function tryGiftCooldown(uniqueId, kind) {
    const cfg = getConfig();
    const key = `${uniqueId}:${kind}`;
    const gap = kind === 'spawn' ? cfg.giftSpawnMs : cfg.giftBuffMs;
    const t = nowMs();
    const last = giftCooldown.get(key) || 0;
    if (t - last < gap) return false;
    giftCooldown.set(key, t);
    return true;
}

function emitAdminSpawn(ioRef, data) {
    const { amount, isBoss } = data;
    for (let i = 0; i < amount; i++) {
        setTimeout(() => {
            ioRef.emit('game-spawn', { username: 'Admin_Test', isBoss: !!isBoss });
        }, i * 250);
    }
}

function emitAdminBuff(ioRef, buffType) {
    ioRef.emit('game-buff', { username: 'Admin_Test', buffType });
}

// Bạn có thể đổi Username dưới đây thành tên kênh đang LIVE (ví dụ: 'earclacks')
const TIKTOK_USERNAME = "";

io.on('connection', (socket) => {
    console.log('🖥️ Game Client connected:', socket.id);

    const c0 = getConfig();
    socket.emit('match-config', {
        preset: currentPreset,
        label: c0.label,
        maxFighters: c0.maxFighters,
        adminSpawnMs: c0.adminSpawnMs,
        adminBuffMs: c0.adminBuffMs
    });

    socket.on('set-tiktok-username', (username) => {
        console.log('Admin set TikTok user to:', username);
        if (global.tiktokLiveConnection) {
            global.tiktokLiveConnection.disconnect();
        }
        connectToTikTok(username);
    });

    socket.on('admin-set-preset', (name) => {
        if (typeof name !== 'string' || !PRESETS[name]) {
            socket.emit('admin-rejected', { reason: 'bad-preset', message: 'Preset không hợp lệ.' });
            return;
        }
        currentPreset = name;
        console.log(`⚙️ Preset trận: ${name} (${getConfig().label})`);
        broadcastMatchConfig();
    });

    socket.on('admin-action', (data) => {
        const cfg = getConfig();
        const t = nowMs();

        if (data.type === 'spawn') {
            if (t - lastAdminSpawnAt < cfg.adminSpawnMs) {
                socket.emit('admin-rejected', {
                    reason: 'rate-limit',
                    message: `Chờ thêm ~${Math.ceil((cfg.adminSpawnMs - (t - lastAdminSpawnAt)) / 100) / 10}s trước khi thả bóng (preset: ${cfg.label}).`
                });
                return;
            }
            lastAdminSpawnAt = t;
            console.log(`🛠️ Admin spawn x${data.amount || 1} boss=${!!data.isBoss}`);
            emitAdminSpawn(io, data);
        } else if (data.type === 'buff') {
            if (t - lastAdminBuffAt < cfg.adminBuffMs) {
                socket.emit('admin-rejected', {
                    reason: 'rate-limit',
                    message: `Chờ thêm ~${Math.ceil((cfg.adminBuffMs - (t - lastAdminBuffAt)) / 100) / 10}s trước khi buff (preset: ${cfg.label}).`
                });
                return;
            }
            lastAdminBuffAt = t;
            console.log(`🛠️ Admin buff ${data.buffType}`);
            emitAdminBuff(io, data.buffType);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Game Client disconnected:', socket.id);
    });
});

const connectToTikTok = (username) => {
    if (!username) return;
    console.log(`Đang kết nối tới Live của: ${username}...`);
    global.tiktokLiveConnection = new WebcastPushConnection(username);

    global.tiktokLiveConnection.connect().then(state => {
        console.log(`✅ Đã kết nối vào TikTok Live: Phòng ${state.roomId}`);
        io.emit('connection-status', { status: 'connected', roomId: state.roomId });
    }).catch(err => {
        console.error('❌ Lỗi kết nối', err);
        io.emit('connection-status', { status: 'error', error: err.message });
    });

    global.tiktokLiveConnection.on('gift', data => {
        console.log(`🎁 ${data.uniqueId} tặng ${data.giftName}`);

        let type = 'spawn';
        let amount = 1;
        let isBoss = false;
        let buffType = null;

        const giftName = data.giftName.toLowerCase();

        if (giftName.includes('rose') || giftName.includes('hoa hồng')) amount = 2;
        else if (giftName.includes('rocket') || giftName.includes('tên lửa')) amount = 6;
        else if (giftName.includes('dragon') || giftName.includes('rồng') || giftName.includes('king') || giftName.includes('vua')) {
            amount = 1; isBoss = true;
        }
        else if (giftName.includes('lips') || giftName.includes('hôn') || giftName.includes('môi')) { type = 'buff'; buffType = 'heal'; }
        else if (giftName.includes('star') || giftName.includes('sao')) { type = 'buff'; buffType = 'speed'; }
        else if (giftName.includes('biceps') || giftName.includes('cơ bắp')) { type = 'buff'; buffType = 'damage'; }
        else if (giftName.includes('fire') || giftName.includes('lửa')) { type = 'buff'; buffType = 'burn'; }
        else if (giftName.includes('shield') || giftName.includes('khiên')) { type = 'buff'; buffType = 'shield'; }

        const uid = data.uniqueId || 'unknown';

        if (type === 'buff') {
            if (!tryGiftCooldown(uid, 'buff')) {
                console.log(`   ⏳ Bỏ qua buff (cooldown user): ${uid}`);
                return;
            }
            io.emit('game-buff', { username: uid, buffType: buffType });
        } else {
            if (!tryGiftCooldown(uid, 'spawn')) {
                console.log(`   ⏳ Bỏ qua spawn (cooldown user): ${uid}`);
                return;
            }
            for (let i = 0; i < amount; i++) {
                setTimeout(() => {
                    io.emit('game-spawn', { username: uid, isBoss: isBoss });
                }, i * 200);
            }
        }
    });

    global.tiktokLiveConnection.on('chat', data => {
        io.emit('tiktok-chat', {
            username: data.uniqueId,
            comment: data.comment
        });
    });
};

if (TIKTOK_USERNAME) {
    connectToTikTok(TIKTOK_USERNAME);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server đang lắng nghe trên cổng ${PORT}`);
});
