# Tài Liệu Dự Án: Weapon Ball Battle Royale

Tài liệu này tổng hợp toàn bộ các tính năng, cơ chế và chức năng đã được xây dựng cho dự án game tương tác TikTok Live **Weapon Ball Battle Royale** dựa trên mã nguồn cấu hình hiện tại.

## 1. Tổng Quan Trò Chơi (Overview)

- **Thể loại**: Game đấu bóng mang vũ khí (dựa trên format của Earclacks) dành cho TikTok Live.
- **Cơ chế cơ bản**: Các quả bóng sẽ mang vũ khí xung quanh, gây sát thương lên đối thủ bằng cách va chạm trực tiếp, bắn rạn hoặc dùng các tương tác sát thương khác. Bóng nào cạn HP sẽ bị tiêu diệt.

## 2. Hệ Thống Vũ Khí (23 Loại)

Sự đa dạng của vũ khí tạo ra nhiều tính huống ngẫu nhiên thú vị trong chiến đấu:

1. **Cận chiến**: Sword ⚔️, Dagger 🗡️, Spear 🔱, Scythe 🌾, Shield 🛡️, Unarmed 👊, Katana ⛩️, Lance 🍢, Axe 🪓, Flail ⛓️, Rapier 🤺.
2. **Đánh xa / Ném**: Bow 🏹, Shuriken 🥷, Boomerang 🪃, Crossbow 🎯.
3. **Phép thuật / Nguyên tố**: Scepter ⚜️, Staff 🧹, Flask 🍾, Grimoire 📖, Torch 🔥, Scroll 📜.
4. **Cơ khí / Đập phá**: Wrench 🔧, Hammer 🔨.

## 3. Các Chế Độ Chơi (Game Modes)

Sự đa dạng của kịch bản combat:

- **🎯 1v1 (Standard)**: Đấu tay đôi truyền thống, 100 HP.
- **👑 Battle Royale**: 4-8 bóng sinh tồn trong đấu trường. Tính năng bổ sung đi kèm: bản đồ thu hẹp dần (Arena Shrink), hộp hồi máu ngẫu nhiên (HP Packs), tích hợp môi trường không trọng lực (Anti-gravity).
- **👥 Teamfight**: Đấu phối hợp theo đội 4 vs 4.
- **🐉 Giga Ball Boss Raid**: Chế độ đi săn Boss tập thể, 6-8 bóng nhỏ cùng đánh bại 1 Boss khổng lồ (Giga Ball: 10,000 HP).
- **🏐 Dodgeball**: Hai bóng chia phe ở 2 đầu sân, đánh "bóng tàng hình" đi qua lại để gây damage.
- **⏱️ Time Trials**: Cuộc đua với thời gian, 1 bóng phải hạ gục bóng trắng mục tiêu khổng lồ trong vòng 60 giây.
- **💪 1v100**: Chế độ thử thách sinh tồn cực đoan: 1 đấu với 100 quân địch cấp thấp.

## 4. Cơ Chế Thức Tỉnh - Super Ball

Phiên bản tiến hoá vòng sâu của các Bóng Cơ Bản:

- Lượng HP Tối đa được đẩy lên **500 HP** đi kèm với việc có vòng tròn trắng để nhận diện.
- Nâng cấp vũ khí thành Super Form (Ví dụ: Super Sword, Super Flask, Super Bow, v.v..), áp dụng cho danh sách 14 loại vũ khí quen thuộc.

## 5. Tương Tác Của Người Xem (TikTok Live Gifts & Comments)

Game tương tác thời gian thực sẽ tiếp nhận quà tặng/comment để can thiệp diễn biến trận đấu bằng API:

### 5.1. Quy Đổi Quà Tặng (Gifts Effect)

