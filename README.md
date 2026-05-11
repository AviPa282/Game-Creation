# 💣 Pass the Bomb — Setup Guide

## What you have
- `server.js` — the real-time Node.js backend
- `public/index.html` — the game UI (everyone opens this on their phone)
- `package.json` — dependencies list

---

## Step 1 — Install Node.js (if you don't have it)
1. Go to https://nodejs.org
2. Download the **LTS** version (the big green button)
3. Install it, click Next through everything

---

## Step 2 — Run it locally (test with friends on same WiFi)

Open a terminal (press Win + R, type `cmd`, press Enter), then:

```
cd path\to\passbomb
npm install
node server.js
```

You'll see: `Pass the Bomb server running on port 3000`

Now everyone on the same WiFi can open a browser and go to:
```
http://YOUR_COMPUTER_IP:3000
```

To find your computer's IP: open cmd and type `ipconfig`
Look for "IPv4 Address" — it'll be something like `192.168.1.42`

---

## Step 3 — Deploy to Railway (play from anywhere, no WiFi needed)

This lets anyone in the world join your game with a link.

1. Go to https://railway.app and sign up (free)
2. Install Railway CLI: in cmd run `npm install -g @railway/cli`
3. In your `passbomb` folder, run:
   ```
   railway login
   railway init
   railway up
   ```
4. Railway gives you a public URL like `https://passbomb-production.up.railway.app`
5. Share that URL with your friends — they open it on their phones, done!

---

## How to play

1. **One person** opens the game and taps "Create Room"
2. They share the 4-letter room code with everyone
3. **Everyone else** taps "Join Room" and enters the code
4. **Sit in a circle** in seat order (seat 1, 2, 3, 4...)
   - Swipe RIGHT → passes to the person on your right
   - Swipe LEFT → passes to the person on your left
5. Host taps "Start Game"
6. Each person privately sees their role and starting item
7. Timer counts down — pass items, use powers, survive!

---

## Items & Powers

| Item | Power | How it works |
|------|-------|-------------|
| 💣 Bomb | — | Pass it before time runs out! |
| 🛡️ Shield | Auto | Immune from the vote if bomb explodes on you |
| 🔍 Magnifier | Tap "Use Power" | Secretly peek at one player's item |
| 🔀 Swap | Tap "Use Power" | Force two other players to swap items |
| ⏸️ Freeze | Tap "Use Power" | Stops the timer for 5 seconds |
| 💀 Cursed Box | Auto | Looks safe but counts as suspicious in voting |
| 🎭 Disguise | Auto | Your item appears as something else |
| 💎 Gem | Auto | Bonus 2 pts if you survive with it |
| 📦 Package | — | Just a regular package |

---

## Scoring
- Civilians win (bomber caught or explodes on bomber) → each civilian gets **+1 point**
- Bomber escapes (wrong vote) → bomber gets **+2 points**
- Play multiple rounds and track the leaderboard!
