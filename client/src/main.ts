import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#070a12',
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: 0 },
            debug: false,
            // Giảm rung / chồng lấn khi va chạm — chuyển động mượt hơn
            positionIterations: 12,
            velocityIterations: 10,
            constraintIterations: 6,
            enableSleeping: false
        }
    },
    scene: [MainScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

function boot() {
    return new Phaser.Game(config);
}

// Đợi font Google tải xong để chữ HUD trong Phaser khớp typography
if (document.fonts?.ready) {
    document.fonts.ready.then(boot).catch(boot);
} else {
    boot();
}
