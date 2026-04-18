import { io } from 'socket.io-client';

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
const socket = io(serverUrl);
const statusTxt = document.getElementById('statusTxt')!;

socket.on('connect', () => {
    statusTxt.innerHTML = '🔵 Local Server: Đã kết nối. Đang chờ liên kết TikTok...';
});

socket.on('connection-status', (data) => {
    if (data.status === 'connected') {
        statusTxt.innerHTML = `🟢 Live đã khóa mục tiêu: <b style="color: #48bb78">${data.roomId}</b>`;
    } else {
        statusTxt.innerHTML = `🔴 Lỗi: ${data.error}`;
    }
});

const adminTiktokId = document.getElementById('adminTiktokId') as HTMLInputElement;
const adminConnectBtn = document.getElementById('adminConnectBtn') as HTMLButtonElement;

adminConnectBtn.onclick = () => {
    const val = adminTiktokId.value.trim();
    if (val) {
        statusTxt.innerHTML = '🟡 Đang dò tìm luồng Live...';
        socket.emit('set-tiktok-username', val);
    }
};

// --- Preset trận ---
const presetDetail = document.getElementById('presetDetail')!;
const presetButtons = document.querySelectorAll<HTMLButtonElement>('.preset-btn');

function setActivePresetButton(preset: string) {
    presetButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });
}

function formatPresetDetail(cfg: {
    label?: string;
    maxFighters?: number;
    adminSpawnMs?: number;
    adminBuffMs?: number;
}) {
    const label = cfg.label ?? '—';
    const max = cfg.maxFighters ?? '—';
    const sp = cfg.adminSpawnMs ?? '—';
    const bf = cfg.adminBuffMs ?? '—';
    return `Đang dùng: <strong>${label}</strong> — tối đa <code>${max}</code> bóng · cooldown admin: thả <code>${sp}</code>ms · buff <code>${bf}</code>ms (quà TikTok có cooldown riêng theo user).`;
}

socket.on('match-config', (data: {
    preset?: string;
    label?: string;
    maxFighters?: number;
    adminSpawnMs?: number;
    adminBuffMs?: number;
}) => {
    if (data.preset) setActivePresetButton(data.preset);
    presetDetail.innerHTML = formatPresetDetail(data);
});

presetButtons.forEach((btn) => {
    btn.onclick = () => {
        const p = btn.dataset.preset;
        if (p) socket.emit('admin-set-preset', p);
    };
});

socket.on('admin-rejected', (data: { message?: string; reason?: string }) => {
    const msg = data.message || data.reason || 'Không thực hiện được.';
    statusTxt.innerHTML = `🟠 ${msg}`;
});

// --- Thống kê (đếm từ sự kiện thật từ server — khớp khi bị rate-limit) ---
let stats = { drops: 0, buffs: 0 };
const elStatPlayers = document.getElementById('statPlayers')!;
const elStatDrops = document.getElementById('statDrops')!;
const elStatBuffs = document.getElementById('statBuffs')!;

function updateStatsUI() {
    elStatPlayers.innerHTML = activePlayers.size.toString();
    elStatDrops.innerHTML = stats.drops.toString();
    elStatBuffs.innerHTML = stats.buffs.toString();
}

function triggerAdminEvent(type: string, payload: Record<string, unknown>) {
    socket.emit('admin-action', { type, ...payload });
}

document.getElementById('btnDrop1')!.onclick = () => triggerAdminEvent('spawn', { amount: 1, isBoss: false });
document.getElementById('btnDrop10')!.onclick = () => triggerAdminEvent('spawn', { amount: 10, isBoss: false });
document.getElementById('btnDropBoss')!.onclick = () => triggerAdminEvent('spawn', { amount: 1, isBoss: true });

document.getElementById('btnHeal')!.onclick = () => triggerAdminEvent('buff', { buffType: 'heal' });
document.getElementById('btnSpeed')!.onclick = () => triggerAdminEvent('buff', { buffType: 'speed' });
document.getElementById('btnDamage')!.onclick = () => triggerAdminEvent('buff', { buffType: 'damage' });
document.getElementById('btnShield')!.onclick = () => triggerAdminEvent('buff', { buffType: 'shield' });
document.getElementById('btnBurn')!.onclick = () => triggerAdminEvent('buff', { buffType: 'burn' });

// --- Danh sách người chơi ---
const playerListEl = document.getElementById('playerList')!;
const activePlayers = new Set<string>();

function updatePlayerListUI() {
    if (activePlayers.size === 0) {
        playerListEl.innerHTML = '<li class="player-item"><i>Chưa có chiến binh nào...</i></li>';
        return;
    }

    let html = '';
    activePlayers.forEach(name => {
        html += `<li class="player-item">🎮 Nhẫn giả: <b>${name}</b></li>`;
    });
    playerListEl.innerHTML = html;
    updateStatsUI();
}

socket.on('game-spawn', (data: { username?: string }) => {
    stats.drops += 1;
    updateStatsUI();
    if (data.username) activePlayers.add(data.username);
    updatePlayerListUI();
});

socket.on('game-buff', () => {
    stats.buffs += 1;
    updateStatsUI();
});

socket.on('tiktok-chat', (data: { username?: string }) => {
    if (data.username) activePlayers.add(data.username);
    updatePlayerListUI();
});
