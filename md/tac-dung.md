# Tac dung cua anti rate limit + xoay nhieu API key

## 1) Muc tieu thuc te

Tai lieu nay giai thich tac dung cua mo hinh:

- Rate limit queue
- Key rotation (nhieu API key)
- Retry co kiem soat
- Tracking usage theo tung key

Muc tieu la giu he thong chat/dich on dinh khi goi Gemini trong moi truong production.

---

## 2) Tai sao can mo hinh nay?

Neu chi dung 1 API key va goi truc tiep:

- De bi loi `429 Too Many Requests`
- De dung tran quota trong ngay
- Kho quan sat key nao sap het han muc
- He thong de "treo" khi API gap dot bien traffic

Khi co queue + key rotation, request duoc dieu tiet thay vi ban thang vao API.

---

## 3) Tac dung chinh

### 3.1 Giam loi 429

- Queue gian cach request theo RPM
- Khong ban qua nhanh vao 1 key
- Key vua bi 429 duoc tam block trong 1 khoang thoi gian

### 3.2 Tang do ben

- 1 key loi khong lam ca he thong dung
- Co fallback sang key khac
- Retry theo backoff tranh spam lap lai

### 3.3 Su dung quota hieu qua

- Chia tai deu cho nhieu key
- Track usage tung key de skip key sap het quota
- De lap bao cao va canh bao som

### 3.4 De scale production

- Tach ro cac lop: API server -> queue -> key manager -> Gemini caller
- De nang cap len Redis/BullMQ khi tai lon
- De bo sung circuit breaker, logging, dashboard

---

## 4) Kien truc de xuat

```text
Client
  ->
API Server
  ->
Rate Limit Queue
  ->
Key Manager (round robin + smart skip)
  ->
Gemini Service
```

---

## 5) Logic van hanh ngan gon

1. Request vao server
2. Dua request vao queue
3. Lay key tiep theo con kha dung
4. Goi Gemini
5. Neu 429: danh dau key tam block + retry voi key khac
6. Tra ket qua cho client

---

## 6) Cac chi so can theo doi

- Request count/key
- So lan 429/key
- Thoi gian phan hoi (latency)
- Ti le thanh cong/thai bai
- So key dang bi block

Theo doi cac chi so nay giup ban quyet dinh:

- Khi nao can them key
- Khi nao can nang cap billing
- Khi nao can toi uu prompt/traffic

---

## 7) Security can nho

- Khong hardcode API key trong code
- Dung `.env` hoac secret manager
- Rotate key dinh ky
- Che log lo thong tin nhay cam

> Luu y: Trong `chat.js` hien dang hardcode key. Neu dua len production, can dua key ra bien moi truong ngay.

---

## 8) Ket qua mong doi

Khi ap dung dung cach, ban se co:

- He thong on dinh hon khi traffic tang
- It loi 429 hon
- It downtime hon khi 1 key gap van de
- Kha nang mo rong tot hon cho production

---

## 9) Goi y buoc tiep theo

- Chuyen queue memory sang Redis/BullMQ
- Them dashboard quota theo key
- Them circuit breaker + alert
- Viet test cho key manager, queue, retry logic