| Quà tặng (Gift)      | Giá trị (Xu) | Chức năng quy đổi (In-game Effect) | Hiệu Ứng Giao Diện (Visual) |
| :------------------- | :----------- | :--------------------------------- | :-------------------------- |
| ❤️ Heart             | 1            | Triệu hồi 1 lính 1⭐               | Tim bay xuống sân           |
| 🌹 Rose              | 5            | Triệu hồi 2 lính 1⭐               | Hoa hồng rơi, lấp lánh      |
| 💎 Diamond           | 15           | Triệu hồi 3 lính 2⭐               | Kim cương tỏa sáng          |
| 🐇 Rabbit            | 30           | Triệu hồi 4 lính 2⭐               | Thỏ nhảy xuống sân          |
| 🎵 Music             | 50           | Triệu hồi 5 lính 2⭐               | Nốt nhạc bay                |
| 🚀 Rocket            | 100          | Triệu hồi 6 lính 3⭐               | Tên lửa bay ngang qua       |
| 🦅 Eagle             | 150          | Triệu hồi 7 lính 3⭐               | Đại bàng bay lượn           |
| 🏆 Crown             | 200          | Triệu hồi 8 lính 3⭐               | Vương miện ánh vàng         |
| 🦋 Butterfly         | 60           | Triệu hồi 5 lính 3⭐               | Đàn bướm bay lượn           |
| 🔮 Crystal Ball      | 120          | Triệu hồi Tướng 4⭐                | Quả cầu pha lê rớt          |
| 👑 King              | 300          | Triệu hồi Super Ball 5⭐           | Biểu tượng Vua xuất hiện    |
| 🐉 Dragon            | 500          | Triệu hồi Boss Ball / Rồng Boss    | Rồng bay càn quét           |
| **HỖ TRỢ CHIẾN ĐẤU** |              |                                    |                             |
| 💋 Lips              | 25           | Bơm hồi 20% HP                     | Nụ hôn bay                  |
| ⭐ Star              | 35           | Tăng 10% Tốc đánh (AS)             | Sao băng                    |
| 💪 Biceps            | 40           | Tăng 15% Sát thương (Damage)       | Biểu tượng Cơ bắp           |
| 🎁 Gift Box          | 45           | Nhận Buff bất kỳ ngẫu nhiên        | Hộp quà được mở bung        |
| 🌈 Rainbow           | 80           | Kích hoạt hiệu ứng hào quang       | Cầu vồng rực rỡ             |

### 5.2. Chức Năng Bằng Lệnh Khán Giả Chat (Comments)

- Lệnh **"1"**: Đăng ký tham gia vào Phe Xanh.
- Lệnh **"2"**: Đăng ký tham gia vào Phe Đỏ.
- Lệnh **"⚡"**: Tăng tốc / Bơm buff tạm thời cho phe mình chọn.
- Lệnh **"❓"**: Bật bảng HUD hướng dẫn tóm tắt góc màn hình.

### 5.3. Tương Tác Đặc Biệt Dạng Chuỗi (Special Combos)

Các hành động combo yêu cầu dồn số lượng quà nhất định:

- **✈️ Máy Bay (Dồn 4x Rocket - 400 Xu)**: Chuyển đổi môi trường lập tức thành không trọng lực (Anti-Gravity) và gọi 1 Weapon Ball hiếm (5⭐) xuống map.
- **💕 Cặp Đôi (Dồn 2x Lips - 50 Xu)**: Kích hoạt hợp thể (Merge) 2 quả bóng đang có trên sân thành 1 đơn vị mạnh hơn.
- **🌪️ Bão Tố (Dồn 5x Rocket - 500 Xu)**: Đóng vòng đột ngột (Thu nhỏ kích thước Arena còn 1/2) đẩy nhanh nhịp độ dọn map (End-game rush).

## 6. Cơ Chế Di Chuyển & Mô Phỏng Vật Lý (Physics & Movement)

Điểm nhấn tạo nên sự thỏa mãn (satisfying) của game là hệ thống tương tác và vật lý, các Weapon Balls không đứng yên mà tuân theo:

- **Tự động di chuyển (Auto-Movement)**: Các bóng liên tục trượt, nảy và trôi trong sân đấu theo các vector lực, người chơi không cần điều khiển thủ công.
- **Tương tác vật lý không gian (Environment Collision)**: Bóng đập vào tường sẽ nảy lại (bounce). Các vũ khí vung đập sẽ xảy ra va chạm vật lý với nhau, tạo ra các lực đẩy ngược làm văng đối thủ về phía sau.
- **Động học vũ khí (Weapon Kinematics)**: Các vũ khí hạng nặng (như Hammer, Wrench) hay các đòn đánh mạnh sẽ tạo ra xung lực vật lý lớn hơn đẩy các quả bóng khác dạt ra ngoài mạnh.
- **Trọng lực & Ma sát**: Game thiết lập liên quan tới trọng lực tổng thể sân đấu, độ nảy của tường và độ ma sát sàn nhằm tạo ra một môi trường hỗn loạn đẹp mắt.

## 7. Chỉ Số Cân Bằng Và Setup Khác (Game Mechanics Config)

- **Hệ lượng Máu Đặc Thù**:
  - Standard Fight: 100 HP.
  - Battle Royale: 500 HP.
  - Extended Fight: 250 HP.
  - Săn Boss Giga: Tới 10,000 HP.
