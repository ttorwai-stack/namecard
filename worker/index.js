// 명함 OCR 프록시 (Cloudflare Worker). API 키를 앱에 노출하지 않기 위한 얇은 중계 서버입니다.
// 환경변수: ANTHROPIC_API_KEY (secret), ALLOWED_ORIGIN (앱 주소, 예: https://user.github.io), MODEL (선택)

const FIELDS = ["lastName", "firstName", "org", "dept", "title", "phone", "tel", "email", "url", "address", "note"];

const SYSTEM = `너는 명함 이미지에서 연락처 정보를 추출하는 OCR 도우미다.
반드시 아래 키만 가진 JSON 객체 하나만 출력한다. 설명, 코드블록, 다른 텍스트는 금지.
키: ${FIELDS.join(", ")}
- lastName/firstName: 이름을 성과 이름으로 나눈다. 한글 이름은 보통 성 1글자 + 이름 나머지 (복성 예: 남궁, 선우, 제갈). 영문만 있으면 성/이름을 구분해 넣는다.
- org 회사/기관, dept 부서, title 직함
- phone: 휴대폰(010 등). tel: 사무실/대표 전화. 팩스 번호는 note에 "FAX 번호"로 적는다.
- 전화번호는 보이는 그대로 하이픈 포함 형식. 국가번호가 있으면 유지.
- email, url(홈페이지, http 없으면 https://를 붙인다), address
- note: 위에 들어가지 않는 정보(팩스, SNS 등). 없으면 빈 문자열.
- 명함에 없는 항목은 빈 문자열. 추측해서 채우지 않는다. 글자가 흐려 확신이 없으면 보이는 대로 적는다.`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "access-control-allow-origin": allowed === "*" ? "*" : allowed,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    if (allowed !== "*" && origin !== allowed) return json({ error: "forbidden origin" }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const { image, mediaType = "image/jpeg", hints = [] } = body;
    if (typeof image !== "string" || image.length < 100) return json({ error: "image required" }, 400);
    if (image.length > 7_000_000) return json({ error: "image too large" }, 413);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) return json({ error: "bad media type" }, 400);

    // 사용자가 이전에 고친 내용을 힌트로 전달 (학습)
    const hintLines = (Array.isArray(hints) ? hints : []).slice(0, 20)
      .filter(h => FIELDS.includes(h.field) && typeof h.from === "string" && typeof h.to === "string")
      .map(h => `- ${h.field}: "${h.from.slice(0, 80)}" → "${h.to.slice(0, 80)}"`);
    const prompt = "이 명함을 읽어 JSON으로 출력해." +
      (hintLines.length ? `\n\n참고: 이 사용자가 과거에 OCR 결과를 아래처럼 고쳤다. 같은 글자가 보이면 고친 쪽을 따른다.\n${hintLines.join("\n")}` : "");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-5-5",
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: prompt },
        ] }],
      }),
    });
    if (!r.ok) return json({ error: "upstream " + r.status }, 502);
    const out = await r.json();
    const txt = (out.content || []).map(c => c.text || "").join("");
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "unparseable" }, 502);
    try {
      const parsed = JSON.parse(m[0]);
      return json(Object.fromEntries(FIELDS.map(f => [f, typeof parsed[f] === "string" ? parsed[f] : ""])));
    } catch { return json({ error: "unparseable" }, 502); }
  },
};
