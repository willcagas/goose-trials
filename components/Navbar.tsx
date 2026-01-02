'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/app/providers/SessionContext';
import LoginModal from '@/components/LoginModal';

export default function Navbar() {
  const [showLogin, setShowLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const handleGamesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (pathname === '/') {
      const trialsSection = document.getElementById('trials');
      if (trialsSection) {
        trialsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      router.push('/');
      setTimeout(() => {
        const trialsSection = document.getElementById('trials');
        if (trialsSection) {
          trialsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  // Shared classes for Nav Links to include the animated underline
  const navLinkStyles = "relative text-white/60 uppercase text-xs font-bold tracking-widest hover:text-amber-400 transition-colors whitespace-nowrap group/link active:scale-95";
  const underlineStyles = "absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-400 transition-all duration-300 group-hover/link:w-full";

  return (
    <>
      <nav className="relative z-20 bg-[#0a0a0a] border-b border-white/10 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-20 md:h-24">
          
          {/* Logo Section - Large & Stacked */}
          <Link href="/" className="flex items-center gap-3 group shrink-0 cursor-pointer">
            <div className="relative w-14 h-14 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              <img 
                src="/goosetrialspfp-removebg-preview.png" 
                alt="Goose Trials Logo"
                className="w-12 h-12 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-lg md:text-xl font-bold text-white leading-[0.9] uppercase tracking-wider">
                GOOSE
              </span>
              <span className="text-lg md:text-xl font-bold text-amber-400 leading-[0.9] uppercase tracking-wider">
                TRIALS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-10">
            <button 
              onClick={handleGamesClick} 
              className={`${navLinkStyles} cursor-pointer`}
            >
              Games
              <span className={underlineStyles} />
            </button>
            
            <Link href="/leaderboard" className={`${navLinkStyles} cursor-pointer`}>
              Rankings
              <span className={underlineStyles} />
            </Link>

            {user ? (
              <>
                <Link href="/profile" className={`${navLinkStyles} cursor-pointer`}>
                  Profile
                  <span className={underlineStyles} />
                </Link>
                <button
                  onClick={() => { setMobileMenuOpen(false); signOut(); }}
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white/80 border border-white/20 rounded-full hover:bg-white/10 hover:border-white/40 hover:text-white transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-8 py-3 bg-gradient-to-r from-amber-400 to-[#FFC700] text-gray-900 font-black text-xs uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(255,215,0,0.2)] hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Burger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white/70 hover:text-amber-400 transition-colors active:scale-90"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-10 border-t border-white/5 space-y-8 bg-[#0a0a0a] px-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-8 text-center">
              <button onClick={handleGamesClick} className="block w-full text-white/70 uppercase text-sm font-bold tracking-[0.2em] hover:text-amber-400">Games</button>
              <Link href="/leaderboard" onClick={() => setMobileMenuOpen(false)} className="block text-white/70 uppercase text-sm font-bold tracking-[0.2em] hover:text-amber-400">Rankings</Link>
              {user && <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="block text-white/70 uppercase text-sm font-bold tracking-[0.2em] hover:text-amber-400">Profile</Link>}
            </div>
            <div className="pt-8 border-t border-white/5">
              {user ? (
                <button onClick={() => { setMobileMenuOpen(false); signOut(); }} className="w-full py-4 border border-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-full active:scale-95 transition-transform">Sign Out</button>
              ) : (
                <button onClick={() => { setMobileMenuOpen(false); setShowLogin(true); }} className="w-full py-4 bg-amber-400 text-gray-900 font-black text-xs uppercase tracking-widest rounded-full shadow-lg active:scale-95 transition-transform">Sign In</button>
              )}
            </div>
          </div>
        )}
      </nav>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}