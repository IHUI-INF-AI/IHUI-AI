
const fs = require("fs");
const zlib = require("zlib");
const path = "g:/IHUI-AI/apps/mobile-rn/.verify-03-input.png";
const buf = fs.readFileSync(path);
let off = 8;
const chunks = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString("ascii", off + 4, off + 8);
  const data = buf.slice(off + 8, off + 8 + len);
  chunks.push({ type, data });
  off += 12 + len;
  if (type === "IEND") break;
}
const ihdr = chunks.find(c => c.type === "IHDR").data;
const W = ihdr.readUInt32BE(0);
const H = ihdr.readUInt32BE(4);
const raw = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === "IDAT").map(c => c.data)));
const stride = W * 4 + 1;
const px = Array.from({ length: H }, (_, y) =>
  Array.from({ length: W }, (_, x) => {
    const i = y * stride + 1 + x * 4;
    return { r: raw[i], g: raw[i+1], b: raw[i+2] };
  })
);
console.log("IMG_SIZE=", W, "x", H);
// (1) Tab bar analysis: Y 140-240, split the image 3 ways horizontally
console.log("=== TAB_COLOR ===");
const tabRegions = [[15,90], [120,195], [225,300]];
for (let y = 140; y <= 240; y++) {
  const seg = [];
  for (let si = 0; si < 3; si++) {
    let tr=0, tg=0, tb=0, n=0, pur=0, wht=0;
    for (let x = tabRegions[si][0]; x <= tabRegions[si][1]; x++) {
      const p = px[y][x];
      tr += p.r; tg += p.g; tb += p.b; n++;
      const a = (p.r + p.g + p.b) / 3;
      if (p.b > p.r + 15 && p.b > p.g + 15 && p.b > 80) pur++;
      if (a > 230) wht++;
    }
    const r = tr/n, g = tg/n, b = tb/n;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    const sat = mx ? (mx - mn)/mx : 0;
    seg.push({ r, g, b, sat, pur, wht });
  }
  let hi = 0;
  for (let i = 1; i < 3; i++) if (seg[i].sat > seg[hi].sat) hi = i;
  if (seg[hi].sat > 0.05 || seg[0].wht + seg[1].wht + seg[2].wht > 10) {
    const o = seg.map((q, i) => "T" + i + ":rgb(" + Math.round(q.r) + "," + Math.round(q.g) + "," + Math.round(q.b) + ")s" + q.sat.toFixed(2) + "p" + q.pur + "w" + q.wht).join("  ");
    console.log("Y" + y + " HI" + hi + "  " + o);
  }
}
// (2) account / password text area black pixel count:
console.log("=== INPUT_BLACK_PIX ===");
let aB = 0, aG = 0;
for (let y = 280; y <= 300; y++) for (let x = 50; x <= 270; x++) {
  const p = px[y][x]; const a = (p.r+p.g+p.b)/3;
  if (a < 60) aB++; else if (a >= 110 && a <= 210) aG++;
}
console.log("ACC y280-300 x50-270 BLACK<60=" + aB + " GRAY110-210=" + aG);
let pB = 0, pG = 0;
for (let y = 380; y <= 400; y++) for (let x = 50; x <= 270; x++) {
  const p = px[y][x]; const a = (p.r+p.g+p.b)/3;
  if (a < 60) pB++; else if (a >= 110 && a <= 210) pG++;
}
console.log("PWD y380-400 x50-270 BLACK<60=" + pB + " GRAY110-210=" + pG);
// LABEL scan Y 200-340
console.log("=== LABEL_SCAN_Y200-340 ===");
for (let y = 200; y <= 340; y++) {
  let bc = 0, gc = 0;
  for (let x = 40; x <= 280; x++) {
    const p = px[y][x]; const a = (p.r+p.g+p.b)/3;
    if (a < 70) bc++;
    if (a >= 110 && a <= 210) gc++;
  }
  if (bc >= 8 || gc >= 30) console.log("L Y" + y + " B<70=" + bc + " G110-210=" + gc);
}
// (3) Checkbox X 10-60 Y 440-540 visual dump
console.log("=== CHECKBOX_VISUAL ===");
for (let y = 440; y <= 540; y++) {
  let s = "";
  for (let x = 10; x <= 60; x++) {
    const p = px[y][x]; const a = (p.r+p.g+p.b)/3;
    s += a < 100 ? "#" : a < 180 ? "+" : ".";
  }
  if (s.indexOf("#") >= 0 || s.indexOf("+") >= 0) console.log("Y" + y + " " + s);
}
// (4) Checkbox box scan with transitions
console.log("=== CHECKBOX_BOX_SCAN ===");
for (let y = 420; y <= 560; y++) {
  const row = [];
  for (let x = 0; x <= 80; x++) {
    const p = px[y][x]; const a = (p.r+p.g+p.b)/3;
    row.push(a < 100 ? 1 : 0);
  }
  let t = 0;
  for (let i = 1; i < row.length; i++) if (row[i] !== row[i-1]) t++;
  if (t >= 2 && t <= 14) {
    let seg = row.map(v => v ? "#" : ".").join("");
    console.log("Y" + y + " TRANS=" + t + " " + seg);
  }
}
