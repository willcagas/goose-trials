'use client';
import Link from 'next/link';
import {useSession} from '@/app/providers/SessionContext';
import Navbar from '@/components/Navbar';
import {useEffect, useRef, useState} from 'react';
import {Zap, Hash, Eye, Layers, Route, ArrowUpDown} from 'lucide-react';

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
    
    // Calculate rotation (max 15 degrees)
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
        className="relative group p-8 rounded-lg bg-white border border-gray-200 shadow-sm hover:border-[#FFD700] hover:shadow-lg transition-all duration-500 overflow-hidden cursor-pointer h-full flex flex-col"
      >
        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="text-6xl font-bold text-gray-100 group-hover:text-[#FFD700]/70 transition-all duration-500 leading-none">
              {number}
            </div>
            <div className="w-8 h-8 border-t-2 border-r-2 border-gray-200 group-hover:border-[#FFD700]/50 transition-colors duration-300" />
          </div>
          
          <h3 className="text-2xl font-bold mb-3 text-gray-900 group-hover:translate-x-2 transition-transform duration-300 relative z-10">
            {title}
          </h3>
          
          <p className="text-gray-500 text-sm leading-relaxed group-hover:text-gray-600 transition-colors duration-300 relative z-10 flex-1">
            {desc}
          </p>
        </div>
        
        {/* Bottom Corner Accent */}
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-[#FFD700]/5 rounded-br-lg" />
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
      title: "Play Instantly",
      desc: "No sign-up required. Jump in as a guest and start playing.",
      delay: "delay-150"
    },
    {
      number: "02",
      title: "Complete 5 Games",
      desc: "Finish all mini-games in under 2 minutes total.",
      delay: "delay-300"
    },
    {
      number: "03",
      title: "See Your Rank",
      desc: "Check the Waterloo-only leaderboard and compete.",
      delay: "delay-450"
    }
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative z-10 px-4 py-16 md:py-20 bg-gray-50"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 md:mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-2 text-gray-900">
            The <span className="text-[#FFD700]">Protocol</span>
          </h2>
          <p className="text-gray-500 text-sm md:text-base">
            Fastest benchmark on Ring Road. Optimized for procrastination between classes.
          </p>
        </div>

        {/* Steps Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <ProtocolCard 
              key={i} 
              {...step}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const {loading} = useSession();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-900">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative z-10 px-4 py-8 md:py-12 text-center bg-[#0a0a0a] text-white min-h-[calc(100vh-4rem)] flex items-center">
        <div className="max-w-4xl mx-auto w-full">
          {/* University of Waterloo Exclusive Banner */}
          <div className="inline-block px-4 py-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/5 text-yellow-500 text-xs font-bold uppercase tracking-widest mb-8 animate-pulse">
            University of Waterloo Exclusive
          </div>
          
          {/* Main Headline */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 md:mb-6 tracking-tight leading-[1.1]">
            <span className="block text-white mb-1">Think You’re Smart? Prove It.</span>
            <span className="block text-[#FFD700]">Compete Against Waterloo's Best</span>
          </h1>
          
          {/* Value Proposition */}
          <p className="text-base md:text-lg lg:text-xl mb-5 text-white/90 font-medium">
            Five quick games. One leaderboard. See where you rank.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/games"
              className="px-8 md:px-10 py-3 md:py-4 bg-[#FFD700] text-black font-bold text-base md:text-lg uppercase tracking-wide rounded-lg hover:opacity-90 hover:scale-105 transition-all min-w-[160px] text-center"
            >
              Play Now
            </Link>
            <Link 
              href="/leaderboard"
              className="px-8 md:px-10 py-3 md:py-4 bg-transparent border-2 border-white text-white font-bold text-base md:text-lg uppercase tracking-wide rounded-lg hover:bg-white/10 transition-all min-w-[160px] text-center"
            >
              View Rankings
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <ProtocolSection />

      {/* The Trials Section */}
      <section className="relative z-10 px-4 py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
              The <span className="text-[#FFD700]">Trials</span>
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Each game is 20 seconds of pure cognitive intensity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#FFD700]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#FFD700]/30">
                  REACTION
                </span>
              </div>
              <div className="mb-4">
                <Zap className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Reaction Time</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Test your reflexes with split-second timing challenges.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>

            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#FFD700]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#FFD700]/30">
                  MEMORY
                </span>
              </div>
              <div className="mb-4">
                <Hash className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Number Memory</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Remember and recall increasingly long number sequences.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>

            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#FFD700]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#FFD700]/30">
                  VISUAL
                </span>
              </div>
              <div className="mb-4">
                <Eye className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Chimp Test</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Master pattern recognition and working memory.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>

            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#FFD700]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#FFD700]/30">
                  SPATIAL
                </span>
              </div>
              <div className="mb-4">
                <Layers className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Tower of Hanoi</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Solve the classic puzzle with optimal moves.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>

            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#FFD700]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#FFD700]/30">
                  SPATIAL
                </span>
              </div>
              <div className="mb-4">
                <Route className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Pathfinding</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Navigate mazes and find the shortest route.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>

            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#FFD700]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#FFD700]/30">
                  VISUAL
                </span>
              </div>
              <div className="mb-4">
                <ArrowUpDown className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Sorting</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Organize elements quickly and efficiently.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="relative z-10 px-4 py-16 md:py-20 bg-white/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
              The <span className="text-[#FFD700]">Rankings</span>
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              See how you stack up against Waterloo students. Top performers get bragging rights.
            </p>
          </div>
          <Link 
            href="/leaderboard"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-900 text-gray-900 uppercase font-bold tracking-wide rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
          >
            View Leaderboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-8 text-center border-t border-gray-200">
        <p className="text-sm text-gray-500 tracking-wide">
          Built by students at the University of Waterloo.
        </p>
      </footer>
    </div>
  );
}