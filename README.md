<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/13sQJCi4XgiDnSYePJPKM_jvrio1kFgXK

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel

1. Connect your GitHub repo to Vercel and deploy.
2. **번역이 동작하려면** Vercel 프로젝트 **Settings → Environment Variables** 에서 **`VITE_API_KEY`** 를 Gemini API 키로 설정한 뒤, **재배포**하세요. (빌드 시점에 주입되므로 변수 추가/수정 후 반드시 Redeploy 필요.)
