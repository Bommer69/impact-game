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

// Bạn có thể đổi Username dưới đây thành tên kênh đang LIVE (ví dụ: 'earclacks')
const TIKTOK_USERNAME = ""; 

io.on('connection', (socket) => {
    console.log('🖥️ Game Client connected:', socket.id);
    
    // API để game truyền username cần kết nối vào nếu muốn đổi trực quan
    socket.on('set-tiktok-username', (username) => {
        console.log('Admin set TikTok user to:', username);
        if (global.tiktokLiveConnection) {
            global.tiktokLiveConnection.disconnect();
        }
        connectToTikTok(username);
    });

    // Nhận lệnh hành động từ bảng điều khiển Admin trực tiếp
    socket.on('admin-action', (data) => {
        console.log(`🛠️ Admin thực hiện hành động: ${data.type}`);
        if (data.type === 'spawn') {
            for (let i = 0; i < data.amount; i++) {
                setTimeout(() => {
                    io.emit('game-spawn', { username: 'Admin_Test', isBoss: data.isBoss });
                }, i * 250); 
            }
        } else if (data.type === 'buff') {
            io.emit('game-buff', { username: 'Admin_Test', buffType: data.buffType });
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
        
        // Phân tích quà dựa vào tên (GiftName)
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

        if (type === 'buff') {
            io.emit('game-buff', { username: data.uniqueId, buffType: buffType });
        } else {
            // Rơi tuần tự để tránh lag
            for(let i = 0; i < amount; i++) {
                setTimeout(() => {
                    io.emit('game-spawn', { username: data.uniqueId, isBoss: isBoss });
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

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server đang lắng nghe trên cổng ${PORT}`);
});
