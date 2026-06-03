# 📈 Million Tracker

A mobile-first web app to **plan and track your journey from $10,000 to $1,000,000**.

Set a starting amount and a growth rate per period (e.g. 2% per month), optionally
add a recurring deposit, and the app calculates how long it takes to hit your goal.
Then log your real account balance over time to see whether you're ahead of or
behind your plan.

## Features

- **Plan** — starting amount, growth % per period (weekly / monthly / quarterly / yearly),
  optional recurring deposit, and a custom goal. Instantly shows how many periods, how
  much time, and the target date to reach your goal, plus how much comes from growth.
- **Track** — log dated balances with optional notes. Each entry shows the change since
  the last one, and your progress bar + "vs plan" stat update automatically.
- **Schedule** — a milestone table of where the plan says you'll be at each step.
- **Growth curve** — a chart overlaying your plan against your actual logged balances.
- **Offline & private** — everything is saved in your browser's `localStorage` on your
  device. No account, no server, no data leaves your phone.

## How the math works

Each period the balance grows by your rate and then your recurring deposit is added:

```
nextBalance = balance × (1 + rate) + deposit
```

This repeats until the balance reaches your goal.

## Run it

It's plain HTML/CSS/JS — no build step. Open `index.html` in a browser, or serve the
folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000 on your phone or desktop
```

On a phone, use your browser's **Add to Home Screen** to launch it like a native app.

## Disclaimer

Estimates are for planning purposes only and are not financial advice. Real investment
returns vary and are not guaranteed.
