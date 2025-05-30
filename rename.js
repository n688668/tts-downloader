import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Lấy __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục chứa các file cần đổi tên
const TARGET_DIR = path.join(__dirname, 'downloads/rename/'); // Đổi lại nếu cần

// Hàm chính để gọi từ index.js
export default function runRename() {
    // Đọc danh sách đổi tên
    const renamePath = path.join(__dirname, 'rename.json');
    if (!fs.existsSync(renamePath)) {
        console.error(`❌ Không tìm thấy file rename.json tại ${renamePath}`);
        return;
    }

    const renameList = JSON.parse(fs.readFileSync(renamePath, 'utf-8'));

    // Lấy danh sách file hiện có
    if (!fs.existsSync(TARGET_DIR)) {
        console.error(`❌ Thư mục đích không tồn tại: ${TARGET_DIR}`);
        return;
    }

    const files = fs.readdirSync(TARGET_DIR);

    for (const { text, file } of renameList) {
        const matchedFile = files.find((filename) => {
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
}
