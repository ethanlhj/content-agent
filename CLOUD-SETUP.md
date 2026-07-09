# Cloud digest setup (GitHub Actions)

Everything is already in the repo: `.github/workflows/daily-digest.yml` runs the full
cycle (Apify pull → reel scripts → viewer → Telegram digest) every day at **9:30 AM
Toronto time** on GitHub's servers. Your laptop can be off.

## One-time setup (~5 minutes)

### 1. Create the GitHub repo and push

Open a terminal in `C:\Users\ethan\content-agent` and run:

```
git init
git add .
git commit -m "content agent"
```

Sanity check before pushing — this must print nothing:

```
git ls-files | findstr .env
```

Then create a **private** repo on github.com (e.g. `content-agent`) and:

```
git remote add origin https://github.com/YOUR_USERNAME/content-agent.git
git branch -M main
git push -u origin main
```

### 2. Add your secrets

On GitHub: repo → Settings → Secrets and variables → Actions → New repository secret.
Add these four (values are the same lines you have in your local `.env`):

- `APIFY_TOKEN`
- `ANTHROPIC_API_KEY`
- `TELEGRAM_TOKEN`
- `TELEGRAM_CHAT_ID`

Paste them yourself — never share them in chat.

### 3. Test it

Repo → Actions → "Daily content digest" → **Run workflow**. First run takes ~5-8 min
(it compiles whisper.cpp once, then caches it; later runs are much faster). You should
get the Telegram digest when it finishes.

### 4. Turn off the local task

Once the cloud run works, remove the Windows task so you don't get double digests:

```
schtasks /delete /tn ContentAgentDaily /f
```

## Notes

- The workflow commits refreshed `data.json` / scripts back to the repo. To update
  your local dashboard, just `git pull`.
- Cron is `30 13 * * *` UTC = 9:30 AM during daylight saving. In winter it becomes
  8:30 AM — change to `30 14 * * *` if that bothers you.
- `tools/` (Windows whisper binaries, 140+ MB model) is gitignored; the cloud builds
  its own Linux whisper.
