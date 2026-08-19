import sharp from "sharp";
import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const iconsDir = path.resolve("assets/icons");
const files = await readdir(iconsDir);
const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));

let totalBefore = 0;
let totalAfter = 0;

for (const file of images) {
  const full = path.join(iconsDir, file);
  const { size: before } = await stat(full);
  totalBefore += before;
  try {
    const inputBuf = await readFile(full);
    const outputBuf = await sharp(inputBuf)
      .resize(320, 200, { fit: "cover", withoutEnlargement: true })
      .jpeg({ quality: 40, mozjpeg: true })
      .toBuffer();
    totalAfter += outputBuf.length;
    await writeFile(full, outputBuf);
    const saved = (((before - outputBuf.length) / before) * 100).toFixed(0);
    console.log(`ok ${file} -- ${(before/1024).toFixed(0)}KB -> ${(outputBuf.length/1024).toFixed(0)}KB (-${saved}%)`);
  } catch (e) {
    console.error(`fail ${file}: ${e.message}`);
  }
}

console.log(`Total: ${(totalBefore/1024/1024).toFixed(1)}MB -> ${(totalAfter/1024/1024).toFixed(1)}MB`);