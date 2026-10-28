# 디지털 명함

명함 촬영 → OCR → 보정(학습) → 보관 / 내 명함 QR·링크 공유. 서버는 OCR 중계용 Worker 하나뿐입니다.

## 구성
- `index.html` `sw.js` `manifest.webmanifest` `icon.svg` — 정적 PWA (GitHub Pages 등에 그대로 올리면 됨)
- `worker/` — Claude 비전으로 명함을 읽는 Cloudflare Worker (API 키 보관)

## 배포
1. 앱: 이 저장소를 GitHub Pages로 공개 (HTTPS 필수, 카메라·PWA 설치 때문)
2. OCR Worker:
   ```
   cd worker
   # wrangler.toml 의 ALLOWED_ORIGIN 을 앱 주소로 수정
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```
3. 앱 → 스캔 탭 → 'OCR 서버 주소 설정'에 Worker 주소 입력
   (`index.html` 의 `DEFAULT_OCR_URL` 에 넣어 두면 설정 불필요)
4. 폰 브라우저 메뉴에서 '홈 화면에 추가'

## 학습 방식
스캔 결과를 고쳐서 저장하면 (OCR값 → 고친값)이 폰에 기록됩니다.
다음 스캔에서 같은 값이 나오면 자동 교정(파란 테두리)하고, 최근 20건은 Claude에 힌트로 함께 보냅니다.

## 개인정보
내 명함·받은 명함·교정 기록은 브라우저 localStorage에만 저장됩니다.
스캔할 때 명함 이미지만 Worker를 거쳐 Anthropic API로 전송되며 Worker는 저장하지 않습니다.
