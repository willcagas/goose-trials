# 🦢 Goose Trials

**Think You're Smart? Prove It.**

Battle against university students worldwide in seven cognitive skill games. Compete with other universities, other students in your country, and other students on your campus. See where you rank on each of these leaderboards.

---

## 🎮 The Games

Test your skills across seven challenging games:

- **⚡ Reaction Time** - Measure your reflexes with precision timing challenges
- **🧠 Number Memory** - Memorize and recall increasingly long number sequences  
- **🐵 Chimp Test** - Master the sequence memory challenge
- **🎯 Aim Trainer** - Test precision and accuracy under pressure
- **🧩 Pathfinding** - Navigate complex mazes and find optimal routes
- **📦 Tetris** - The ultimate block-stacking endurance test
- **🏛️ Tower of Hanoi** - Solve the classic puzzle with speed and strategy

Each game tracks your best scores and ranks you against other verified players.

---

## 🏆 Compete on Multiple Leaderboards

### Top Universities
See which universities dominate each game. Rankings are based on the median scores of the top 5 players from each institution, creating a fair competition between schools of all sizes.

### Country Rankings
Compete against players from your country. Show national pride and see where you rank among your fellow students.

### Campus Rankings
Battle against your own university. Represent yourself and climb to the top of your campus leaderboard.

### Real-Time Statistics
- View your percentile ranking across all games
- See score distributions and understand where you stand
- Track your progress over time
- Compare your performance to players worldwide

---

## 🌟 Why Goose Trials?

### Play Without Signing Up
Jump right in and start playing. Guest mode lets you compete immediately—no barriers, no friction.

### Seamless Account Creation
Love your scores? Sign up with your university email and your progress transfers instantly. Your guest scores become part of your permanent profile.

### University-Only Community
We're built for students. University email verification ensures you're competing against real students from real institutions.

### Fair Competition
We rely on an honour system. Our system detects and prevents obvious cheating. While we can't catch everything, we trust players to compete fairly and keep the competition honest.

---

## 📊 Your Performance Dashboard

- **Personal Bests** - Track your top scores across all seven games
- **Percentile Rankings** - See exactly where you rank compared to all players (e.g., "Top 15%")
- **Performance Graphs** - Visualize score distributions and your position
- **Achievement Highlights** - Showcase your best performances
- **Public Profile** - Share your profile and compete with friends

---

## 🎯 How It Works

1. **Play the Games** - Start with any game that catches your interest
2. **Submit Your Scores** - Your best scores are automatically saved
3. **Climb the Rankings** - Watch your position improve as you play
4. **Compete & Improve** - Challenge yourself to beat your personal bests
5. **Join the Community** - Sign up to save your progress and compete long-term

---

## 🚀 Getting Started

### For Players

Visit [goosetrials.com](https://goosetrials.com) to start playing. No download required. Just open your browser and begin competing.

### For Developers

Want to run your own instance? See the [Development Setup](#development-setup) section below.

---

## 🛠️ Built With Modern Technology

Goose Trials is built on a robust, scalable tech stack:

- **Next.js 16** - Lightning-fast React framework
- **TypeScript** - Type-safe, reliable codebase
- **Supabase** - Powerful PostgreSQL database with real-time capabilities
- **Tailwind CSS** - Beautiful, responsive design
- **PostHog** - Comprehensive analytics

---

## 📈 Platform Statistics

- 1000 unique players within 24 hours of launch
- Real-time leaderboard updates
- Thousands of games (runs) played

---

## 🔒 Privacy & Security

- **Secure Authentication** - Passwordless verification code authentication
- **University Verification** - Domain-based validation ensures student-only access
- **Data Protection** - Your scores and data are securely stored and protected
- **No Tracking** - We respect your privacy while providing essential analytics

---

## 🌍 Join the Competition

Ready to prove yourself? Join lots of students competing for the top spots.

**Play Now:** [goosetrials.com](https://goosetrials.com)

---

## 📧 Support & Contact

Questions, suggestions, or issues? We'd love to hear from you.

**Email:** [goosetrials@gmail.com](mailto:goosetrials@gmail.com)

---

## 💻 Development Setup

*For developers who want to contribute or run a local instance*

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- (Optional) Python 3.8+ for university data import

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/goose-trials.git
   cd goose-trials
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```

4. **Run database migrations**
   
   Apply migrations from `supabase/migrations/` in order (0001 through 0015) in your Supabase SQL editor.

5. **Execute database functions**
   
   Run the SQL files:
   - `get_leaderboard_function.sql`
   - `get_top_universities.sql`
   - `get_player_count_function.sql`

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open [http://localhost:3000](http://localhost:3000)**

### Import University Data

To enable university-based features:

1. Navigate to `supabase/scripts/`
2. Install Python dependencies: `pip install -r requirements.txt`
3. Set `SUPABASE_DB_URL` in your environment
4. Run: `python import_universities.py path/to/world_universities_and_domains.json`

### Project Structure

```
goose-trials/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── games/             # Game implementations
│   ├── leaderboard/       # Leaderboard pages
│   └── profile/           # User profiles
├── components/            # React components
├── lib/                   # Utilities & business logic
├── supabase/              # Database migrations & functions
└── public/                # Static assets
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Deployment

Deployed on Netlify with automatic CI/CD. 

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Built and maintained by students at the University of Waterloo, including Mohammed Naqi, Krish Vijay, Nate Lamarche, Kavir Auluck, and William Cagas.
