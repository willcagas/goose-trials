'use client';
import Link from 'next/link';
import {useSession} from '@/app/providers/SessionContext';
import {useMe} from '@/app/providers/MeContext';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import {useEffect, useRef, useState, useCallback} from 'react';
import {Zap, Hash, Eye, Layers, Route, Target, Trophy, Box} from 'lucide-react';

interface FlyingGoose {
  id: number;
  x: number;
  y: number;
  angle: number;
  velocityX: number;
  velocityY: number;
}

interface ProtocolCardProps {
  number: string;
  title: string;
  desc: string;
  delay?: string;
  isVisible: boolean;
}

function ProtocolCard({number, title, desc, delay, isVisible}: ProtocolCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({x: 0, y: 0});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    
    setRotate({x: rotateX, y: rotateY});
  };

  const handleMouseLeave = () => {
    setRotate({x: 0, y: 0});
  };

  return (
    <div className={`h-full ${isVisible ? `opacity-100 translate-y-0 ${delay || ''}` : 'opacity-0 translate-y-10'} transition-all duration-700`}>
      <div 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transition: rotate.x === 0 && rotate.y === 0 ? 'transform 0.5s ease-out' : 'transform 0.1s ease-out'
        }}
        className="relative group p-8 rounded-lg bg-white border border-gray-200 shadow-sm hover:border-amber-400 hover:shadow-lg active:scale-[0.98] transition-all duration-500 overflow-hidden cursor-pointer h-full flex flex-col"
      >
        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="text-6xl font-bold text-gray-200 group-hover:text-amber-400/70 transition-all duration-500 leading-none">
              {number}
            </div>
            <div className="w-8 h-8 border-t-2 border-r-2 border-gray-200 group-hover:border-amber-400/50 transition-colors duration-300" />
          </div>
          
          <h3 className="text-2xl font-bold mb-3 text-gray-900 group-hover:translate-x-2 transition-transform duration-300 relative z-10">
            {title}
          </h3>
          
          <p className="text-gray-500 text-sm leading-relaxed group-hover:text-gray-600 transition-colors duration-300 relative z-10 flex-1">
            {desc}
          </p>
        </div>
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-amber-400/5 rounded-br-lg" />
      </div>
    </div>
  );
}

function ProtocolSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {threshold: 0.1}
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      number: "01",
      title: "Jump In",
      desc: "No sign-up needed. Start playing instantly.",
      delay: "delay-150",
    },
    {
      number: "02",
      title: "Run the Trials",
      desc: "Seven fast challenges designed to test focus, speed, and execution.",
    },    
    {
      number: "03",
      title: "Own Your Rank",
      desc: "Rankings only mean something when the run is honest.",
      delay: "delay-450",
    }
  ];
  

  return (
    <section ref={sectionRef} className="relative z-10 px-4 py-16 md:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className={`text-center mb-12 md:mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-2 text-gray-900">
            The <span className="text-amber-400">Protocol</span>
          </h2>
          <p className="text-gray-600 text-lg">
            Know the rules. Optimize the run. Climb the leaderboard.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <ProtocolCard key={i} {...step} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface Test {
  slug: string;
  name: string;
  description: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  best_score: number;
  rank: number;
  is_you: boolean;
  user_tag?: string | null; // UserTagType from server
}

export default function HomePage() {
  const {loading, user} = useSession();
  const {me} = useMe();
  const [geese, setGeese] = useState<FlyingGoose[]>([]);
  const gooseIdRef = useRef(0);
  const [tests, setTests] = useState<Test[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [showLogin, setShowLogin] = useState(false);

  // Animation loop for geese movement
  useEffect(() => {
    const interval = setInterval(() => {
      setGeese(prevGeese => {
        return prevGeese.map(goose => ({
          ...goose,
          x: goose.x + goose.velocityX,
          y: goose.y + goose.velocityY
        })).filter(goose => {
          return goose.x > -200 && goose.x < window.innerWidth + 200 &&
                 goose.y > -200 && goose.y < window.innerHeight + 200;
        });
      });
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // Function to create a new goose
  const createGoose = useCallback(() => {
    const side = Math.floor(Math.random() * 4);
    let startX, startY, angle;
    const speed = 8 + Math.random() * 7;
    switch(side) {
      case 0: startX = Math.random() * window.innerWidth; startY = -200; angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2; break;
      case 1: startX = window.innerWidth + 200; startY = Math.random() * window.innerHeight; angle = Math.PI + (Math.random() - 0.5) * Math.PI / 2; break;
      case 2: startX = Math.random() * window.innerWidth; startY = window.innerHeight + 200; angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2; break;
      default: startX = -200; startY = Math.random() * window.innerHeight; angle = (Math.random() - 0.5) * Math.PI / 2; break;
    }
    const newGoose: FlyingGoose = { 
      id: gooseIdRef.current++, 
      x: startX, 
      y: startY, 
      angle: angle, 
      velocityX: Math.cos(angle) * speed, 
      velocityY: Math.sin(angle) * speed 
    };
    setGeese(prev => [...prev, newGoose]);
  }, []);

  // Auto-spawn geese every 30 seconds (only on main page)
  useEffect(() => {
    const autoSpawnInterval = setInterval(() => {
      createGoose();
    }, 30000); // 30 seconds

    return () => clearInterval(autoSpawnInterval);
  }, [createGoose]);

  // Fetch tests and top 3 leaders for each test
  useEffect(() => {
    async function fetchTestsAndLeaders() {
      try {
        const response = await fetch('/api/tests/all');
        if (response.ok) {
          const { data } = await response.json();
          setTests(data || []);
          
          // Fetch full leaderboard for each test (to get player count and user rank)
          const leaderboardPromises = (data || []).map(async (test: Test) => {
            try {
              const leaderResponse = await fetch(`/api/leaderboard?test_slug=${test.slug}&limit=50`);
              if (leaderResponse.ok) {
                const { data: leaderData } = await leaderResponse.json();
                return { slug: test.slug, leaders: leaderData || [] };
              }
            } catch (error) {
              console.error(`Error fetching leaders for ${test.slug}:`, error);
            }
            return { slug: test.slug, leaders: [] };
          });
          
          const leaderboardResults = await Promise.all(leaderboardPromises);
          const leaderboardMap: Record<string, LeaderboardEntry[]> = {};
          leaderboardResults.forEach(({ slug, leaders }) => {
            leaderboardMap[slug] = leaders;
          });
          setLeaderboards(leaderboardMap);
        }
      } catch (error) {
        console.error('Error fetching tests:', error);
      } finally {
        setTestsLoading(false);
      }
    }
    fetchTestsAndLeaders();
  }, [user]);

  const handleClick = () => {
    createGoose();
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-900">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-60 text-gray-900 relative overflow-hidden" onClick={handleClick}>
      
      {/* SPRITESHEET GEESE LAYER */}
      {geese.map(goose => (
        <div
          key={goose.id}
          className="FlyingGoose pointer-events-none absolute z-[5]"
          style={{
            left: `${goose.x}px`,
            top: `${goose.y}px`,
            transform: `rotate(${goose.angle}rad)`,
          }}
        >
          <img className="Goose_spritesheet" src="/newSpriteSheet.png" alt="Flying Goose" />
        </div>
      ))}

      <Navbar />
      
      {/* Hero Section */}
      <section className="relative z-10 px-6 py-12 md:py-20 bg-[#0a0a0a] text-white min-h-[85vh] md:min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
        {/* Ceiling light bar effect - horizontal light source */}
        <div className="absolute top-0 left-0 right-0 h-[600px] pointer-events-none">
          {/* Light bar at the top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent blur-sm" />
          {/* Light cone spreading downward */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-amber-400/25 via-amber-500/8 to-transparent blur-3xl" style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' }} />
        </div>
        <div className="relative max-w-4xl mx-auto w-full text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-[1.1] flex flex-col items-center">
            <span className="block text-white mb-2">Think You&apos;re Smart?</span>
            <span className="text-amber-400">Prove It.</span>
          </h1>
          <div className="flex flex-col items-center mb-10 md:mb-14 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl text-white/90 font-semibold mb-3 max-w-2xl">
              Battle against other students. Climb the ranks.
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-white/60 font-medium">
              Seven quick games. One leaderboard. See where you rank.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-xs sm:max-w-none mx-auto">
            <button
              onClick={(e) => { e.stopPropagation(); document.getElementById('trials')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="w-full sm:w-auto px-10 py-4 bg-amber-400 hover:bg-amber-300 hover:scale-105 text-black font-bold text-sm md:text-base uppercase tracking-widest rounded-full shadow-lg active:scale-95 transition-all cursor-pointer min-w-[200px]"
            >
              Play Now
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-amber-400/30 text-white font-bold text-sm md:text-base uppercase tracking-widest rounded-full backdrop-blur-sm hover:bg-amber-400/10 hover:border-amber-400 active:scale-95 transition-all min-w-[200px] cursor-pointer"
            >
              View Rankings
            </button>
          </div>
        </div>
      </section>

      <ProtocolSection />

      {/* The Trials Section */}
      <section id="trials" className="relative z-10 px-4 py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
              The <span className="text-amber-400">Trials</span>
            </h2>
            <p className="text-gray-600 text-lg">
              Test your skills with seven quick games, each with a unique challenge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { href: "/games/reaction-time", tag: "REACTION", icon: Zap, title: "Reaction Time", desc: "Test your reflexes with split-second timing challenges." },
              { href: "/games/number-memory", tag: "MEMORY", icon: Hash, title: "Number Memory", desc: "Remember and recall increasingly long number sequences." },
              { href: "/games/chimp", tag: "VISUAL", icon: Eye, title: "Chimp Test", desc: "Master pattern recognition and working memory." },
              { href: "/games/aim-trainer", tag: "ACCURACY", icon: Target, title: "Aim Trainer", desc: "Hit targets as quick as possible to test accuracy." },
              { href: "/games/pathfinding", tag: "SPATIAL", icon: Route, title: "Pathfinding", desc: "Navigate mazes and find the shortest route." },
              { href: "/games/tetris", tag: "SPEED", icon: Box, title: "Tetris", desc: "Clear 15 lines as fast as possible.", mobileOnly: true }
            ].map((trial, idx) => {
              const isTetris = trial.title === "Tetris";
              const isDisabledOnMobile = isTetris;

              return (
                <a
                  key={idx}
                  href={trial.href}
                  onClick={(e) => {
                    if (isDisabledOnMobile && window.innerWidth < 768) {
                      e.preventDefault();
                    } else {
                      e.stopPropagation();
                    }
                  }}
                  className={isDisabledOnMobile ? "cursor-pointer md:cursor-pointer" : "cursor-pointer"}
                >
                  <div className={`relative overflow-hidden group p-8 rounded-3xl border-2 transition-all shadow-sm h-full flex flex-col ${
                    isDisabledOnMobile
                      ? "bg-gray-100 border-gray-300 md:bg-white md:border-gray-200 md:hover:border-amber-400 md:active:scale-[0.98] md:hover:shadow-md"
                      : "bg-white border-gray-200 hover:border-amber-400 active:scale-[0.98] hover:shadow-md"
                  }`}>
                    {/* Mobile Not Supported Badge - Only visible on mobile for Tetris */}
                    {isDisabledOnMobile && (
                      <div className="absolute top-4 left-4 md:hidden">
                        <span className="px-3 py-1 bg-gray-300 text-gray-600 text-[10px] font-bold uppercase rounded-full border border-gray-400">
                          Desktop Only
                        </span>
                      </div>
                    )}

                    <div className="absolute top-0 right-0 p-4">
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border ${
                        isDisabledOnMobile
                          ? "bg-gray-300/50 text-gray-500 border-gray-400/30 md:bg-amber-400/10 md:text-amber-500 md:border-amber-400/30"
                          : "bg-amber-400/10 text-amber-500 border-amber-400/30"
                      }`}>
                        {trial.tag}
                      </span>
                    </div>
                    <div className="mb-4">
                      <trial.icon className={`w-8 h-8 ${isDisabledOnMobile ? "text-gray-400 md:text-amber-400" : "text-amber-400"}`} />
                    </div>
                    <h3 className={`text-2xl font-bold mb-3 uppercase pr-20 ${isDisabledOnMobile ? "text-gray-500 md:text-gray-900" : "text-gray-900"}`}>
                      {trial.title}
                    </h3>
                    <p className={`text-sm leading-relaxed mb-6 flex-1 ${isDisabledOnMobile ? "text-gray-400 md:text-gray-600" : "text-gray-600"}`}>
                      {trial.desc}
                    </p>
                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full w-0 transition-all duration-700 ${
                        isDisabledOnMobile
                          ? "bg-gray-400 md:bg-amber-400 md:group-hover:w-full"
                          : "bg-amber-400 group-hover:w-full"
                      }`}></div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Tower of Hanoi - Centered, same width as grid items */}
          <div className="flex justify-center mt-6">
            <div className="w-full md:w-1/2 lg:w-1/3">
              <a href="/games/hanoi" onClick={(e) => e.stopPropagation()} className="cursor-pointer">
                <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-amber-400 active:scale-[0.98] transition-all shadow-sm hover:shadow-md h-full flex flex-col">
                  <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase rounded-full border border-rose-500/30">
                      CHALLENGING
                    </span>
                    <span className="px-3 py-1 bg-amber-400/10 text-amber-500 text-[10px] font-bold uppercase rounded-full border border-amber-400/30">
                      PUZZLE
                    </span>
                  </div>
                  <div className="mb-4">
                    <Layers className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Tower of Hanoi</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">Solve the classic puzzle with optimal moves.</p>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 w-0 group-hover:w-full transition-all duration-700"></div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* The Rankings Section - Design Option 5: Stats Card Style */}
      <section id="rankings" className="relative z-10 px-4 py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
              The <span className="text-amber-400">Rankings</span>
            </h2>
            <p className="text-gray-600 text-lg">
              Compare your scores with players from your university and country.
            </p>
          </div>

          {/* Sign in message for non-logged in users */}
          {!me?.isLoggedIn && (
            <div className="max-w-4xl mx-auto mb-6">
              <button
                onClick={(e) => { e.stopPropagation(); setShowLogin(true); }}
                className="w-full px-6 py-3 bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold text-sm uppercase tracking-widest rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 group"
              >
                <span>Sign in with your university email to view your rank</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2.5} 
                  stroke="currentColor" 
                  className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}

          {testsLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading rankings...</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No rankings available.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-3">
              {(() => {
                // Define the order of trials to match the trials section
                const trialOrder = [
                  'reaction-time',
                  'number-memory',
                  'chimp',
                  'aim-trainer',
                  'pathfinding',
                  'tetris',
                  'hanoi'
                ];

                // Sort tests to match trial order
                const sortedTests = [...tests].sort((a, b) => {
                  const indexA = trialOrder.indexOf(a.slug);
                  const indexB = trialOrder.indexOf(b.slug);
                  // If slug not found in order, put it at the end
                  if (indexA === -1 && indexB === -1) return 0;
                  if (indexA === -1) return 1;
                  if (indexB === -1) return -1;
                  return indexA - indexB;
                });

                return sortedTests.map((test) => {
                const leaders = leaderboards[test.slug] || [];
                const playerCount = leaders.length;
                const userEntry = me?.isLoggedIn ? leaders.find(entry => entry.is_you) : null;

                return (
                  <Link
                    key={test.slug}
                    href={`/leaderboard/${test.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="group block cursor-pointer"
                  >
                    <div className="relative overflow-hidden px-6 py-4 rounded-xl bg-white border border-gray-200 hover:border-amber-400 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Trophy Icon & Title */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Trophy className="w-6 h-6 text-amber-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                          <h3 className="text-lg font-bold text-gray-900 uppercase group-hover:text-amber-600 transition-colors truncate">
                            {test.name}
                          </h3>
                        </div>

                        {/* Right: Stats */}
                        <div className="flex items-center gap-6 flex-shrink-0">
                          {/* User Rank (if logged in and has played) */}
                          {userEntry && (
                            <div className="text-right">
                              <div className="text-xs text-gray-500 uppercase tracking-wide">Your Rank</div>
                              <div className="text-lg font-bold text-amber-600">
                                #{userEntry.rank}
                              </div>
                            </div>
                          )}

                          {/* Player Count */}
                          <div className="text-right">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Players</div>
                            <div className="text-lg font-bold text-gray-900">
                              {playerCount > 0 ? playerCount : '—'}
                            </div>
                          </div>

                          {/* Arrow */}
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })})()}
            </div>
          )}
        </div>
      </section>

      <footer className="relative z-10 px-4 py-8 text-center border-t border-gray-200">
        <p className="text-sm text-gray-500 tracking-wide">Built by students at the University of Waterloo.</p>
        <p className="text-sm text-gray-500 tracking-wide mt-4">
          Questions? Contact <a href="mailto:goosetrials@gmail.com" className="text-amber-400 hover:text-amber-300 underline">goosetrials@gmail.com</a>
        </p>
      </footer>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}