import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Lấy __dirname trong môi trường ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục chứa các file cần đổi tên
const TARGET_DIR = path.join(__dirname, 'downloads/rename/'); // Đổi lại nếu cần

// Đọc danh sách đổi tên
const renameList = JSON.parse(fs.readFileSync(path.join(__dirname, 'rename.json'), 'utf-8'));

// Lấy danh sách file hiện có
const files = fs.readdirSync(TARGET_DIR);

for (const { text, file } of renameList) {
    const matchedFile = files.find(filename => {
        const nameWithoutExt = path.parse(filename).name;
        return nameWithoutExt.toLowerCase() === text.toLowerCase();
    });

    if (!matchedFile) {
        console.warn(`⚠️ Không tìm thấy file tên "${text}"`);
        continue;
    }

    const ext = path.extname(matchedFile);
    const oldPath = path.join(TARGET_DIR, matchedFile);
    const newPath = path.join(TARGET_DIR, file + ext);

    if (fs.existsSync(newPath)) {
        console.warn(`⏩ Bỏ qua: ${file + ext} đã tồn tại`);
        continue;
    }

    try {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Đổi tên: ${matchedFile} → ${file + ext}`);
    } catch (err) {
        console.error(`❌ Lỗi khi đổi tên ${matchedFile}: ${err.message}`);
    }
}
