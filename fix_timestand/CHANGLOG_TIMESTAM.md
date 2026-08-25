# Changelog: Giải thích & Cập nhật logic Stack T7 và Tự động trừ Ngày Phép

## 📌 Khái niệm và Định nghĩa `Stack T7` (Cột V)
- **Cột V (`Stack T7`)**: Lưu trữ **số buổi Thứ 7 BẮT BUỘC phải đi làm** trong tháng của mỗi nhân viên.
- **Quy định làm Thứ 7 so le**:
  - Mỗi nhân viên được **nghỉ tối đa 2 ngày Thứ 7** trong 1 tháng.
  - Công thức tính: `Stack T7 = (Tổng số ngày Thứ 7 trong tháng) - 2`.
  - *Ví dụ*: Tháng có 5 ngày Thứ 7 $\rightarrow$ `Stack T7 = 5 - 2 = 3` (Nhân viên bắt buộc phải đi làm đủ 3 buổi Thứ 7).

---

## 🏖️ Logic Quản lý & Tự động Trừ Ngày Phép (Sheet `Vacation Chart`)

- **Nguồn dữ liệu (`Vacation Chart`)**:
  - **Cột A**: Tên nhân viên.
  - **Cột B**: Phép đến cuối tháng trước.
  - **Cột C (`Phép được dùng`)**: Số ngày phép được dùng ban đầu.
  - **Cột D (`Remain`)**: Số ngày phép còn lại sau khi tự động trừ công.

- **Quy tắc khấu trừ & Gộp thống nhất nhãn công (Cột H)**:
  1. **Nghỉ cả ngày (`Nghỉ`)**:
     - Nếu nhân viên còn ngày phép (`remainLeave >= 1`):
       - Trừ 1 ngày phép: `remainLeave -= 1`.
       - Đổi nhãn Cột H thành **`Phép`** (tính 1.0 ngày công).
       - Khôi phục định dạng ô bình thường (chữ thường, không bôi đỏ).
     - Nếu nhân viên chỉ còn nửa ngày phép (`0.5 <= remainLeave < 1`):
       - Trừ 0.5 ngày phép: `remainLeave -= 0.5`.
       - Đổi nhãn Cột H thành **`P/2`** (tính 0.5 ngày công).
       - *Lưu ý*: Với trường hợp vắng cả ngày nhưng chỉ còn 0.5 phép, nhãn gán phải là **`P/2`** (để tính nửa ngày công), không dùng `Nửa (Phép)` để tránh bị hiểu nhầm là đi làm nửa ngày + hưởng nửa ngày phép (= 1 ngày công).
     - Nếu hết ngày phép (`remainLeave < 0.5`):
       - Giữ nguyên nhãn **`Nghỉ`** và bôi đỏ in đậm (`formatCell`).
  2. **Nghỉ nửa ngày (`Nửa`)**:
     - Nếu nhân viên còn ngày phép (`remainLeave >= 0.5`):
       - Trừ 0.5 ngày phép: `remainLeave -= 0.5`.
       - Đổi nhãn Cột H thành **`Nửa (Phép)`**.
     - Nếu không đủ phép (`remainLeave < 0.5`):
       - Giữ nguyên nhãn **`Nửa`**.

- **Cập nhật Cột D (`Remain`)**:
  - Sau khi duyệt và xử lý xong lượt chạy **`Working date`**, hệ thống tự động cập nhật số ngày phép còn lại chính xác vào **Cột D (`Remain`)** ở sheet `Vacation Chart`.

- **Tính tổng công (`grossWork`)**:
  - Các ô có giá trị **`Full`**, **`Lễ`**, **`Phép`** đều được tính là **1 công (+1)**.
  - Các ô có giá trị **`Nửa`**, **`Nửa (Phép)`**, **`N/2`**, **`P/2`** được tính là **0.5 công (+0.5)**.

---

## 🛠️ Chi tiết các thay đổi trong `main_ban_cu.js`

1. **`getVacationData()`, `findVacationInfo()`, `updateVacationRemain()`**:
   - `getVacationData()`: Đọc số phép ban đầu từ **Cột C (Phép được dùng)** trong sheet `Vacation Chart`.
   - `updateVacationRemain()`: Cập nhật số ngày phép còn lại (Remain) sau khi trừ vào **Cột D (Remain)** trong sheet `Vacation Chart`.

2. **`processVacationLeaveForCell()`**:
   - Hàm tập trung xử lý trừ ngày phép: gán `Phép` (khi nghỉ cả ngày & remain >= 1), **`P/2`** (khi nghỉ cả ngày & 0.5 <= remain < 1), hoặc `Nửa (Phép)` (khi nghỉ nửa ngày & remain >= 0.5).
3. **`handleConfirmationWork()`**:
   - Tích hợp tự động trừ ngày phép khi người dùng nhấn nút **Working date**.
4. **`grossWork()`**:
   - Bổ sung cộng điểm công cho `Phép` (+1 công) và `Nửa`, `Nửa (Phép)`, `N/2`, **`P/2`** (+0.5 công).
5. **`handleCheckSaturday()` (Logic riêng cho Thứ 7)**:
   - Trong tháng (ví dụ Tháng 8 có 5 Thứ 7, Stack T7 = 3), mỗi nhân viên có **2 suất nghỉ so le miễn phí** (hiển thị ô `' '` trống).
   - Khi nhân viên không đi làm ngày Thứ 7, hệ thống ưu tiên trừ vào **2 suất nghỉ so le miễn phí** trước (cột H = `' '`, không bị bôi đỏ, không trừ phép).
   - Chỉ khi đã sử dụng **hết 2 suất nghỉ so le** (`usedFree >= 2`), các Thứ 7 tiếp theo không đi làm mới tính trừ phép (`Phép` nếu thuộc đợt mốc đỏ/ngày đã chốt) hoặc hiển thị **`Nghỉ` (bôi đỏ)** (nếu sau mốc ngày chốt).

6. **Tự động xác định điểm chốt ngày làm việc (`getCutoffDate()`, `isAfterCutoff()`, `isExplicitLeaveRequest()`)**:
   - **Điểm chốt (Cutoff Date)**: Hệ thống tự động quét toàn bộ bảng và tìm ra ngày muộn nhất có dữ liệu chấm công check-in/check-out (ví dụ: ngày 15/5).
   - **Các ngày từ điểm chốt trở về trước (từ ngày 1 đến ngày 15)**: Tính công, xử lý chuyên cần và tự động trừ phép bình thường.
   - **Các ngày SAU điểm chốt (từ ngày 16 đến cuối tháng)**: Chưa có dữ liệu chấm công và không có đơn xin nghỉ phép chính thức ở cột F/G → hiển thị **`Nghỉ` (bôi đỏ)** ở Cột H (Chủ nhật giữ trống), **tuyệt đối KHÔNG trừ ngày phép** trong `Vacation Chart`. (Số phép của Thủy Tiên giữ nguyên 5 ngày, không bị trừ về 0).
   - **Ngoại lệ**: Nếu có đơn xin nghỉ phép chính thức (cột G có dấu `-` hoặc cột F chứa lý do xin nghỉ như "nghỉ", "phép", "cá nhân", "ốm", "thai sản"...) ở các ngày sau điểm chốt thì hệ thống vẫn ghi nhận `Phép` và khấu trừ ngày phép hợp lệ.




