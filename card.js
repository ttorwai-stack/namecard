// 앱(index.html)과 받는 사람 전용 페이지(c.html)가 함께 쓰는 명함 공통 코드
const FIELDS = ["lastName","firstName","org","dept","title","phone","tel","email","url","address","note"];

const esc  = s => String(s).replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
const text = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const fullName = m => m.lastName + m.firstName;
const blank = () => Object.fromEntries(FIELDS.map(f => [f, ""]));

/* ---------- vCard / 링크 ---------- */
function buildVcard(m) {
  const L = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(m.lastName)};${esc(m.firstName)};;;`, `FN:${esc(fullName(m))}`];
  if (m.org || m.dept) L.push(`ORG:${esc(m.org)}${m.dept ? ";" + esc(m.dept) : ""}`);
  if (m.title)   L.push(`TITLE:${esc(m.title)}`);
  if (m.phone)   L.push(`TEL;TYPE=CELL:${m.phone}`);
  if (m.tel)     L.push(`TEL;TYPE=WORK:${m.tel}`);
  if (m.email)   L.push(`EMAIL:${m.email}`);
  if (m.url)     L.push(`URL:${m.url}`);
  if (m.address) L.push(`ADR;TYPE=WORK:;;${esc(m.address)};;;;`);
  if (m.note)    L.push(`NOTE:${esc(m.note)}`);
  L.push("END:VCARD");
  return L.join("\r\n");
}
function download(name, content, type = "text/vcard;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function b64u(bytes) { let s = ""; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64u(str) { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); }
// 받는 사람 전용 페이지(c.html) 주소. 명함 내용은 # 뒤에 들어가므로 서버로 전송되지 않습니다.
function cardLink(m) {
  const arr = FIELDS.map(f => m[f] || "");
  return new URL("c.html", location.href).href.split("#")[0] + "#c=" + b64u(new TextEncoder().encode(JSON.stringify(arr)));
}
function parseLink(hash) {
  try {
    const arr = JSON.parse(new TextDecoder().decode(unb64u(hash.slice(3))));
    const m = blank(); FIELDS.forEach((f, i) => m[f] = String(arr[i] || ""));
    return m.lastName || m.firstName ? m : null;
  } catch (e) { return null; }
}

/* ---------- 화면 렌더 ---------- */
// 숫자만 입력된 전화번호를 보기 좋게 (이미 하이픈·기호가 있으면 그대로)
function fmtPhone(n) {
  if (!/^\d+$/.test(n)) return n;
  let m;
  if ((m = n.match(/^(02)(\d{3,4})(\d{4})$/)) || (m = n.match(/^(0\d{2})(\d{3,4})(\d{4})$/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = n.match(/^(1\d{3})(\d{4})$/))) return `${m[1]}-${m[2]}`;
  return n;
}
const cardRows = m => {
  const tl = n => n.replace(/[^\d+]/g, "");
  return [
    ["T", "tel:" + tl(m.tel), fmtPhone(m.tel), m.tel],
    ["M", "tel:" + tl(m.phone), fmtPhone(m.phone), m.phone],
    ["E", "mailto:" + m.email, m.email, m.email],
    ["W", m.url, m.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), m.url]
  ].filter(r => r[3]);
};
function renderCard(m, el, compact) {
  const memo = !compact && m.note ? `<div class="bc-extra"><span>메모</span>${text(m.note)}</div>` : "";
  el.innerHTML = `<div class="bc-wrap"><div class="bc">` +
    `<div><div class="bc-org">${text(m.org)}</div>${m.dept ? `<div class="bc-dept">${text(m.dept)}</div>` : ""}</div>` +
    `<div class="bc-id"><div class="bc-name">${text(fullName(m))}</div><div class="bc-title">${text(m.title)}</div></div>` +
    `<div><div class="bc-rows">${cardRows(m).map(([k, h, v]) => `<div><b>${k}</b>${/^(tel:|mailto:|https?:)/i.test(h) ? `<a href="${text(h)}">${text(v)}</a>` : `<a>${text(v)}</a>`}</div>`).join("")}</div>` +
    `${m.address ? `<div class="bc-foot">${text(m.address)}</div>` : ""}</div>` +
    `</div></div>` + memo;
}

/* ---------- 이미지(PNG) 저장 ---------- */
// 화면의 명함과 같은 배치를 canvas로 다시 그립니다. 단위 cw = 카드 너비의 1%.
function cardCanvas(m) {
  const W = 1820, H = 1100, M = 70, cw = W / 100, FONT = '-apple-system,"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  const c = document.createElement("canvas"); c.width = W + M * 2; c.height = H + M * 2;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.translate(M, M);
  const R = 3.3 * cw;
  const path = () => { g.beginPath(); g.moveTo(R, 0); g.arcTo(W, 0, W, H, R); g.arcTo(W, H, 0, H, R); g.arcTo(0, H, 0, 0, R); g.arcTo(0, 0, W, 0, R); g.closePath(); };
  const grad = g.createLinearGradient(0, 0, W * 0.55, H * 1.1); grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, "#f2f4f9");
  g.save(); g.shadowColor = "rgba(20,30,60,.25)"; g.shadowBlur = 40; g.shadowOffsetY = 12; path(); g.fillStyle = grad; g.fill(); g.restore();
  g.save(); path(); g.clip(); g.fillStyle = "#1f2a44"; g.fillRect(0, 0, 2.2 * cw, H); g.restore();
  path(); g.strokeStyle = "#e3e7ef"; g.lineWidth = 2; g.stroke();

  const padL = 8.5 * cw, padT = 6 * cw, padR = 6 * cw, padB = 5 * cw, maxW = W - padL - padR;
  const font = (w, s) => `${w} ${s * cw}px ${FONT}`;
  const fit = (t, maxWidth) => { while (t.length > 1 && g.measureText(t).width > maxWidth) t = t.slice(0, -2) + "…"; return t; };
  const rows = cardRows(m);
  const hTop = 4.3 * 1.2 * cw + (m.dept ? (0.8 + 2.8 * 1.2) * cw : 0);
  const hId = 8.5 * 1.1 * cw;
  const hBot = 2.6 * cw + rows.length * 3.5 * 1.5 * cw + (m.address ? (1.4 + 2.7 * 1.2) * cw : 0);
  const gap = Math.max(0, (H - padT - padB - hTop - hId - hBot) / 2);
  g.textBaseline = "middle";

  let y = padT;
  g.fillStyle = "#1f2a44"; g.font = font(700, 4.3); g.fillText(fit(m.org, maxW), padL, y + 4.3 * 0.6 * cw);
  if (m.dept) { g.fillStyle = "#6b7385"; g.font = font(400, 2.8); g.fillText(fit(m.dept, maxW), padL, y + 4.3 * 1.2 * cw + 0.8 * cw + 2.8 * 0.6 * cw); }

  y += hTop + gap;                               // 이름 + 직함 (같은 기준선)
  const nameFs = 8.5 * cw, base = y + hId * 0.78;
  g.textBaseline = "alphabetic"; g.fillStyle = "#1f2a44"; g.font = font(800, 8.5);
  let x = padL;
  for (const ch of fullName(m)) { g.fillText(ch, x, base); x += g.measureText(ch).width + 0.22 * nameFs; }
  if (m.title) { g.fillStyle = "#4562a8"; g.font = font(600, 3.8); g.fillText(fit(m.title, W - padR - x - 3 * cw), x + 3 * cw, base); }

  y += hId + gap;                                // 연락처 줄 + 주소
  g.textBaseline = "middle";
  g.fillStyle = "#d6dbe7"; g.fillRect(padL, y, maxW, 2);
  y += 2.6 * cw;
  rows.forEach(([k, , v]) => {
    const cy = y + 3.5 * 0.75 * cw;
    g.fillStyle = "#4562a8"; g.font = font(700, 3.2); g.fillText(k, padL, cy);
    g.fillStyle = "#1f2a44"; g.font = font(400, 3.5); g.fillText(fit(v, maxW - 7 * cw), padL + 7 * cw, cy);
    y += 3.5 * 1.5 * cw;
  });
  if (m.address) { g.fillStyle = "#6b7385"; g.font = font(400, 2.7); g.fillText(fit(m.address, maxW), padL, y + 1.4 * cw + 2.7 * 0.6 * cw); }
  return c;
}
async function saveCardImage(m) {
  const blob = await new Promise(r => cardCanvas(m).toBlob(r, "image/png"));
  const name = fullName(m) + "_명함.png";
  const file = new File([blob], name, { type: "image/png" });
  // 폰에서는 공유 시트(사진에 저장 등)를, 그 외에는 파일 다운로드를 사용합니다.
  if (matchMedia("(pointer:coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  download(name, blob);
}