- **Cơ chế môi trường có thể bật/tắt**:
  - `Anti-Gravity` (Không trọng lực): Tắt trọng lực, các bóng lơ lửng và nảy tự do, tạo ra các va chạm liên tục đan xen.
  - `Arena Shrink` (Phép thu nhỏ vách tường - Vòng bo): Các rào chắn hẹp dần ép các Weapon Balls phải va vào nhau liên tục.
  - `Health Packs Spawn` (Đánh rơi ngẫu nhiên gói hồi máu trên map để lật kèo): Đã bật.

## 8. Công Nghệ Đề Xuất Sự Dụng (Tech Stack)

Dựa trên yêu cầu của một game TikTok Live phải chạy liên tục, tối ưu và xử lý hạt/vật lý khối lượng lớn, hệ thống nên sử dụng:

- **Game Engine / Render (Frontend):**
  - Đề xuất: **Phaser 3** hoặc **PixiJS**. Rất mạnh trong việc render hình ảnh 2D tĩnh và Sprite tốc độ cao (siêu mượt tại 60FPS cho Web).
- **Mô phỏng Vật lý (Physics Engine):**
  - Đề xuất: **Matter.js** (Phổ biến, dễ tích hợp, chuyên xử lý nảy, va chạm và động lực học 2D rất chuẩn xác như video của Earclacks).
- **Backend & Logic Server:**
  - Đề xuất: **Node.js** kết hợp **TypeScript**. NodeJS nhanh nhẹ, lý tưởng để xử lý vô số luồng sự kiện I/O bất đồng bộ liên tục khi user thả tim/tặng quà.
- **Tiếp nhận luồng TikTok Live:**
  - Đề xuất: Thư viện `tiktok-live-connector` (Unofficial library cực mạnh cho Node.js để bắt sự kiện Gift, Comment, Like thời gian thực).
- **Real-time Communication:**
  - Định tuyến: **Socket.io** (Truyền lệnh từ Backend "Có đứa tặng quà The King" -> Frontend Game sẽ tức thì "Rơi quân bài The King").

## 9. Các Tính Năng & Hệ Thống Đề Xuất Bổ Sung (Recommendations)

Để đảm bảo game có thể vận hành trơn tru và giữ chân khán giả tốt nhất, dự án nên cân nhắc bổ sung các hệ thống sau:

1. **Hệ Thống Hàng Đợi Quà Tặng (Gift Queue System):**
   - **Vấn đề:** Khi có VIP ném 100 cái quà cùng lúc, nếu game render ra sân 100 bóng ngay lập tức sẽ gây Crash (sập Live) hoặc lag cục bộ.
   - **Giải pháp:** Cần xây dựng thuật toán Queue. Quà nào rơi trước xử lý trước, mỗi giây chỉ nhả tối đa một lượng bóng nhất định, số còn lại vào hàng chờ (Queue) để rớt từ từ xuống.
2. **Hệ Thống Khen Thưởng (Leaderboard / MVP):**
   - Triển khai góc vinh danh "Top 3 Donators" hoặc MVP Của Trận trực tiếp ngay trên khung giao diện của trận đấu. Việc thấy tên mình lấp lánh sẽ kích thích hiệu ứng đám đông quyên góp thêm.
3. **Sound Design (Hiệu ứng âm thanh & BGM):**
   - Sự thỏa mãn (satisfying) của game dạng này tới 40% từ âm thanh. Cần có SFX khi kim loại gõ vào nhau (Clank!), tiếng bo thu hẹp nguy hiểm (Siren) và tiếng nhạc BGM dồn dập (Rush mode) về cuối trận.
4. **Hệ Thống Tối Ưu Rác (Memory Garbage Collector):**
   - Đối với game Live nhiều tiếng đồng hồ, các hiệu ứng hạt (Particles) như tia lửa, máu, chữ bay lên (Damage Text) phải được xóa (destroy) khỏi bộ nhớ hoàn toàn sau khi biến mất. Nếu không, game sẽ ngày càng nặng và bị tràn RAM sau vài giờ live.
5. **Auto-Kick / AFK Prevention & Tính năng "Thảm Họa":**
   - Việc trận đấu kéo dài quá lâu (bóng né nhau liên tục) sẽ gây nhàm chán. Cần bổ sung Random Events (Thiên thạch rơi, sàn dung nham) nếu trận đấu quá 3 phút vẫn chưa kết thúc để bắt buộc kết thúc ván nhanh chóng.
