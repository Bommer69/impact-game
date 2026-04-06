import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

interface FighterData {
    body: Phaser.Physics.Matter.Image;
    text: Phaser.GameObjects.Text;
    hp: number;
    maxHp: number;
    username: string;
    score: number; // Chỉ số cống hiến Leaderboard
}

export class MainScene extends Phaser.Scene {
    private socket!: Socket;
    private fighters: FighterData[] = [];
    private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
    private leaderboardText!: Phaser.GameObjects.Text;
    private weaponsList = ['wp_sword', 'wp_spear', 'wp_axe', 'wp_bow'];

    constructor() {
        super('MainScene');
    }

    create() {
        console.log('Khởi tạo đấu trường Neon Arena...');
        const { width, height } = this.scale;
        
        // --- ĐỒ HỌA GRID BACKGROUND (TRON CYBERPUNK) ---
        const gridGraphics = this.add.graphics();
        gridGraphics.lineStyle(1, 0x1f2937, 0.4);
        for(let x = 0; x < width; x += 50) {
            gridGraphics.moveTo(x, 0); gridGraphics.lineTo(x, height);
        }
        for(let y = 0; y < height; y += 50) {
            gridGraphics.moveTo(0, y); gridGraphics.lineTo(width, y);
        }
        gridGraphics.strokePath();

        // Tường có độ nảy hoàn hảo
        this.matter.world.setBounds(0, 0, width, height, 50, true, true, true, true);

        // Chữ chìm trang trí Neon
        this.add.text(width / 2, height / 2, 'WEAPON BALL\nARENA', {
            fontSize: '72px', color: '#0d1117', fontStyle: '900', align: 'center', stroke: '#2d3748', strokeThickness: 2
        }).setOrigin(0.5).setAlpha(0.6);

        // --- BẢNG XẾP HẠNG (LEADERBOARD) TÙY BIẾN ---
        const boardBg = this.add.graphics();
        boardBg.fillStyle(0x161b22, 0.8);
        boardBg.lineStyle(1, 0x30363d);
        boardBg.fillRoundedRect(width - 250, 20, 230, 150, 12);
        boardBg.strokeRoundedRect(width - 250, 20, 230, 150, 12);
        this.add.text(width - 240, 30, '🏆 TOP SÁT THỦ', { fontSize: '18px', color: '#f6d365', fontStyle: 'bold' });
        this.leaderboardText = this.add.text(width - 240, 60, '1. Đang cập nhật...\n2. Đang cập nhật...\n3. Đang cập nhật...', {
            fontSize: '15px', color: '#c9d1d9', lineSpacing: 10
        });

        // --- TRẠM RÈN VŨ KHÍ TỨ HỆ ---
        this.forgeWeapons();

        // --- HIỆU ỨNG VẬT LÝ PARTICLE ---
        this.sparks = this.add.particles(0, 0, 'flare_p', {
            lifespan: 400,
            speed: { min: 50, max: 250 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            emitting: false
        });
        
        // --- SỰ KIỆN VA CHẠM (COMBAT KHỐC LIỆT) ---
        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            event.pairs.forEach(pair => {
                const bodyA = pair.bodyA as MatterJS.BodyType;
                const bodyB = pair.bodyB as MatterJS.BodyType;

                const fighterA = this.fighters.find(f => (f.body.body as MatterJS.BodyType).id === bodyA.id);
                const fighterB = this.fighters.find(f => (f.body.body as MatterJS.BodyType).id === bodyB.id);

                if (fighterA && fighterB) {
                    const speedA = bodyA.speed || 0;
                    const speedB = bodyB.speed || 0;

                    const clashX = (fighterA.body.x + fighterB.body.x) / 2;
                    const clashY = (fighterA.body.y + fighterB.body.y) / 2;

                    // A nhanh hơn B -> A chém B
                    if (speedA > speedB + 2) {
                        fighterB.hp -= 25;
                        fighterA.score += 25; // Cộng 25 điểm cống hiến sát thương
                        this.showDamageText(fighterB.body.x, fighterB.body.y, "-25", '#ff4757');
                        this.flashColor(fighterB.body);
                        this.sparks.emitParticleAt(clashX, clashY, 8); // Xẹt tia sáng
                    } 
                    // B nhanh hơn A -> B chém A
                    else if (speedB > speedA + 2) {
                        fighterA.hp -= 25;
                        fighterB.score += 25;
                        this.showDamageText(fighterA.body.x, fighterA.body.y, "-25", '#ff4757');
                        this.flashColor(fighterA.body);
                        this.sparks.emitParticleAt(clashX, clashY, 8);
                    } 
                    // Tốc độ bằng nhau (Nảy bật Clash)
                    else {
                        fighterA.hp -= 10;
                        fighterB.hp -= 10;
                        this.flashColor(fighterA.body);
                        this.flashColor(fighterB.body);
                        this.showDamageText(fighterA.body.x, fighterA.body.y, "CLASH!", '#a55eea');
                        this.sparks.emitParticleAt(clashX, clashY, 15); // Nổ to tĩnh điện
                    }
                    
                    fighterA.body.applyForce(new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-0.02, 0.02), Phaser.Math.FloatBetween(-0.02, 0.02)));
                    fighterB.body.applyForce(new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-0.02, 0.02), Phaser.Math.FloatBetween(-0.02, 0.02)));
                
                    this.updateLeaderboard();
                }
            });
        });

        // Kết nối Socket
        this.socket = io('http://localhost:3000');
        this.socket.on('game-spawn', (data) => this.spawnBall(data));
        this.socket.on('game-buff', (data) => this.applyBuff(data));
    }

    private forgeWeapons() {
        // 1. Thánh Kiếm (Sword)
        let g = this.add.graphics();
        g.fillStyle(0xff4757, 1); g.fillRect(40, 20, 35, 10); // Lưỡi đỏ
        g.fillStyle(0xf6d365, 1); g.fillRect(35, 15, 8, 20); // Chuôi kiếm
        g.lineStyle(4, 0x74b9ff); g.fillStyle(0xffffff, 1); g.fillCircle(25, 25, 20); g.strokeCircle(25, 25, 20);
        g.generateTexture('wp_sword', 85, 50);
        g.destroy();

        // 2. Thương Rồng (Spear) - Tầm dài
        g = this.add.graphics();
        g.fillStyle(0x747d8c, 1); g.fillRect(40, 22, 50, 6); // Cán sắt
        g.fillStyle(0x38f9d7, 1); g.beginPath(); g.moveTo(90, 20); g.lineTo(110, 25); g.lineTo(90, 30); g.fillPath(); // Mũi giáo
        g.lineStyle(4, 0xfca5a5); g.fillStyle(0xffffff, 1); g.fillCircle(25, 25, 20); g.strokeCircle(25, 25, 20);
        g.generateTexture('wp_spear', 115, 50);
        g.destroy();

        // 3. Rìu Chiến (Axe) - Cục súc
        g = this.add.graphics();
        g.fillStyle(0x5c3a21, 1); g.fillRect(40, 20, 25, 10); // Cán trượng
        g.fillStyle(0xa4b0be, 1); g.beginPath(); g.moveTo(55, 0); g.lineTo(75, 0); g.lineTo(85, 25); g.lineTo(75, 50); g.lineTo(55, 50); g.lineTo(65, 25); g.fillPath(); // Lưỡi rìu cong
        g.lineStyle(4, 0xbadc58); g.fillStyle(0xffffff, 1); g.fillCircle(25, 25, 20); g.strokeCircle(25, 25, 20);
        g.generateTexture('wp_axe', 90, 50);
        g.destroy();

        // 4. Cung Nhỏ (Bow)
        g = this.add.graphics();
        g.lineStyle(4, 0x8e44ad); g.beginPath(); g.arc(35, 25, 26, Phaser.Math.DegToRad(300), Phaser.Math.DegToRad(60)); g.strokePath(); // Khung vòm
        g.lineStyle(2, 0xffffff); g.beginPath(); g.moveTo(48, -1); g.lineTo(48, 51); g.strokePath(); // Dây cung
        g.lineStyle(4, 0xf39c12); g.fillStyle(0xffffff, 1); g.fillCircle(25, 25, 20); g.strokeCircle(25, 25, 20);
        g.generateTexture('wp_bow', 65, 50);
        g.destroy();

        // Shader Particle tàn lửa bốc cháy
        g = this.add.graphics();
        g.fillStyle(0xffa502, 1); g.fillCircle(4, 4, 4);
        g.generateTexture('flare_p', 8, 8);
        g.destroy();
    }

    private updateLeaderboard() {
        const top = [...this.fighters].sort((a, b) => b.score - a.score).slice(0, 3);
        let topText = '';
        top.forEach((f, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            topText += `${medal} ${f.username} (${f.score} điểm)\n`;
        });
        if (topText === '') topText = 'Chưa có chiến binh nào...';
        this.leaderboardText.setText(topText);
    }

    private applyBuff(data: { username: string, buffType: string }) {
        let targetList = this.fighters.filter(f => f.username === data.username);
        
        if (targetList.length === 0 && this.fighters.length > 0) {
            targetList = [...this.fighters].sort((a,b) => a.hp - b.hp); // Cứu kẻ yếu nhất
        }

        if (targetList.length > 0) {
            const target = targetList[0];
            const px = target.body.x, py = target.body.y;
            
            if (data.buffType === 'heal') {
                target.hp = Math.min(target.maxHp + 50, target.hp + 50); 
                this.showDamageText(px, py, "+50 HP HEAL", '#43e97b');
                this.flashColor(target.body, 0x43e97b);
            } 
            else if (data.buffType === 'speed') {
                target.body.setAngularVelocity(0.5); // Tốc độ chóng mặt
                target.body.applyForce(new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-0.08, 0.08), Phaser.Math.FloatBetween(-0.08, 0.08)));
                this.showDamageText(px, py, "SPEED UP!", '#f6d365');
                this.flashColor(target.body, 0xf6d365);
            }
            else if (data.buffType === 'damage') {
                target.score += 50; // Tặng ngay điểm cống hiến
                target.body.applyForce(new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-0.1, 0.1), Phaser.Math.FloatBetween(-0.1, 0.1)));
                this.showDamageText(px, py, "DAMAGE BOOST!", '#ff4757');
                this.flashColor(target.body, 0xff0844);
            }
            this.updateLeaderboard();
        }
    }

    private flashColor(img: Phaser.Physics.Matter.Image, color: number = 0xff0000) {
        img.setTint(color);
        this.time.delayedCall(200, () => img.clearTint());
    }

    private showDamageText(x: number, y: number, text: string, colorHex: string = '#ff4757') {
        const dmgText = this.add.text(x, y - 20, text, {
            fontSize: '24px', color: colorHex, fontStyle: '900', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: dmgText,
            y: y - 80, 
            alpha: 0,
            duration: 1000,
            onComplete: () => dmgText.destroy()
        });
    }

    private spawnBall(data: any) {
        const { width, height } = this.scale;
        const startX = Phaser.Math.Between(100, width - 100);
        const startY = Phaser.Math.Between(100, height - 100);

        // Bốc ngẫu nhiên Vũ Khí cho Chiến binh
        const randomWeapon = Phaser.Utils.Array.GetRandom(this.weaponsList);

        const ball = this.matter.add.image(startX, startY, randomWeapon);
        
        let startHp = 100;
        let scale = 1;
        let mass = 2;

        if (data.isBoss) {
            startHp = 800; // Boss máu trâu
            scale = 2.5; 
            mass = 20; 
            ball.setScale(scale);
        }

        // --- ANTI GRAVITY & COMBAT MECHANICS ---
        ball.setCircle(20 * scale); 
        ball.setFriction(0);         
        ball.setFrictionAir(0);      
        ball.setBounce(1.02); // Tăng đàn hồi nhẹ để bù năng lượng     
        ball.setMass(mass);             

        const hpText = this.add.text(0, 0, `${data.username} (${startHp})`, { 
            fontSize: data.isBoss ? '16px' : '13px', 
            color: data.isBoss ? '#f6d365' : '#fff', 
            backgroundColor: '#000'
        }).setOrigin(0.5);

        this.fighters.push({
            body: ball,
            text: hpText,
            hp: startHp,
            maxHp: startHp,
            username: data.username,
            score: 0 // Khởi điểm đua top
        });
        
        this.updateLeaderboard();

        ball.setVelocity(Phaser.Math.Between(-12, 12), Phaser.Math.Between(-12, 12));
        ball.setAngularVelocity(Phaser.Math.FloatBetween(-0.2, 0.2)); 
    }

    update(_time: number, _delta: number) {
        for (let i = this.fighters.length - 1; i >= 0; i--) {
            const fighter = this.fighters[i];
            
            if (fighter.hp <= 0) {
                this.showDamageText(fighter.body.x, fighter.body.y, "💀 DEFEATED!", '#a4b0be');
                fighter.body.destroy();
                fighter.text.destroy();
                this.fighters.splice(i, 1);
                this.updateLeaderboard();
                continue;
            }

            const scaleOffset = fighter.body.scale * 35;
            fighter.text.setPosition(fighter.body.x, fighter.body.y - scaleOffset);
            fighter.text.setText(`${fighter.username} (${fighter.hp}❤)`);

            const speed = (fighter.body.body as MatterJS.BodyType).speed || 0;
            if (speed < 3) {
                fighter.body.applyForce(new Phaser.Math.Vector2(
                    Phaser.Math.FloatBetween(-0.015, 0.015), 
                    Phaser.Math.FloatBetween(-0.015, 0.015)
                ));
            }
            
            if (Math.abs((fighter.body.body as MatterJS.BodyType).angularVelocity || 0) < 0.05) {
                fighter.body.setAngularVelocity(Phaser.Math.FloatBetween(-0.1, 0.1));
            }
        }
    }
}
