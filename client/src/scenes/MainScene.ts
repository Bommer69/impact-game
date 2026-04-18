import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

/** Font đã preload trong index.html — khớp giao diện web */
const FONT_UI = '"DM Sans", system-ui, sans-serif';
const FONT_DISPLAY = '"Bebas Neue", "Impact", sans-serif';

interface FighterData {
    body: Phaser.Physics.Matter.Image;
    text: Phaser.GameObjects.Text;
    hp: number;
    maxHp: number;
    username: string;
    score: number; // Chỉ số cống hiến Leaderboard
    /** Bán kính va chạy Matter (px) — đã nhân scale boss */
    hitRadius: number;
    isShielded?: boolean;
    shieldGraphic?: Phaser.GameObjects.Graphics;
    isBurning?: boolean;
    fireEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    /** Trail khi buff tốc độ */
    speedTrailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class MainScene extends Phaser.Scene {
    /** Trần tốc độ (sau va chạm / buff) */
    private static readonly MAX_SPEED = 19;
    /** Độ lớn vận tốc duy trì liên tục — không ma sát, chỉ đổi hướng khi va chạm */
    private static readonly CRUISE_SPEED = 8.2;
    /** Nếu gần như đứng yến (kẹt số học) — bắn lại ngẫu nhiên */
    private static readonly STUCK_SPEED_EPS = 0.15;

    /** Đồng bộ từ server (preset trận) */
    private maxFighters = 10;

    private socket!: Socket;
    private fighters: FighterData[] = [];
    private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
    private leaderboardText!: Phaser.GameObjects.Text;
    private gameStatsText!: Phaser.GameObjects.Text;
    private gameStats = { totalEvents: 0 };

    /** Texture 96×96 — tâm bóng (48,48); bán kính va chạm (px) tùy vũ khí */
    private static readonly WEAPON_KEYS = [
        'wp_dagger',
        'wp_bow',
        'wp_kunai',
        'wp_sword',
        'wp_staff',
        'wp_axe',
        'wp_spear',
        'wp_hammer',
        'wp_scythe'
    ] as const;

    /** Bán kính hình tròn Matter (scale=1) — khớp tầm đánh / kích thước họa tiết */
    private static readonly WEAPON_HIT_RADIUS: Record<string, number> = {
        wp_dagger: 17,
        wp_bow: 18,
        wp_kunai: 19,
        wp_sword: 20,
        wp_staff: 20,
        wp_axe: 21,
        wp_spear: 22,
        wp_hammer: 23,
        wp_scythe: 23
    };

    private static getWeaponHitRadius(textureKey: string): number {
        return MainScene.WEAPON_HIT_RADIUS[textureKey] ?? 20;
    }
    
    // Web Audio API Context
    private audioCtx?: AudioContext;

    /** TTS: hàng đợi câu đọc khi khán giả TikTok tặng quà */
    private giftSpeechQueue: string[] = [];
    private giftSpeechBusy = false;
    private giftSpeechVoice: SpeechSynthesisVoice | null = null;

    private static readonly BUFF_LABEL_VI: Record<string, string> = {
        heal: 'hồi máu',
        speed: 'tăng tốc',
        damage: 'sát thương',
        shield: 'khiên',
        burn: 'lửa địa ngục'
    };

    constructor() {
        super('MainScene');
        try {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API không được hỗ trợ");
        }
    }

    create() {
        console.log('Khởi tạo đấu trường Neon Arena...');
        const { width, height } = this.scale;
        
        // --- ĐỒ HỌA GRID BACKGROUND VÀ BỨC TƯỜNG (TRON CYBERPUNK) ---
        const gridGraphics = this.add.graphics();
        gridGraphics.lineStyle(1, 0x1e3a4a, 0.55);
        for(let x = 0; x < width; x += 50) {
            gridGraphics.moveTo(x, 0); gridGraphics.lineTo(x, height);
        }
        for(let y = 0; y < height; y += 50) {
            gridGraphics.moveTo(0, y); gridGraphics.lineTo(width, y);
        }
        gridGraphics.strokePath();

        // Vẽ 4 bức tường xung quanh đấu trường để tăng cảm giác "không gian hẹp, map rộng"
        const wallThickness = 20;
        const wallGlow = this.add.graphics();
        wallGlow.lineStyle(wallThickness, 0x00e5ff, 0.75);
        wallGlow.strokeRect(wallThickness/2, wallThickness/2, width - wallThickness, height - wallThickness);
        wallGlow.lineStyle(3, 0xff2d95, 0.45);
        wallGlow.strokeRect(wallThickness/2 + 2, wallThickness/2 + 2, width - wallThickness - 4, height - wallThickness - 4);
        wallGlow.lineStyle(2, 0xffffff, 0.95);
        wallGlow.strokeRect(wallThickness/2, wallThickness/2, width - wallThickness, height - wallThickness);

        // Tường vật lý đồng bộ với hiển thị
        this.matter.world.setBounds(wallThickness, wallThickness, width - wallThickness*2, height - wallThickness*2, 50, true, true, true, true);

        // Chữ chìm trang trí Neon
        this.add.text(width / 2, height / 2, 'WEAPON BALL\nARENA', {
            fontFamily: FONT_DISPLAY,
            fontSize: '86px',
            color: '#050810',
            align: 'center',
            stroke: '#00f5ff',
            strokeThickness: 1
        }).setOrigin(0.5).setAlpha(0.22);

        // --- CÁC BỨC TƯỜNG/CHƯỚNG NGẠI VẬT TRONG MAP ---
        const obstaclePositions = [
            { x: width * 0.3, y: height * 0.3 },
            { x: width * 0.7, y: height * 0.3 },
            { x: width * 0.3, y: height * 0.7 },
            { x: width * 0.7, y: height * 0.7 }
        ];

        const obsGraphics = this.add.graphics();
        obsGraphics.lineStyle(6, 0xff007f, 1);
        obsGraphics.fillStyle(0x110022, 0.8);

        obstaclePositions.forEach(pos => {
            const obsWidth = 120;
            const obsHeight = 40;
            
            // Vẽ hộp neon
            obsGraphics.fillRect(pos.x - obsWidth/2, pos.y - obsHeight/2, obsWidth, obsHeight);
            obsGraphics.strokeRect(pos.x - obsWidth/2, pos.y - obsHeight/2, obsWidth, obsHeight);
            
            // Tạo body tĩnh (static)
            this.matter.add.rectangle(pos.x, pos.y, obsWidth, obsHeight, { 
                isStatic: true,
                restitution: 0.98,
                friction: 0,
                frictionStatic: 0
            });
            // (Tuỳ chọn) Bạn có thể lưu lại vào danh sách obstacles nếu cần xử lý va chạm đặc biệt
        });

        // Khởi động Background Drone Music
        this.startBackgroundMusic();

        this.initGiftSpeechVoices();

        // --- BẢNG XẾP HẠNG (LEADERBOARD) — viền neon kép ---
        const lbX = width - 268;
        const lbY = 18;
        const lbW = 248;
        const lbH = 168;
        const boardBg = this.add.graphics();
        boardBg.fillStyle(0x070a12, 0.88);
        boardBg.fillRoundedRect(lbX, lbY, lbW, lbH, 14);
        boardBg.lineStyle(2, 0x00f5ff, 0.55);
        boardBg.strokeRoundedRect(lbX, lbY, lbW, lbH, 14);
        boardBg.lineStyle(1, 0xff2d95, 0.35);
        boardBg.strokeRoundedRect(lbX + 3, lbY + 3, lbW - 6, lbH - 6, 11);
        this.add.text(lbX + 14, lbY + 12, 'TOP SÁT THỦ', {
            fontFamily: FONT_DISPLAY,
            fontSize: '22px',
            color: '#f6d365',
            letterSpacing: 2
        });
        this.leaderboardText = this.add.text(lbX + 14, lbY + 44, '1. Đang cập nhật...\n2. Đang cập nhật...\n3. Đang cập nhật...', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#c9d1d9',
            lineSpacing: 8
        });

        // --- BẢNG THỐNG KÊ (GAME STATS HUD) ---
        const stW = 216;
        const stH = 100;
        const statsBg = this.add.graphics();
        statsBg.fillStyle(0x070a12, 0.88);
        statsBg.fillRoundedRect(18, 18, stW, stH, 14);
        statsBg.lineStyle(2, 0x00f5ff, 0.55);
        statsBg.strokeRoundedRect(18, 18, stW, stH, 14);
        statsBg.lineStyle(1, 0xff2d95, 0.35);
        statsBg.strokeRoundedRect(21, 21, stW - 6, stH - 6, 11);
        this.add.text(32, 26, 'THỐNG KÊ', {
            fontFamily: FONT_DISPLAY,
            fontSize: '22px',
            color: '#00f5ff',
            letterSpacing: 2
        });
        this.gameStatsText = this.add.text(32, 56, `Chiến binh: 0/${this.maxFighters}\nSự kiện thả: 0`, {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#8b949e',
            lineSpacing: 8
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

                // Nếu chạm vào tường (wall bounces)
                if ((fighterA && !fighterB) || (!fighterA && fighterB)) {
                    this.playSynthSound('bounce');
                }

                if (fighterA && fighterB) {
                    const speedA = bodyA.speed || 0;
                    const speedB = bodyB.speed || 0;

                    const clashX = (fighterA.body.x + fighterB.body.x) / 2;
                    const clashY = (fighterA.body.y + fighterB.body.y) / 2;

                    // A nhanh hơn B -> A chém B
                    if (speedA > speedB + 2) {
                        this.applyDamage(fighterB, 25, fighterA);
                        this.playSynthSound('hit');
                        this.sparks.emitParticleAt(clashX, clashY, 8); // Xẹt tia sáng
                    } 
                    // B nhanh hơn A -> B chém A
                    else if (speedB > speedA + 2) {
                        this.applyDamage(fighterA, 25, fighterB);
                        this.playSynthSound('hit');
                        this.sparks.emitParticleAt(clashX, clashY, 8);
                    } 
                    // Tốc độ bằng nhau (Nảy bật Clash)
                    else {
                        this.applyDamage(fighterA, 10, null);
                        this.applyDamage(fighterB, 10, null);
                        this.showDamageText(fighterA.body.x, fighterA.body.y, "CLASH!", '#a55eea');
                        this.playSynthSound('clash');
                        this.sparks.emitParticleAt(clashX, clashY, 15); // Nổ to tĩnh điện
                    }
                    
                    this.updateLeaderboard();
                }
            });
        });

        // Kết nối Socket
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
        this.socket = io(serverUrl);
        this.socket.on('match-config', (cfg: { maxFighters?: number }) => {
            if (typeof cfg.maxFighters === 'number' && cfg.maxFighters >= 4 && cfg.maxFighters <= 24) {
                this.maxFighters = cfg.maxFighters;
                this.updateLeaderboard();
            }
        });
        this.socket.on('game-spawn', (data: { username?: string; isBoss?: boolean }) => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            this.announceGiftSpawn(data.username, !!data.isBoss);
            this.spawnBall(data);
        });
        this.socket.on('game-buff', (data: { username?: string; buffType?: string }) => {
            this.announceGiftBuff(data.username, data.buffType);
            this.applyBuff(data as { username: string; buffType: string });
        });

        // Sau khi Matter xử lý va chạm — duy trì tốc độ không đổi (chỉ hướng đổi khi đập vật cản/bóng khác)
        this.matter.world.on('afterupdate', () => {
            for (const fighter of this.fighters) {
                if (fighter.hp > 0) {
                    this.enforceCruiseVelocity(fighter);
                }
            }
        });
    }

    /** Giữ độ lớn v ~ CRUISE; chỉ phục hồi hướng khi gần như đứng im */
    private enforceCruiseVelocity(fighter: FighterData) {
        const body = fighter.body.body as MatterJS.BodyType;
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        const speed = Math.hypot(vx, vy);
        const cruise = MainScene.CRUISE_SPEED;
        const max = MainScene.MAX_SPEED;

        if (speed < MainScene.STUCK_SPEED_EPS) {
            const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
            fighter.body.setVelocity(Math.cos(a) * cruise, Math.sin(a) * cruise);
            return;
        }
        if (speed < cruise) {
            const s = cruise / speed;
            fighter.body.setVelocity(vx * s, vy * s);
            return;
        }
        if (speed > max) {
            const s = max / speed;
            fighter.body.setVelocity(vx * s, vy * s);
        }
    }

    /** Chuẩn bị giọng tiếng Việt cho speechSynthesis (một số trình duyệt tải giọng bất đồng bộ) */
    private initGiftSpeechVoices() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const pick = () => {
            const list = window.speechSynthesis.getVoices();
            this.giftSpeechVoice =
                list.find(v => /^vi/i.test(v.lang)) ||
                list.find(v => /vietnam|vietnamese/i.test(v.name)) ||
                null;
        };
        pick();
        window.speechSynthesis.onvoiceschanged = pick;
    }

    private sanitizeNameForSpeech(raw: string): string {
        return raw
            .replace(/[_\-]+/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .trim()
            .slice(0, 48) || 'Khán giả';
    }

    /** Chỉ đọc khi quà thật từ TikTok — không đọc khi admin giả lập */
    private announceGiftSpawn(username: string | undefined, isBoss: boolean) {
        if (!username || username === 'Admin_Test') return;
        const name = this.sanitizeNameForSpeech(username);
        const line = isBoss
            ? `${name} tặng quà, triệu hồi boss rồng.`
            : `${name} tặng quà, chào mừng chiến binh mới.`;
        this.enqueueGiftSpeech(line);
    }

    private announceGiftBuff(username: string | undefined, buffType: string | undefined) {
        if (!username || username === 'Admin_Test' || !buffType) return;
        const name = this.sanitizeNameForSpeech(username);
        const label = MainScene.BUFF_LABEL_VI[buffType] || buffType;
        this.enqueueGiftSpeech(`${name} tặng quà buff ${label}.`);
    }

    private enqueueGiftSpeech(line: string) {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        while (this.giftSpeechQueue.length >= 8) {
            this.giftSpeechQueue.shift();
        }
        this.giftSpeechQueue.push(line);
        this.pumpGiftSpeechQueue();
    }

    private pumpGiftSpeechQueue() {
        if (this.giftSpeechBusy || this.giftSpeechQueue.length === 0) return;
        if (typeof window === 'undefined' || !window.speechSynthesis) return;

        this.giftSpeechBusy = true;
        const line = this.giftSpeechQueue.shift()!;
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(line);
        utter.lang = 'vi-VN';
        utter.rate = 1.02;
        utter.pitch = 1;
        if (this.giftSpeechVoice) {
            utter.voice = this.giftSpeechVoice;
        }

        utter.onend = () => {
            this.giftSpeechBusy = false;
            this.time.delayedCall(120, () => this.pumpGiftSpeechQueue());
        };
        utter.onerror = () => {
            this.giftSpeechBusy = false;
            this.time.delayedCall(120, () => this.pumpGiftSpeechQueue());
        };

        try {
            window.speechSynthesis.speak(utter);
        } catch {
            this.giftSpeechBusy = false;
            this.pumpGiftSpeechQueue();
        }
    }

    private applyDamage(target: FighterData, dmg: number, attacker: FighterData | null) {
        if (target.isShielded) {
            this.showDamageText(target.body.x, target.body.y, "BLOCKED!", '#00f2fe');
            // Mất khiên sau 1 đòn
            target.isShielded = false;
            if (target.shieldGraphic) target.shieldGraphic.destroy();
            return;
        }

        target.hp -= dmg;
        this.showDamageText(target.body.x, target.body.y, `-${dmg}`, '#ff4757');
        this.flashColor(target.body);

        if (attacker) {
            attacker.score += dmg;
        }
    }

    /** Vẽ lõi bóng + viền neon — tâm (48,48), mọi vũ khí dùng chung khung 96×96 */
    private static drawWeaponBallCore(g: Phaser.GameObjects.Graphics, bodyR = 20) {
        const cx = 48;
        const cy = 48;
        g.fillStyle(0x0d1117, 0.92);
        g.fillCircle(cx, cy, bodyR);
        g.lineStyle(2.5, 0x00f5ff, 0.75);
        g.strokeCircle(cx, cy, bodyR);
        g.lineStyle(1.5, 0xff2d95, 0.4);
        g.strokeCircle(cx, cy, bodyR - 1.2);
    }

    private forgeWeapons() {
        const S = 96;

        const mk = (key: string, draw: (gr: Phaser.GameObjects.Graphics) => void) => {
            const gr = this.add.graphics();
            MainScene.drawWeaponBallCore(gr, 20);
            draw(gr);
            gr.generateTexture(key, S, S);
            gr.destroy();
        };

        // Dao găm — nhỏ, lưỡi ngắn
        mk('wp_dagger', (gr) => {
            gr.fillStyle(0xc8d6e5, 1);
            gr.fillRect(52, 44, 28, 8);
            gr.fillStyle(0x74b9ff, 1);
            gr.fillRect(78, 45, 10, 6);
            gr.fillStyle(0xf6d365, 1);
            gr.fillRect(52, 44, 6, 8);
        });

        // Cung — gọn nhẹ
        mk('wp_bow', (gr) => {
            gr.lineStyle(4, 0xb968c7, 1);
            gr.beginPath();
            gr.arc(58, 48, 28, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(335), false);
            gr.strokePath();
            gr.lineStyle(2, 0xffffff, 0.95);
            gr.beginPath();
            gr.moveTo(58, 22);
            gr.lineTo(58, 74);
            gr.strokePath();
        });

        // Kunai — đối xứng
        mk('wp_kunai', (gr) => {
            gr.fillStyle(0x95a5a6, 1);
            gr.beginPath();
            gr.moveTo(52, 48);
            gr.lineTo(82, 40);
            gr.lineTo(82, 56);
            gr.closePath();
            gr.fillPath();
            gr.fillStyle(0x2d3436, 1);
            gr.fillRect(52, 45, 8, 6);
        });

        // Kiếm — lưỡi rộng, chuôi vàng
        mk('wp_sword', (gr) => {
            gr.fillStyle(0xc0392b, 1);
            gr.fillRect(52, 44, 34, 10);
            gr.fillStyle(0xf6d365, 1);
            gr.fillRect(52, 44, 8, 10);
            gr.fillStyle(0xecf0f1, 1);
            gr.fillRect(84, 46, 6, 6);
        });

        // Gậy phép — pha lê
        mk('wp_staff', (gr) => {
            gr.fillStyle(0x5f3dc4, 1);
            gr.fillRect(52, 18, 6, 52);
            gr.fillStyle(0x00f5ff, 0.55);
            gr.fillCircle(55, 22, 10);
            gr.lineStyle(2, 0xffffff, 0.95);
            gr.strokeCircle(55, 22, 10);
        });

        // Rìu — lưỡi đặc
        mk('wp_axe', (gr) => {
            gr.fillStyle(0x5c3a21, 1);
            gr.fillRect(52, 44, 22, 8);
            gr.fillStyle(0xb2bec3, 1);
            gr.beginPath();
            gr.moveTo(52, 32);
            gr.lineTo(78, 28);
            gr.lineTo(88, 48);
            gr.lineTo(72, 48);
            gr.closePath();
            gr.fillPath();
        });

        // Thương — tầm dài
        mk('wp_spear', (gr) => {
            gr.fillStyle(0x636e72, 1);
            gr.fillRect(52, 44, 44, 7);
            gr.fillStyle(0x38f9d7, 1);
            gr.beginPath();
            gr.moveTo(94, 42);
            gr.lineTo(112, 47.5);
            gr.lineTo(94, 53);
            gr.closePath();
            gr.fillPath();
        });

        // Búa — đầu to
        mk('wp_hammer', (gr) => {
            gr.fillStyle(0x6c5ce7, 1);
            gr.fillRect(52, 44, 10, 26);
            gr.fillStyle(0x95a5a6, 1);
            gr.fillRect(44, 28, 26, 14);
            gr.fillStyle(0x636e72, 1);
            gr.fillRect(44, 28, 26, 4);
        });

        // Liềm — cánh cong
        mk('wp_scythe', (gr) => {
            gr.fillStyle(0x95a5a6, 1);
            gr.fillRect(44, 48, 12, 36);
            gr.lineStyle(5, 0xffffff, 1);
            gr.beginPath();
            gr.arc(58, 48, 28, Phaser.Math.DegToRad(280), Phaser.Math.DegToRad(40), false);
            gr.strokePath();
            gr.lineStyle(2, 0xff2d95, 0.9);
            gr.beginPath();
            gr.arc(58, 48, 28, Phaser.Math.DegToRad(280), Phaser.Math.DegToRad(40), false);
            gr.strokePath();
        });

        // Shader Particle tàn lửa bốc cháy
        let g = this.add.graphics();
        g.fillStyle(0xffa502, 1); g.fillCircle(4, 4, 4);
        g.generateTexture('flare_p', 8, 8);
        g.destroy();

        // Buff: hồi máu (xanh)
        g = this.add.graphics();
        g.fillStyle(0x7bed9f, 1); g.fillCircle(8, 8, 8);
        g.generateTexture('heal_p', 16, 16);
        g.destroy();

        // Buff: lửa (ember)
        g = this.add.graphics();
        g.fillStyle(0xff6b35, 1); g.fillCircle(5, 5, 5);
        g.generateTexture('ember_p', 10, 10);
        g.destroy();

        // Buff: tốc độ (tia vàng)
        g = this.add.graphics();
        g.fillStyle(0xffe066, 1); g.fillCircle(4, 4, 3);
        g.generateTexture('spark_p', 8, 8);
        g.destroy();
    }

    /** Vòng sóng neon — không ảnh hưởng vật lý */
    private spawnShockwaveRing(x: number, y: number, color: number) {
        const state = { r: 18, alpha: 0.85 };
        const ring = this.add.graphics();
        this.tweens.add({
            targets: state,
            r: 95,
            alpha: 0,
            duration: 520,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
                ring.clear();
                ring.lineStyle(3, color, state.alpha);
                ring.strokeCircle(x, y, state.r);
            },
            onComplete: () => ring.destroy()
        });
    }

    private spawnHealBurst(x: number, y: number) {
        const emitter = this.add.particles(x, y, 'heal_p', {
            speed: { min: 80, max: 220 },
            angle: { min: 0, max: 360 },
            lifespan: 550,
            scale: { start: 0.55, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            tint: [0x43e97b, 0x7bed9f, 0xc8f7dc],
            rotate: { min: 0, max: 360 },
            emitting: false
        });
        emitter.explode(48);
        this.time.delayedCall(650, () => emitter.destroy());
    }

    private spawnDamageBurst(x: number, y: number) {
        const emitter = this.add.particles(x, y, 'flare_p', {
            speed: { min: 100, max: 280 },
            angle: { min: 0, max: 360 },
            lifespan: 420,
            scale: { start: 0.75, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            tint: [0xff4757, 0xff0844, 0xffa502],
            emitting: false
        });
        emitter.explode(36);
        this.time.delayedCall(500, () => emitter.destroy());
    }

    private attachSpeedTrail(fighter: FighterData) {
        if (fighter.speedTrailEmitter) {
            fighter.speedTrailEmitter.stopFollow();
            fighter.speedTrailEmitter.destroy();
        }
        const trail = this.add.particles(0, 0, 'spark_p', {
            lifespan: { min: 280, max: 520 },
            speedX: { min: -40, max: 40 },
            speedY: { min: -40, max: 40 },
            scale: { start: 0.55, end: 0 },
            alpha: { start: 0.85, end: 0 },
            blendMode: 'ADD',
            tint: [0xf6d365, 0xffe066, 0x00f5ff],
            frequency: 22,
            quantity: 2,
            rotate: { min: -180, max: 180 }
        });
        trail.startFollow(fighter.body);
        fighter.speedTrailEmitter = trail;
        this.time.delayedCall(3800, () => {
            if (!fighter.speedTrailEmitter) return;
            fighter.speedTrailEmitter.stopFollow();
            fighter.speedTrailEmitter.destroy();
            fighter.speedTrailEmitter = undefined;
        });
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
        
        // Update Game Stats UI
        if (this.gameStatsText) {
            this.gameStatsText.setText(`Chiến binh: ${this.fighters.length}/${this.maxFighters}\nSự kiện thả: ${this.gameStats.totalEvents}`);
        }
    }

    private applyBuff(data: { username: string, buffType: string }) {
        let targetList = this.fighters.filter(f => f.username === data.username);
        
        if (targetList.length === 0 && this.fighters.length > 0) {
            targetList = [...this.fighters].sort((a,b) => a.hp - b.hp); // Cứu kẻ yếu nhất
        }

        this.gameStats.totalEvents++; // Tăng sự kiện

        if (targetList.length > 0) {
            const target = targetList[0];
            const px = target.body.x, py = target.body.y;
            
            if (data.buffType === 'heal') {
                target.hp = Math.min(target.maxHp + 50, target.hp + 50); 
                this.spawnHealBurst(px, py);
                this.spawnShockwaveRing(px, py, 0x43e97b);
                this.showDamageText(px, py, "+50 HP HEAL", '#43e97b');
                this.flashColor(target.body, 0x43e97b);
                this.playSynthSound('heal');
            } 
            else if (data.buffType === 'speed') {
                target.body.setAngularVelocity(0.42);
                target.body.applyForce(new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-0.055, 0.055), Phaser.Math.FloatBetween(-0.055, 0.055)));
                this.attachSpeedTrail(target);
                this.spawnShockwaveRing(px, py, 0xf6d365);
                this.showDamageText(px, py, "SPEED UP!", '#f6d365');
                this.flashColor(target.body, 0xf6d365);
                this.playSynthSound('buff');
            }
            else if (data.buffType === 'damage') {
                target.score += 50;
                target.body.applyForce(new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-0.075, 0.075), Phaser.Math.FloatBetween(-0.075, 0.075)));
                this.spawnDamageBurst(px, py);
                this.spawnShockwaveRing(px, py, 0xff4757);
                this.showDamageText(px, py, "DAMAGE BOOST!", '#ff4757');
                this.flashColor(target.body, 0xff0844);
                this.playSynthSound('buff');
            }
            else if (data.buffType === 'shield') {
                target.isShielded = true;
                if (!target.shieldGraphic) {
                    target.shieldGraphic = this.add.graphics();
                }
                this.spawnShockwaveRing(px, py, 0x00f5ff);
                this.showDamageText(px, py, "SHIELD ACTIVATED!", '#00f2fe');
                this.playSynthSound('heal');
            }
            else if (data.buffType === 'burn') {
                target.isBurning = true;
                if (target.fireEmitter) {
                    target.fireEmitter.stopFollow();
                    target.fireEmitter.destroy();
                }
                target.fireEmitter = this.add.particles(0, 0, 'ember_p', {
                    lifespan: { min: 380, max: 920 },
                    speed: { min: 70, max: 240 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 0.9, end: 0 },
                    alpha: { start: 0.95, end: 0 },
                    blendMode: 'ADD',
                    tint: [0xff4500, 0xff6b35, 0xff1744, 0xffa502],
                    frequency: 12,
                    quantity: 3,
                    rotate: { min: 0, max: 360 }
                });
                target.fireEmitter.startFollow(target.body);
                this.spawnDamageBurst(px, py);
                this.showDamageText(px, py, "BURN!", '#ff4757');
                this.time.delayedCall(5000, () => {
                    target.isBurning = false;
                    if (target.fireEmitter) {
                        target.fireEmitter.stopFollow();
                        target.fireEmitter.destroy();
                        target.fireEmitter = undefined;
                    }
                });
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
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: colorHex,
            fontStyle: '700',
            stroke: '#020617',
            strokeThickness: 4
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
        if (this.fighters.length >= this.maxFighters) {
            // Loại bỏ quả bóng yếu nhất để nhường chỗ
            const weakest = [...this.fighters].sort((a, b) => a.hp - b.hp)[0];
            this.showDamageText(weakest.body.x, weakest.body.y, "REPLACED!", '#a4b0be');
            this.destroyFighter(weakest);
        }

        const { width, height } = this.scale;
        
        this.gameStats.totalEvents++; // Tăng sự kiện
        
        const startX = Phaser.Math.Between(100, width - 100);
        const startY = Phaser.Math.Between(100, height - 100);

        // Bốc ngẫu nhiên Vũ Khí cho Chiến binh
        const randomWeapon = Phaser.Utils.Array.GetRandom([...MainScene.WEAPON_KEYS]);
        const baseHit = MainScene.getWeaponHitRadius(randomWeapon);

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

        // Hitbox tròn khớp từng vũ khí (texture 96×96, tâm bóng 48,48)
        ball.setCircle(baseHit * scale);
        ball.setFriction(0);
        ball.setFrictionAir(0);
        ball.setBounce(0.985);
        ball.setMass(mass);

        const hpText = this.add.text(0, 0, `${data.username} (${startHp})`, {
            fontFamily: FONT_UI,
            fontSize: data.isBoss ? '15px' : '12px',
            color: data.isBoss ? '#f6d365' : '#e6edf3',
            backgroundColor: 'rgba(7, 10, 18, 0.82)',
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5);

        this.fighters.push({
            body: ball,
            text: hpText,
            hp: startHp,
            maxHp: startHp,
            username: data.username,
            score: 0,
            hitRadius: baseHit * scale
        });
        
        this.updateLeaderboard();

        const a0 = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const cs = MainScene.CRUISE_SPEED;
        ball.setVelocity(Math.cos(a0) * cs, Math.sin(a0) * cs);
        ball.setAngularVelocity(Phaser.Math.FloatBetween(-0.2, 0.2)); 
    }

    private destroyFighter(fighter: FighterData) {
        fighter.body.destroy();
        fighter.text.destroy();
        if (fighter.shieldGraphic) fighter.shieldGraphic.destroy();
        if (fighter.fireEmitter) {
            fighter.fireEmitter.stopFollow();
            fighter.fireEmitter.destroy();
        }
        if (fighter.speedTrailEmitter) {
            fighter.speedTrailEmitter.stopFollow();
            fighter.speedTrailEmitter.destroy();
        }
        this.fighters = this.fighters.filter(f => f !== fighter);
    }

    update(_time: number, _delta: number) {
        for (let i = this.fighters.length - 1; i >= 0; i--) {
            const fighter = this.fighters[i];
            
            if (fighter.hp <= 0) {
                this.showDamageText(fighter.body.x, fighter.body.y, "💀 DEFEATED!", '#a4b0be');
                this.destroyFighter(fighter);
                this.updateLeaderboard();
                this.playSynthSound('clash');
                continue;
            }

            const labelLift = fighter.hitRadius + 14;
            fighter.text.setPosition(fighter.body.x, fighter.body.y - labelLift);
            fighter.text.setText(`${fighter.username} (${Math.floor(fighter.hp)}❤)`);

            // Khiên: vẽ lại mỗi frame — nhịp đập + hai lớp viền
            if (fighter.isShielded && fighter.shieldGraphic) {
                const t = this.time.now;
                const baseR = fighter.hitRadius * 1.12;
                const pulse = 0.42 + Math.sin(t / 160) * 0.32;
                const r = baseR + Math.sin(t / 210) * 4;
                const g = fighter.shieldGraphic;
                g.clear();
                g.lineStyle(4, 0x00f5ff, pulse);
                g.strokeCircle(0, 0, r);
                g.lineStyle(2, 0xff2d95, pulse * 0.45);
                g.strokeCircle(0, 0, r + 7);
                g.setPosition(fighter.body.x, fighter.body.y);
            }
            if (fighter.isBurning) {
                fighter.hp -= 0.1;
            }
        }
    }

    // --- SOUND ENGINE (WEB AUDIO API SYNTH) ---
    private startBackgroundMusic() {
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(45, this.audioCtx.currentTime); // Low bass drone
            
            // LFO effect
            const lfo = this.audioCtx.createOscillator();
            lfo.frequency.value = 0.5;
            const lfoGain = this.audioCtx.createGain();
            lfoGain.gain.value = 5;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            gainNode.gain.value = 0.05; // Vol nhỏ, không át tiếng ồn
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            osc.start();
            lfo.start();
        } catch (e) {}
    }

    private playSynthSound(type: 'hit' | 'clash' | 'bounce' | 'heal' | 'buff') {
        if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
        
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const now = this.audioCtx.currentTime;

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            if (type === 'hit') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
            } else if (type === 'clash') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
            } else if (type === 'bounce') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.05);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'heal') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554, now + 0.1);
                osc.frequency.setValueAtTime(659, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
                osc.start(now); osc.stop(now + 0.4);
            } else if (type === 'buff') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
            }
        } catch(e) {}
    }
}
