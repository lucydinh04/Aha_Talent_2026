# Aha Talent 2026 — Deploy Vercel + Tracking Google Sheet

## Kiến trúc

Nhân viên mở link Vercel công khai:

`index.html → POST /api/submit → Google Sheets API → Google Sheet Tracking`

Người dùng không cần quyền Google Drive hoặc Apps Script.

---

## 1. Chuẩn bị Google Sheet

Bạn có thể tiếp tục dùng file tracking hiện tại. Sheet cần có hai tab:

- `Đăng ký`
- `Thành viên`

Nếu bạn đã từng chạy `setupSheets()` từ bộ Apps Script trước đây thì giữ nguyên file đó.

Lấy `GOOGLE_SHEET_ID` từ link:

`https://docs.google.com/spreadsheets/d/GOOGLE_SHEET_ID/edit`

---

## 2. Tạo Service Account

1. Mở Google Cloud Console.
2. Tạo hoặc chọn một project.
3. Bật **Google Sheets API**.
4. Vào **IAM & Admin → Service Accounts**.
5. Tạo service account, ví dụ: `aha-talent-form`.
6. Tạo JSON key và tải xuống.
7. Trong file JSON, lấy:
   - `client_email`
   - `private_key`
8. Mở Google Sheet tracking.
9. Chia sẻ quyền **Editor** cho `client_email` của service account.

Không upload file JSON lên GitHub và không đặt private key trong `index.html`.

---

## 3. Đưa source lên GitHub

1. Tạo repository mới trên GitHub.
2. Upload toàn bộ các file trong thư mục này:
   - `index.html`
   - `api/submit.js`
   - `api/health.js`
   - `package.json`
   - `vercel.json`
3. Commit thay đổi.

---

## 4. Deploy trên Vercel

1. Đăng nhập Vercel.
2. Chọn **Add New → Project**.
3. Import repository GitHub.
4. Framework Preset: chọn **Other**.
5. Không cần Build Command.
6. Nhấn **Deploy**.

Deployment đầu có thể mở giao diện, nhưng form chưa gửi được cho đến khi thêm Environment Variables.

---

## 5. Khai báo Environment Variables

Trong Vercel:

**Project → Settings → Environment Variables**

Thêm cho cả Production và Preview:

### GOOGLE_SHEET_ID

ID của Google Sheet.

### GOOGLE_SERVICE_ACCOUNT_EMAIL

Giá trị `client_email` trong JSON key.

### GOOGLE_PRIVATE_KEY

Giá trị `private_key` trong JSON key, gồm cả:

- `-----BEGIN PRIVATE KEY-----`
- `-----END PRIVATE KEY-----`

Có thể giữ chuỗi `\n`; code tự chuyển thành xuống dòng.

### ALLOWED_ORIGIN — không bắt buộc

Sau khi đã có domain production, nhập:

`https://ten-project.vercel.app`

Khi đang test nhiều Preview URL, có thể tạm thời chưa khai báo biến này.

Sau khi thêm hoặc sửa Environment Variables, cần **Redeploy**.

---

## 6. Kiểm tra

### Kiểm tra API

Mở:

`https://ten-project.vercel.app/api/health`

Kết quả đúng:

```json
{
  "ok": true,
  "googleSheetsConfigured": true
}
```

### Kiểm tra form

1. Gửi một đăng ký thử.
2. Kiểm tra tab `Đăng ký`.
3. Kiểm tra tab `Thành viên`.
4. Xóa dòng test sau khi xác nhận.

---

## 7. Tracking

Dữ liệu tiếp tục đổ vào:

- `Đăng ký`: mỗi tiết mục một dòng.
- `Thành viên`: mỗi người một dòng.
- `Dashboard`: giữ công thức tracking hiện có.

Trạng thái có thể tiếp tục quản lý trong Google Sheet:

- Mới đăng ký
- Đang sơ tuyển
- Cần bổ sung
- Đã chọn biểu diễn
- Không vào vòng diễn
- Đã rút đăng ký

---

## 8. Cập nhật form

Khi cần sửa nội dung:

1. Sửa `index.html`.
2. Push lên GitHub.
3. Vercel tự tạo deployment mới.
4. Sau khi build thành công, production link được cập nhật.

Không cần phát lại link cho nhân viên nếu vẫn dùng cùng project/domain.

---

## Lưu ý bảo mật

- Không commit JSON key hoặc private key vào GitHub.
- Không đưa private key vào JavaScript phía trình duyệt.
- Chỉ cấp quyền Editor cho service account trên đúng file Sheet tracking.
- Sau chương trình, có thể xóa service account key hoặc gỡ quyền khỏi Google Sheet.
