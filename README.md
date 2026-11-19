# 30 Ngày Cuối

Game kinh doanh / quản lý: bạn là môi giới hầm trú ẩn trong 30 ngày trước khi thiên thạch rơi.

## Chạy game

```bash
npm install
npm run dev
```

Mở http://localhost:5173 (hoặc cổng Vite báo ra).

Build bản phát hành: `npm run build` → thư mục `dist/`.

## Cấu trúc

```
src/
  data/            ← NỘI DUNG GAME (sửa ở đây, không cần đụng code)
    balance.json   ← mọi con số cân bằng: tiền khởi điểm, tốc độ hoảng loạn, giá VIP...
    zones.json     ← các khu hầm
    customers.json ← khách hàng vào văn phòng
    events.json    ← tin tức / sự kiện mỗi sáng
    rumors.json    ← các lệnh trong Sổ Đen
  game/
    types.ts       ← định nghĩa kiểu dữ liệu
    engine.ts      ← toàn bộ luật chơi (không dính giao diện)
  ui/
    ui.ts          ← dựng giao diện, xử lý bấm nút
    fx.ts          ← hiệu ứng: tiền bay, rung, gõ chữ...
    portrait.ts    ← chân dung bóng đen (có thể thay bằng ảnh)
  styles.css       ← toàn bộ giao diện + hoạt ảnh
```

## Thêm một vị khách mới

Thêm một object vào `src/data/customers.json`:

```json
{
  "id": "ten_khong_dau",
  "name": "Tên hiển thị",
  "role": "Nghề nghiệp",
  "portrait": { "color": "#4a3b52", "hat": "fedora", "glasses": true, "build": "slim" },
  "minDay": 3, "maxDay": 20, "weight": 2,
  "lines": ["Câu thoại 1", "Câu thoại 2"],
  "choices": [
    { "label": "Lựa chọn A", "requires": ["slot"], "effects": { "sellSlot": 2, "conscience": -1 }, "result": "Kết quả hiển thị" }
  ]
}
```

- `hat`: `none | fedora | cap | beret | helmet | bun | hood`
- Muốn dùng ảnh thật: thêm `"image": "/portraits/ten.png"` vào `portrait` và đặt ảnh vào thư mục `public/portraits/`.
- `requires`: `"slot"` (phải đang giữ suất) hoặc `"flag:ten_co"`.
- `scripted: true` → khách chỉ xuất hiện khi được hẹn bằng `schedule`.

### Các hiệu ứng (`effects`)

| Khóa | Ý nghĩa |
|---|---|
| `cash` | Cộng/trừ tiền (tự nhân theo thời gian) |
| `sellSlot` / `buySlot` | Bán/mua 1 suất với giá thị trường × hệ số |
| `giveSlot` | Cho đi 1 suất |
| `panic` / `panicNatural` | Hoảng loạn do bạn / tự nhiên |
| `suspicion` | Nghi ngờ |
| `bunker` | Độ bền hầm riêng (+%) |
| `conscience` | Lương tâm (ảnh hưởng phần kết) |
| `flag` / `removeFlag` | Đặt / gỡ cờ cốt truyện |
| `schedule` | Hẹn sự kiện/khách: `{ "type": "event", "id": "...", "inDays": 3 }` |
| `zone` + `zoneSentiment` / `zoneIntegrity` / `supplyMul` | Tác động một khu |
| `sentimentAll` | Nhân giá mọi khu |

## Debug

Khi chạy `npm run dev`, mở console trình duyệt: `__ui.game.s` là toàn bộ trạng thái game.
