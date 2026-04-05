# Naruto Cam FX

정적 사이트로 바로 올릴 수 있는 카메라 전용 버전입니다.

## 구성

- 시작 화면에서 `나선환` 또는 `치도리`를 선택
- 카메라 화면으로 진입
- 선택한 기술 하나만 `오른손`에 붙어서 재생
- 전투 UI, 포켓몬식 배틀 화면, 좌우 손 분리 매핑은 제거

## 로컬 실행

정적 파일이라서 아무 웹서버로 열면 됩니다.

```powershell
cd "C:\Users\라이젠7 5700u 16gb\Documents\naruto"
python -m http.server 8000
```

그다음 브라우저에서 아래 주소로 접속하세요.

```text
http://localhost:8000
```

## 배포

이 폴더는 `index.html` 기준 정적 사이트라서 그대로 올리면 됩니다.

- `GitHub Pages`
- `Netlify`
- `Vercel`

## 파일

- `index.html`: 진입 화면 + 카메라 화면
- `app.js`: 카메라 열기, 오른손 추적, 효과 오버레이
- `styles.css`: 전체 화면 UI 스타일
- `assets/naruto.mp4`: 나선환 영상
- `assets/sasuke.mp4`: 치도리 영상

## 참고

- 브라우저에서 카메라 권한 허용이 필요합니다.
- 손 추적은 MediaPipe CDN을 사용하므로 인터넷 연결이 필요합니다.
