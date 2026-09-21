# Hidayathon 2.O — Live Sports Meet Results & Championship Standings

Real-time live results portal and interactive House Championship Podium Dashboard for **Hidayathon 2.O Annual Sports Meet 2026 - 27**.

Powered directly by Google Sheets with zero backend dependencies, automatic 15-second polling, Olympic-style 3D podium, category point matrices, live results ticker, search & filtering, and a stadium/projector display mode.

---

## 🚀 Live Data Connection

Data is stored and updated in real-time in Google Sheets:
- **Google Sheet**: [Hidayathon 2.O Results](https://docs.google.com/spreadsheets/d/1rRUeY6iOaWIT7OPGMbJG6JnrYv7nOwUPiB8tHmOTep8/edit?usp=sharing)
- **Scoreboard Tab** (`gid=0`): Official House scores, ranks, medal tallies, and Category & Gender matrix.
- **Event Results Tab** (`gid=427537611`): Athlete names, chest numbers, house assignments, events, positions, and points.
- **House Championship Podium Dashboard Tab** (`gid=433488836`): Replaced with a fully responsive native web dashboard.

---

## 🌟 Key Features

1. **🏆 Olympic 3D Championship Podium**:
   - Elevated pedestals for 1st (Gold / Champion), 2nd (Silver), and 3rd (Bronze), plus 4th runner-up.
   - Dynamic confetti celebration when the championship leader changes!
2. **🛡️ 4 House Cards & Points Progress Tracker**:
   - **BLUE HOUSE** (Valiant Titans)
   - **GREEN HOUSE** (Fierce Falcons)
   - **RED HOUSE** (Blazing Warriors)
   - **YELLOW HOUSE** (Golden Knights)
   - Real-time medal tallies (🥇 Gold, 🥈 Silver, 🥉 Bronze) and relative score progress bars.
3. **⚡ Live Results Ticker**:
   - Continuous marquee ticker displaying the latest event champions and podium finishers as they are recorded.
4. **🏃 Live Event Results Explorer**:
   - Search by Athlete Name, Chest Number, or Event Name.
   - Filter by House, Category (LP Mini, LP Kiddies, UP Kiddies, Sub Junior, Junior), Gender (Boys, Girls), and Position (1st, 2nd, 3rd).
   - Toggle between **Cards View** and **Table View**.
5. **📊 Category & Division Matrix**:
   - Tabular breakdown across age categories and gender divisions with "Leading House" crown indicators.
   - Quick filters for All, Boys, and Girls.
6. **📺 Stadium / Projector Mode**:
   - Press **F** or click **Stadium Mode** for an ultra-high legibility broadcast view suitable for stadium projectors, TV screens, or LED walls.
7. **📲 Share & WhatsApp Integration**:
   - Instant 1-click sharing to WhatsApp and clipboard copy for parents, students, and teachers.

---

## 🌐 How to Publish to GitHub Pages

### Option 1: Using GitHub Web (Quickest & Easiest)
1. Create a new repository on [GitHub](https://github.com/new) named `hidayathon-live-results`.
2. Push this folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Hidayathon 2.O Live Results & Podium Dashboard"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/hidayathon-live-results.git
   git push -u origin main
   ```
3. In your GitHub repository:
   - Go to **Settings** > **Pages** (in the left sidebar).
   - Under **Build and deployment** > **Source**:
     - Select **Deploy from a branch**.
     - Choose Branch: **`main`** (or `master`) and folder: **`/ (root)`**.
     - Click **Save**.
4. In about 30–60 seconds, your site will be live at:
   `https://<YOUR_USERNAME>.github.io/hidayathon-live-results/`

### Option 2: Using GitHub Actions (Automated CI/CD)
- A GitHub Actions workflow is already pre-configured at `.github/workflows/deploy.yml`.
- Under **Settings** > **Pages** > **Build and deployment** > **Source**, simply select **GitHub Actions**.
- Every time you push changes, GitHub Actions will automatically publish the website!

---

## 💻 Local Testing

To test locally on your computer:
```bash
# Using Python
python -m http.server 8080

# Or using Node.js / npx
npx serve .
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.
