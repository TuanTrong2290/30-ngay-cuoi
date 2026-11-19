# Hướng dẫn viết nội dung cho "30 Ngày Cuối"

> **Dành cho AI / người viết nội dung.** Đọc hết file này trước khi viết. Nội dung trả về phải là **JSON hợp lệ** theo đúng định dạng bên dưới — game đọc trực tiếp các file này, không có bước chỉnh tay.

---

## 1. Game là gì

- **Bối cảnh:** Thiên thạch sẽ va vào Trái Đất sau 30 ngày. Thành phố là **Sài Gòn** (có thể nhắc địa danh Việt Nam).
- **Người chơi:** một **môi giới hầm trú ẩn** — mua bán "suất" trong các khu hầm, tung tin đồn thao túng giá, tiếp khách hàng tuyệt vọng.
- **Chủ đề:** lòng tham, đạo đức xám, hài hước đen, châm biếm. Lòng tham của người chơi tự đẩy giá vé thoát thân của chính họ lên.
- **Giọng văn:** tiếng Việt tự nhiên, ngắn gọn, có hình ảnh. Câu thoại của khách 1–2 câu, mỗi câu ≤ 30 từ. Kết quả lựa chọn 1–2 câu, gợi cảm xúc, **không giảng đạo**.
- **Tránh:** tên người thật / tổ chức / thương hiệu có thật; nội dung tình dục; bạo lực chi tiết, máu me; tự sát. Bi kịch được, nhưng gợi ý thay vì mô tả.

## 2. Vòng lặp mỗi ngày

1. **Sáng:** báo đăng tin tức (`events.json`) + tin đồn người chơi tung đêm trước.
2. **Ban ngày:** mua/bán suất trên sàn; tiếp **2 khách** (`customers.json`), mỗi khách có 2–4 lựa chọn.
3. **Đêm:** tối đa 2 lệnh trong Sổ Đen (`rumors.json`).

**Các chỉ số:**

| Chỉ số | Ý nghĩa |
|---|---|
| Tiền | Bắt đầu $100K. Giá suất thường từ $12K–$60K đầu game, tăng gấp ~5–10 lần cuối game |
| Hoảng loạn (0–100) | Đẩy giá mọi thứ lên, đặc biệt vé VIP. Có phần "tự nhiên" và phần "do bạn" |
| Nghi ngờ (0–100) | 100 = bị bắt, thua. Tự giảm 3/ngày |
| Hầm riêng (%) | Độ bền hầm của người chơi = tỷ lệ sống sót nếu không có vé VIP |
| Lương tâm | Ẩn. Ảnh hưởng phần kết. ≥ 6 là "còn trái tim", ≤ −6 là "kẻ buôn mạng người" |

## 3. Định dạng dữ liệu

Tất cả nằm trong `src/data/`. **Chỉ thêm, không sửa/xoá mục có sẵn** (trừ khi được yêu cầu).

### 3.1 Khách hàng — `customers.json`

