'use client';
import Link from 'next/link';
import {useSession} from '@/app/providers/SessionContext';
import Navbar from '@/components/Navbar';
import {useEffect, useRef, useState} from 'react';
import {Zap, Hash, Eye, Layers, Route, ArrowUpDown} from 'lucide-react';

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
  delay: string;
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
    <div className={`h-full ${isVisible ? `opacity-100 translate-y-0 ${delay}` : 'opacity-0 translate-y-10'} transition-all duration-700`}>
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
    { number: "01", title: "Play Instantly", desc: "No sign-up required. Jump in as a guest and start playing.", delay: "delay-150" },
    { number: "02", title: "Complete 6 Games", desc: "Finish all mini-games in under 2 minutes total.", delay: "delay-300" },
    { number: "03", title: "See Your Rank", desc: "Check your campus leaderboard. Also see how you rank globally.", delay: "delay-450" }
  ];

  return (
    <section ref={sectionRef} className="relative z-10 px-4 py-16 md:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className={`text-center mb-12 md:mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-2 text-gray-900">
            The <span className="text-amber-400">Protocol</span>
          </h2>
          <p className="text-gray-500 text-sm md:text-base">
            Fastest cognitive benchmark. Optimized for quick breaks between classes.
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

export default function HomePage() {
  const {loading} = useSession();
  const [geese, setGeese] = useState<FlyingGoose[]>([]);
  const gooseIdRef = useRef(0);

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

  const handleClick = (e: React.MouseEvent) => {
    const side = Math.floor(Math.random() * 4);
    let startX, startY, angle;
    const speed = 8 + Math.random() * 7;
    switch(side) {
      case 0: startX = Math.random() * window.innerWidth; startY = -200; angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2; break;
      case 1: startX = window.innerWidth + 200; startY = Math.random() * window.innerHeight; angle = Math.PI + (Math.random() - 0.5) * Math.PI / 2; break;
      case 2: startX = Math.random() * window.innerWidth; startY = window.innerHeight + 200; angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2; break;
      default: startX = -200; startY = Math.random() * window.innerHeight; angle = (Math.random() - 0.5) * Math.PI / 2; break;
    }
    const newGoose: FlyingGoose = { id: gooseIdRef.current++, x: startX, y: startY, angle: angle, velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed };
    setGeese(prev => [...prev, newGoose]);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-900">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative overflow-hidden" onClick={handleClick}>
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative z-10 px-6 py-12 md:py-20 bg-[#0a0a0a] text-white min-h-[85vh] md:min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="max-w-4xl mx-auto w-full text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-[1.1] flex flex-col items-center">
            <span className="block text-white mb-2">Think You're Smart?</span>
            <span className="text-amber-400">Prove It.</span>
          </h1>
          <div className="flex flex-col items-center mb-10 md:mb-14 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl text-white/90 font-semibold mb-3 max-w-2xl">
              Battle your campus. Benchmark the world.
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-white/60 font-medium">
              Six quick games. One leaderboard. See where you rank.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-xs sm:max-w-none mx-auto">
            <button
              onClick={(e) => { e.stopPropagation(); document.getElementById('trials')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="w-full sm:w-auto px-10 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm md:text-base uppercase tracking-widest rounded-full shadow-lg active:scale-95 transition-all cursor-pointer min-w-[200px]"
            >
              Play Now
            </button>
            <Link 
              href="/leaderboard"
              className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-amber-400/30 text-white font-bold text-sm md:text-base uppercase tracking-widest rounded-full backdrop-blur-sm hover:bg-amber-400/10 hover:border-amber-400 active:scale-95 transition-all min-w-[200px] text-center cursor-pointer"
            >
              View Rankings
            </Link>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { href: "/games/reaction-time", tag: "REACTION", icon: Zap, title: "Reaction Time", desc: "Test your reflexes with split-second timing challenges." },
              { href: "#", tag: "MEMORY", icon: Hash, title: "Number Memory", desc: "Remember and recall increasingly long number sequences." },
              { href: "/games/chimp", tag: "VISUAL", icon: Eye, title: "Chimp Test", desc: "Master pattern recognition and working memory." },
              { href: "#", tag: "SPATIAL", icon: Layers, title: "Tower of Hanoi", desc: "Solve the classic puzzle with optimal moves." },
              { href: "/games/pathfinding", tag: "SPATIAL", icon: Route, title: "Pathfinding", desc: "Navigate mazes and find the shortest route." },
              { href: "/games/aim-trainer", tag: "ACCURACY", icon: ArrowUpDown, title: "Aim Trainer", desc: "Hit targets as quick as possible." }
            ].map((trial, idx) => (
              <a key={idx} href={trial.href} onClick={(e) => e.stopPropagation()} className="cursor-pointer">
                <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-amber-400 active:scale-[0.98] transition-all shadow-sm hover:shadow-md h-full flex flex-col">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="px-3 py-1 bg-amber-400/10 text-amber-500 text-[10px] font-bold uppercase rounded-full border border-amber-400/30">
                      {trial.tag}
                    </span>
                  </div>
                  <div className="mb-4">
                    <trial.icon className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">{trial.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">{trial.desc}</p>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 w-0 group-hover:w-full transition-all duration-700"></div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="relative z-10 px-4 py-16 md:py-20 bg-white/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
              The <span className="text-amber-400">Rankings</span>
            </h2>
          </div>
          <Link 
            href="/leaderboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-400 hover:bg-amber-500 text-black uppercase font-bold tracking-widest rounded-full active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            View Leaderboard
          </Link>
        </div>
      </section>

      <footer className="relative z-10 px-4 py-8 text-center border-t border-gray-200">
        <p className="text-sm text-gray-500 tracking-wide">Built by students at the University of Waterloo.</p>
      </footer>
    </div>
  );
}