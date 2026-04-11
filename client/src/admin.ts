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

// --- Thống Kê Tổng Hợp ---
let stats = { drops: 0, buffs: 0 };
const elStatPlayers = document.getElementById('statPlayers')!;
const elStatDrops = document.getElementById('statDrops')!;
const elStatBuffs = document.getElementById('statBuffs')!;

function updateStatsUI() {
    elStatPlayers.innerHTML = activePlayers.size.toString();
    elStatDrops.innerHTML = stats.drops.toString();
    elStatBuffs.innerHTML = stats.buffs.toString();
}

// --- Giả Lập Event ---
function triggerAdminEvent(type: string, payload: any) {
    if (type === 'spawn') stats.drops += payload.amount || 1;
    if (type === 'buff') stats.buffs += 1;
    updateStatsUI();
    
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

// --- Cập nhật danh sách người chơi (Live) ---
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
    updateStatsUI(); // Cập nhật lại số lượng người chơi
}

socket.on('game-spawn', (data: any) => {
    activePlayers.add(data.username);
    updatePlayerListUI();
});

socket.on('tiktok-chat', (data: any) => {
    // Cũng có thể hiển thị chat hoặc add active user từ chat
    activePlayers.add(data.username);
    updatePlayerListUI();
});
