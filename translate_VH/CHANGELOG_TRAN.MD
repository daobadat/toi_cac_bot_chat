# CHANGELOG — translate_VH/test.js

> Ghi lại toàn bộ lịch sử thay đổi qua hội thoại  
> File: `c:\Users\ADD\Projects\toi_uu_lai_bot_chat\translate_VH\test.js`  
> Ngày: 2026-07-30

---

## 🔁 Lần thay đổi 1 — Fix logic hiển thị dòng cảnh báo tiếng Hàn

**Thời gian:** 09:46 (UTC+7)

**Yêu cầu của bạn:**
> Nếu là tin nhắn không có @son, @minchang thì sẽ dịch bình thường và hiện lên dòng trước là:
> `친애하는 사장님, 비록 베트남어 부분에서는 사장님이 아닌 다른 사람을 언급하고 있습니다.`
> Và nếu có tag và dòng đầu là "Thưa Boss" thì sẽ hiểu và không hiện dòng đó.

**Vấn đề cũ:** Code chỉ check `Dear Boss` bằng regex, không kiểm tra tag `@son`/`@minchang`.

**Thay đổi:**
- Thêm kiểm tra `hasTagSonOrMinchang` bằng regex `/@s[oô]n\b/i` và `/minchang/i`
- Thêm kiểm tra `startsWithThuaBoss` cho dòng đầu tiên (`/^th[uư]a\s+boss/i` hoặc `/^dear\s*boss/i`)
- Ban đầu logic: chỉ không thêm dòng khi có "Thưa/Dear Boss" ở đầu

**Code diff (lần 1):**
```diff
+ var hasTagSonOrMinchang = /@s[oô]n\b/i.test(responsefinal) || /minchang/i.test(responsefinal);
+ var firstLine = responsefinal.split('\n')[0].trim();
+ var startsWithThuaBoss = /^th[uư]a\s+boss/i.test(firstLine) || /^dear\s*boss/i.test(firstLine);
- if (!/dear\s*boss/i.test(responsefinal)) {
+ if (!startsWithThuaBoss) {
    translatedText = "친애하는 사장님, 비록 베트남어....\n" + translatedText;
  }
```

---

## 🔁 Lần thay đổi 2 — Sửa lại: có @Son/@MinChang thì không thêm gì cả

**Thời gian:** 09:49 (UTC+7)

**Yêu cầu của bạn:**
> Có @Son/@MinChang nhưng không có "Thưa Boss" — cái này là không dịch thêm, không tự động thêm dòng 친애하는 사장님.

**Phân tích logic đúng:**
- Có `@Son/@MinChang` → dịch bình thường, KHÔNG thêm gì cả
- Không có tag + không có "Dear/Thưa Boss" → thêm dòng cảnh báo
- Không có tag + có "Dear/Thưa Boss" → dịch bình thường (AI tự dịch)

**Code diff (lần 2):**
```diff
- if (!startsWithThuaBoss) {
+ if (!hasTagSonOrMinchang && !startsWithThuaBoss) {
    translatedText = "친애하는 사장님, 비록 베트남어 부분에서는 사장님이 아닌 다른 사람을 언급하고 있습니다.\n" + translatedText;
  }
```

**Bảng logic sau lần 2:**

| Tin nhắn | Kết quả |
|---|---|
| Có `@Son/@MinChang` + có "Thưa Boss" | Dịch bình thường ✅ |
| Có `@Son/@MinChang` + không có "Thưa Boss" | Dịch bình thường ✅ (không thêm gì) |
| Không có tag + không có "Dear/Thưa Boss" | Thêm `친애하는 사장님, 비록...` ở đầu |
| Không có tag + có "Dear/Thưa Boss" | Dịch bình thường ✅ |

---

## 🔁 Lần thay đổi 3 — Sửa lại: có @Son/@MinChang nhưng thiếu "Thưa Boss" → tự thêm lời chào

**Thời gian:** 09:51 (UTC+7)

**Yêu cầu của bạn:**
> Có @Son/@MinChang + không có "Thưa Boss" — ở đây là không có thưa boss thì sẽ tự động thêm vào đầu (친애하는 사장님).

**Phân tích logic đúng (lần 3):**
- Có `@Son/@MinChang` + không có "Thưa Boss" → thêm `친애하는 사장님,\n` ở đầu (chỉ lời chào)
- Có `@Son/@MinChang` + có "Thưa Boss" → dịch bình thường
- Không có tag + không có "Dear/Thưa Boss" → thêm cả dòng cảnh báo đầy đủ
- Không có tag + có "Dear/Thưa Boss" → dịch bình thường

