import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0d1117',
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: 0 }, // Không trọng lực (Anti-Gravity)
            debug: true // Hiện viền vật lý hỗ trợ develop
        }
    },
    scene: [MainScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Các thành phần UI (Trạm điều khiển Admin) đã được di chuyển hoàn toàn sang trang admin.html.
// Màn hình chính này bây giờ SẠCH tuyệt đối để đưa lên OBS Livestream.

export default new Phaser.Game(config);
