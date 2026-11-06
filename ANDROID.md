# Chạy Auto Video Gen của Cường IT trên Android

Bản bổ sung này giữ nguyên toàn bộ mã nguồn, template, HTML/CSS, GSAP, HyperFrames
và FFmpeg của dự án đã import. Các file mới chỉ chuẩn bị dữ liệu, giọng đọc, chạy
pipeline gốc và kiểm tra kết quả. Không cần máy tính để chạy GitHub Actions.

## Video mẫu đã chạy thực tế

- [Lần chạy thành công với Edge TTS và HyperFrames gốc](https://github.com/bacuabesua1997-coder/cuongit-auto-video/actions/runs/42219408098).
- [Tải Artifact của video mẫu](https://github.com/bacuabesua1997-coder/cuongit-auto-video/actions/runs/42219408098/artifacts/13502359788).
- MP4: **1080×1920, 29,933 giây, H.264 + AAC**, khoảng **101 MiB**. Đã giải mã
  toàn bộ bằng FFmpeg, đo âm thanh và trích/xem ba khung hình đầu, giữa, cuối.
- Đây là `tests/fixtures/sample-script-no-image.json` giữ nguyên từng byte, với
  thông tin iPhone **minh họa**, không phải bản tin đã kiểm chứng. Độ dài do lời đọc
  của mẫu gốc quyết định, không ép kéo dài. Giọng đọc được tạo thật bằng Edge TTS.
- Artifact lưu 14 ngày (mẫu trên hết hạn khoảng 20/11/2026). Có thể chạy lại demo.

## Chạy và tải MP4 trên điện thoại

1. Merge Pull Request bổ sung các workflow vào nhánh mặc định `main`. GitHub chỉ
   hiện nút **Run workflow** khi file có `workflow_dispatch` nằm trên nhánh mặc định.
2. Đăng nhập GitHub trên Chrome Android, mở repository → **Actions** →
   **Auto Video Gen - Create MP4** → **Run workflow**. Nếu nút bị ẩn, bật
   **Trang web cho máy tính** trong menu Chrome. Nếu Actions đang bị tắt, vào
   Settings → Actions → General để bật các action của GitHub dùng trong workflow.
3. Chọn nhánh `main`, `mode = demo`; giữ các ô `source` và `script_json` trống.
   Chọn giọng `vi-VN-NamMinhNeural` (nam) hoặc `vi-VN-HoaiMyNeural` (nữ), giao diện
   `dark-neon` hoặc `light-pro`. Nhấn **Run workflow**.
4. Đợi trạng thái xanh (mẫu đã chạy mất vài phút). Mở lần chạy → **Summary** →
   **Artifacts** → tải `cuongit-video-…`.
5. Dùng ứng dụng Files/Tệp trên Android giải nén ZIP rồi mở **video.mp4**.
   Không phải sửa video thủ công. ZIP còn có `script.json`, giọng đọc, HTML gốc,
   `edge-tts-report.json` và `verification/verification.json` cùng ba ảnh kiểm tra.

Workflow **Original engine - Edge TTS demo** là bài thử riêng của pipeline gốc.
Workflow **Original engine and mobile adapter tests** kiểm tra code, không tạo video.

## Tạo video từ URL bài báo hoặc văn bản

Việc viết kịch bản do **AI Coding Agent của bạn** thực hiện. Workflow không tự gọi
dịch vụ AI trả phí và không giả lập việc đọc bài báo.

1. Trong **Auto Video Gen - Create MP4**, chọn `mode = prepare-agent`.
   Dán một URL bài báo HTTPS hoặc nội dung văn bản vào `source` (10–20.000 ký tự).
2. Tải Artifact `cuongit-agent-packet-…`. Gửi nội dung **agent-prompt.md** cho
   Codex/Claude Code hoặc AI Coding Agent có khả năng đọc web/tệp. Agent nhận
   schema trích trực tiếp từ code gốc, đọc nguồn và viết một object JSON.
   Nếu website chặn truy cập, dán nội dung bài cho agent. Không suy đoán tin từ URL.
   Agent có repository cũng có thể dùng skill mới
   [create-mobile-video](.agents/skills/create-mobile-video/SKILL.md).
3. Chạy lại workflow với `mode = render-json`. Dán nguyên object JSON vào
   `script_json`, **không kèm dấu ```**, tối đa 60 KB. Ô `source` không dùng ở chế độ này.
4. Workflow kiểm tra schema, tạo lời đọc Edge, dựng bằng pipeline gốc và xuất Artifact
   `cuongit-video-…`. Tải và giải nén như hướng dẫn ở trên.

Kịch bản có 5–8 cảnh, mở đầu `hook`, kết thúc `outro`; khoảng 150–200 từ tiếng Việt.
Sáu template gốc là `hook`, `comparison`, `stat-hero`, `feature-list`, `callout`,
`outro`. Cấu trúc hiện hành là **templateData** trong
`src/render/script-schema.ts`; ví dụ `visual` ở skill cũ không khớp schema này.
Không sửa skill cũ hoặc template để thích ứng với dữ liệu sai.

Ảnh bài báo là tùy chọn: dùng `metadata.source.image = null` để giữ nền gradient
gốc. Không cần API ảnh/video. SFX tùy chọn; không đặt tên âm thanh chưa có trong
thư viện gốc. Lời đọc và thời lượng cảnh được đồng bộ bởi pipeline gốc. File SRT
do Edge tạo là **riêng từng cảnh**, tính từ đầu cảnh; không phải phụ đề karaoke
đã ghép/burn toàn video. Phần chữ trên video vẫn dùng animation của template gốc.

## Cấu hình và chi phí

- **Không cần GitHub Secrets hoặc API key** để dựng video với Edge TTS. Workflow
  bắt buộc `TTS_PROVIDER=edge-tts`, không dùng các nhà cung cấp trả phí có sẵn
  trong dự án gốc. Adapter dùng tốc độ đọc mặc định; hãy để `voice.speed = 1`.
- AI Coding Agent dùng tài khoản/gói/quota sẵn có của bạn. Chế độ `prepare-agent`
  chỉ tạo gói hướng dẫn, **không tự viết kịch bản và không xuất MP4**. Để tự động
  cả bước AI ngay trong Actions cần chọn nhà cung cấp/model, API key lưu trong
  GitHub Secrets và quota tương ứng; cấu hình đó chưa được thêm vào bản miễn phí này.
- Actions/Artifacts chịu giới hạn và chính sách của gói GitHub đang sử dụng.
  Video mẫu khá lớn do giữ nguyên cấu hình renderer; Artifact tự xóa sau 14 ngày.
- Edge TTS cần kết nối Internet, có thể bị giới hạn hoặc thay đổi giao thức;
  adapter thử lại tối đa ba lần mỗi cảnh và báo lỗi nếu không lấy được giọng.

## Vì sao có bước chuẩn bị Edge TTS?

Lần chạy pipeline nguyên bản cho thấy client JavaScript `edge-tts-universal@1.4.0`
thoát với mã 0 ngay ở cảnh đầu nhưng không tạo MP3/MP4. Client này dùng handshake
cũ. Bản bổ sung dùng client miễn phí **edge-tts==7.3.1** hỗ trợ giao thức v2 để
ghi `voice/scene-<id>.mp3` và SRT thật. Sau đó pipeline gốc dùng cơ chế tái sử dụng
audio đã có, tính thời lượng bằng FFprobe rồi dựng bằng HyperFrames như trước.

Không sửa `src/`, package lock, template hay fixture gốc. Bước chuẩn bị luôn tạo
lại lời đọc cho nội dung mới; không dùng audio giả hoặc âm thanh rỗng. Bước kiểm
tra cuối ngăn trường hợp tiến trình trả mã 0 nhưng thiếu MP4 hợp lệ, thiếu âm
thanh, sai kích thước hoặc video không giải mã được.

## Chạy trên máy có Node 22, Python 3.12 và FFmpeg

Chạy từ thư mục gốc của repository. Đảm bảo FFmpeg/FFprobe và font Noto/DejaVu
đã cài; workflow có đầy đủ lệnh cài trên Ubuntu.

```bash
npm ci
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r scripts/mobile/requirements.txt
npx --no-install hyperframes browser ensure
export TTS_PROVIDER=edge-tts
export EDGE_TTS_VOICE=vi-VN-NamMinhNeural
export VIDEO_THEME=dark-neon
MODE=demo node --import tsx scripts/mobile/prepare-script.ts
python scripts/mobile/prepare_edge.py output/mobile/script.json
npm run pipeline -- output/mobile/script.json
node scripts/mobile/verify-video.mjs output/mobile/video.mp4 output/mobile/verification
```

Với JSON do agent viết trong `my-script.json`, thay lệnh `MODE=demo` bằng:

```bash
MODE=render-json SCRIPT_JSON="$(cat my-script.json)" node --import tsx scripts/mobile/prepare-script.ts
```

Đây là đọc dữ liệu tệp vào biến môi trường; không chạy nội dung JSON như shell.
Dùng thư mục output mới hoặc xóa kết quả cũ trước khi chạy lại tại máy cá nhân.
GitHub Actions luôn dùng workspace mới.

## Kiểm thử và xử lý lỗi

```bash
npm test
npm run typecheck
node --import tsx scripts/mobile/prepare-script.test.ts
npx --no-install tsc -p scripts/mobile/tsconfig.json
python -m unittest discover -s scripts/mobile -p 'test_*.py' -v
```

Gồm 60 test gốc, 8 test nhập dữ liệu/schema và 5 test adapter Edge (mock mạng,
không tốn API). Bài demo Actions bổ sung kiểm thử thực tế Edge + renderer + MP4.
Các test mới kiểm tra giới hạn nội dung, cấu trúc template, ID/path không hợp lệ,
retry, dọn file tải dở và không lộ token dịch vụ trong thông báo lỗi.

- **JSON không hợp lệ:** chỉ dán object JSON, nhờ agent sửa theo lỗi schema;
  không chuyển sang cấu trúc `visual` hoặc tự sửa engine.
- **Edge không trả giọng:** xem bước chuẩn bị Edge và chạy lại sau. Không có MP4
  giả để đánh dấu thành công. Workflow có giới hạn thời gian 30 phút.
- **HyperFrames/GSAP lỗi:** kiểm tra kết nối CDN/font và bước chuẩn bị browser;
  renderer gốc cần Chromium và các tài nguyên web gốc của template.
- **Không tải được Artifact:** đăng nhập đúng tài khoản, mở lần chạy xanh còn
  trong 14 ngày. Nếu hết hạn, chạy workflow lại.
- **Không thấy Run workflow:** kiểm tra workflow đã được merge vào nhánh mặc định
  và Actions đã bật; thay đổi trên nhánh PR chưa tự trở thành cấu hình `main`.