**Code diff (lần 3):**
```diff
- if (!hasTagSonOrMinchang && !startsWithThuaBoss) {
-   translatedText = "친애하는 사장님, 비록 베트남어...\n" + translatedText;
- }
+ if (!startsWithThuaBoss) {
+   if (hasTagSonOrMinchang) {
+     // Có tag @son/@minchang nhưng thiếu lời chào → chỉ thêm lời chào
+     translatedText = "친애하는 사장님,\n" + translatedText;
+   } else {
+     // Không có tag, không có lời chào → thêm cả dòng cảnh báo
+     translatedText = "친애하는 사장님, 비록 베트남어 부분에서는 사장님이 아닌 다른 사람을 언급하고 있습니다.\n" + translatedText;
+   }
+ }
```

**Bảng logic sau lần 3 (FINAL):**

| Tin nhắn | Kết quả |
|---|---|
| Có `@Son/@MinChang` + **không** có "Thưa Boss" | Thêm `친애하는 사장님,` ở đầu |
| Có `@Son/@MinChang` + có "Thưa Boss" | Dịch bình thường ✅ |
| Không có tag + **không** có "Dear/Thưa Boss" | Thêm `친애하는 사장님, 비록 베트남어 부분에서는...` |
| Không có tag + có "Dear/Thưa Boss" | Dịch bình thường ✅ |

---

## 🔁 Lần thay đổi 4 — Thêm Fallback Model Chain cho Gemini

**Thời gian:** 09:52 (UTC+7)

**Yêu cầu của bạn:**
> Thêm back-up model theo luồng fallback:
> ```
> gemini-3-flash (30s)
>   fail → chờ 1s → gemini-3.1-flash-lite (60s)
>     fail → chờ 1s → gemini-2.5-flash (60s)
>       fail → chờ 1s → gemini-2.5-flash-lite (60s)
>         fail → trả thông báo lỗi cho người dùng
> ```

**Thay đổi:**

1. Thêm mảng `FALLBACK_MODELS` (global):
```js
var FALLBACK_MODELS = [
  { name: "gemini-3-flash",        timeout: 30 },
  { name: "gemini-3.1-flash-lite", timeout: 60 },
  { name: "gemini-2.5-flash",      timeout: 60 },
  { name: "gemini-2.5-flash-lite", timeout: 60 },
];
```

2. Hàm `translateWithGemini()` thay từ gọi đơn 1 model → vòng lặp fallback:
```js
for (var i = 0; i < FALLBACK_MODELS.length; i++) {
  var model = FALLBACK_MODELS[i];
  try {
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 429 || statusCode >= 500) {
      // rate limit hoặc lỗi server → chuyển model tiếp
      if (i < FALLBACK_MODELS.length - 1) Utilities.sleep(1000);
      continue;
    }

    if (json.candidates && json.candidates.length > 0) {
      return translatedText; // thành công
    }

    // Không có candidates → thử tiếp
    if (i < FALLBACK_MODELS.length - 1) Utilities.sleep(1000);

  } catch (e) {
    // Exception / timeout → thử tiếp
    if (i < FALLBACK_MODELS.length - 1) Utilities.sleep(1000);
  }
}
return "❗ 번역 오류!(DỊCH THẤT BẠI.)";
```

**Các trường hợp được xem là "fail":**

| Điều kiện | Hành động |
|---|---|
| HTTP `429` (rate limit) | Sleep 1s → thử model tiếp |
| HTTP `5xx` (lỗi server) | Sleep 1s → thử model tiếp |
| Không có `candidates` trong response | Sleep 1s → thử model tiếp |
| Exception / timeout | Sleep 1s → thử model tiếp |

**Log ví dụ khi fallback:**
```
[AI] Đang thử model: gemini-3-flash (timeout: 30000ms)
[Fallback] Model gemini-3-flash lỗi HTTP 429. Chuyển model...
[AI] Đang thử model: gemini-3.1-flash-lite (timeout: 60000ms)
[AI] Fallback thành công! Đã dùng model backup: gemini-3.1-flash-lite
```

---

## 📌 Ghi chú do user chỉnh sửa thêm (sau hội thoại)

User tự cập nhật `FALLBACK_MODELS` trong `test.js`:

```diff
- { name: "gemini-3-flash",        timeout: 30 },
- { name: "gemini-3.1-flash-lite", timeout: 60 },
- { name: "gemini-2.5-flash",      timeout: 60 },
- { name: "gemini-2.5-flash-lite", timeout: 60 },
+ { name: "gemini-3.5-flash-lite", timeout: 12 },
+ { name: "gemini-3.1-flash-lite", timeout: 12 },
+ { name: "gemini-2.5-flash-lite", timeout: 12 },
```

> Rút ngắn timeout xuống 12s và bỏ bớt model `gemini-2.5-flash`, đổi thứ tự ưu tiên.

---

*File này được tạo tự động từ lịch sử hội thoại — 2026-07-30*