```json
{
  "id": "ten_khong_dau_snake_case",
  "name": "Tên hiển thị",
  "role": "Nghề nghiệp / hoàn cảnh ngắn",
  "portrait": { "color": "#4a3b52", "hat": "fedora", "glasses": true, "build": "slim" },
  "minDay": 3,
  "maxDay": 20,
  "weight": 2,
  "lines": ["Câu thoại 1", "Câu thoại 2"],
  "choices": [
    {
      "label": "Nhãn nút (≤ 40 ký tự)",
      "hint": "Gợi ý ngắn (tuỳ chọn)",
      "requires": ["slot"],
      "effects": { "sellSlot": 2, "conscience": -1 },
      "result": "Điều xảy ra sau khi chọn."
    }
  ]
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | ✔ | duy nhất, chữ thường không dấu, `_` |
| `portrait.color` | ✔ | màu hex **tối** (độ sáng thấp), là màu ánh viền của bóng đen |
| `portrait.hat` | | `none` `fedora` `cap` `beret` `helmet` `bun` `hood` |
| `portrait.build` | | `slim` `broad` `small` |
| `minDay`/`maxDay` | ✔ | 1–30, `minDay ≤ maxDay` |
| `weight` | | 1–3, càng cao càng hay xuất hiện |
| `scripted` | | `true` = chỉ xuất hiện khi được hẹn bằng `schedule` |
| `requiresFlag` / `forbidFlag` | | chỉ xuất hiện khi có / không có cờ |
| `lines` | ✔ | 1–3 câu |
| `choices` | ✔ | 2–4 lựa chọn. **Luôn có ít nhất 1 lựa chọn không có `requires` và không tốn tiền** (để người chơi không bị kẹt) |
| `requires` | | `"slot"` (phải đang giữ ≥1 suất) hoặc `"flag:ten_co"` |

### 3.2 Tin tức / sự kiện — `events.json`

```json
{
  "id": "ten_su_kien",
  "minDay": 5, "maxDay": 25, "weight": 2,
  "headline": "Tít báo giật gân (≤ 70 ký tự)",
  "body": "1–2 câu chi tiết.",
  "effects": { "zone": "D", "zoneSentiment": 0.8, "zoneIntegrity": -6 }
}
```

`scripted: true` = chỉ xảy ra khi được hẹn bằng `schedule` (dùng cho chuỗi cốt truyện). Mỗi sự kiện chỉ xảy ra **một lần mỗi ván**.

### 3.3 Lệnh Sổ Đen — `rumors.json`

```json
{
  "id": "ten_lenh",
  "name": "Tên lệnh",
  "desc": "Mô tả tác dụng cho người chơi.",
  "cost": 10000,
  "target": "zone",
  "sentimentMul": 0.7,
  "panic": 4,
  "suspicion": 8,
  "headline": "Tít báo sáng mai — {zone} sẽ được thay bằng tên khu",
  "body": "Nội dung bài báo."
}
```

| Trường | Ghi chú |
|---|---|
| `target` | `"zone"` (chọn một khu) hoặc `"none"` |
| `sentimentMul` | nhân giá khu mục tiêu (0.45 = sập giá, 1.3 = tăng giá) |
| `debunk` | đặt giá khu = max(hiện tại, 1) × giá trị này |
| `spill` | nhân giá **các khu khác** |
| `dump` | `true` = ngày mai số suất rao bán ở khu đó tăng gấp đôi |
| `sentimentAll` | nhân giá mọi khu |
| `panic`, `suspicion` | cộng vào chỉ số (`suspicion` âm = giảm nghi ngờ) |
| `headline` | để `""` nếu lệnh không lên báo |

### 3.4 Khu hầm — `zones.json`

```json
{ "id": "F", "name": "Tên khu", "short": "KHU F", "desc": "Mô tả 1 câu.", "basePrice": 25000, "integrity": 60, "supply": 4 }
```

`integrity` = độ bền **thật** (người chơi không thấy, trừ khi mua thông tin). `supply` = số suất rao bán mỗi ngày (2–8). Thêm khu mới làm bảng giá dài ra — tối đa 7 khu.

## 4. Bảng hiệu ứng (`effects`)

Dùng chung cho lựa chọn của khách và sự kiện. **Chỉ được dùng các khoá dưới đây.**

| Khoá | Kiểu | Ý nghĩa | Khoảng hợp lý |
|---|---|---|---|
| `cash` | số | Cộng/trừ tiền. **Tự nhân theo thời gian** (×1.06 → ×2.8), nên ghi giá trị *đầu game* | −60000 … +40000 |
| `sellSlot` | số | Bán 1 suất người chơi đang giữ, giá = thị trường × hệ số. **Cần `requires: ["slot"]`** | 0.5 … 4 |
| `buySlot` | số | Người chơi mua 1 suất, giá = thị trường × hệ số. Dùng với `zone` để chọn khu | 0.3 … 1.5 |
| `giveSlot` | `true` | Cho đi 1 suất. **Cần `requires: ["slot"]`** | |
| `panic` | số | Hoảng loạn **do người chơi** | −15 … +12 |
| `panicNatural` | số | Hoảng loạn tự nhiên (dùng cho sự kiện) | −5 … +8 |
| `suspicion` | số | Nghi ngờ | −30 … +18 |
| `bunker` | số | Độ bền hầm riêng (+%) | +5 … +25 |
| `conscience` | số | Lương tâm | −3 … +4 |
| `flag` | chuỗi | Đặt cờ cốt truyện | |
| `removeFlag` | chuỗi | Gỡ cờ | |
| `schedule` | object | Hẹn sự kiện/khách: `{ "type": "event" \| "visitor", "id": "...", "inDays": 3 }` — id phải tồn tại và nên là mục `scripted` | `inDays` 0–6 |
| `zone` | chuỗi | Khu bị tác động (`A`–`E` hoặc khu mới) | |
| `zoneSentiment` | số | Nhân giá khu `zone` | 0.6 … 1.4 |
| `zoneIntegrity` | số | Cộng độ bền thật của khu `zone` | −15 … +15 |
| `supplyMul` | số | Nhân số suất rao bán hôm nay ở khu `zone` (0 = không ai bán) | 0 … 2 |
| `sentimentAll` | số | Nhân giá mọi khu | 0.85 … 1.15 |

### Cân bằng

- Lựa chọn **có lợi về tiền** nên có cái giá: lương tâm giảm, nghi ngờ tăng, hoặc hậu quả hẹn giờ (`schedule`).
- Lựa chọn **tử tế** thường mất tiền/suất nhưng tăng lương tâm, đôi khi giảm nghi ngờ.
- Không tạo lựa chọn "tốt toàn diện" (vừa lời tiền, vừa giảm nghi ngờ, vừa tăng lương tâm).

## 5. Cờ (flags) hiện có

| Cờ | Có tác dụng cơ chế? |
|---|---|
| `biet_su_that` | ✔ Hiện độ bền thật của các khu |
| `co_bot` | ✔ Tin đồn chỉ gây 60% nghi ngờ |
| `cartel` | ✔ Tin đồn mạnh ×1.5 |
| `quan_che` | ✔ Thoát bị bắt 1 lần |
| `bo_cho`, `bo_mua`, `bo_bi_ep`, `bo_tuchoi`, `bo_duoi` | Phần kết (chuyện ông Hòa) |
| `cuu_me_con`, `co_ky_su` | Phần kết |
| `quan_mua`, `mom_tin`, `to_doi_thu` | Chỉ đánh dấu |

Cờ **mới** dùng được ngay cho `requires`, `requiresFlag`, `forbidFlag`. Muốn cờ mới có **câu kết riêng** hay **tác dụng cơ chế mới** → ghi rõ trong phần "Ghi chú cho lập trình viên" ở cuối câu trả lời (cần sửa `src/game/engine.ts`).

## 6. Chuỗi cốt truyện (mẫu)

Khách A từ chối → hẹn sự kiện → sự kiện hẹn khách quay lại:

```
customers: ong_bo  --(Từ chối: schedule event bo_tin, 3 ngày)-->
events:    bo_tin (scripted) --(schedule visitor ong_bo_2, 0 ngày)-->
customers: ong_bo_2 (scripted)
```

Chuỗi 2–3 bước như vậy làm người chơi cảm thấy lựa chọn có hậu quả — **rất khuyến khích**.

## 7. Cách trả kết quả

Trả về **từng file riêng**, mỗi file là **một mảng JSON chỉ chứa các mục MỚI**:

````
### customers.json (thêm)
```json
[ { ... }, { ... } ]
```

### events.json (thêm)
```json
[ ... ]
```

### Ghi chú cho lập trình viên
- (cờ mới cần câu kết, cơ chế mới cần code...)
````

Không bình luận trong JSON. Dùng dấu `"` thẳng. Kiểm tra mọi `id` được tham chiếu (`schedule`, `requires`) đều tồn tại.

---

## Câu lệnh mẫu để giao cho AI

> Đây là game "30 Ngày Cuối". Đọc kỹ CONTENT_GUIDE.md và các file JSON đính kèm (nội dung hiện có — đừng trùng ý tưởng).
> Hãy viết thêm: **8 khách hàng mới** (trong đó có 1 chuỗi cốt truyện 2–3 bước dùng `scripted` + `schedule`), **8 sự kiện tin tức mới**, và **2 lệnh Sổ Đen mới**.
> Ưu tiên nhân vật đậm chất Việt Nam, tình huống đạo đức khó chọn, hài hước đen. Trả kết quả đúng định dạng mục 7.
