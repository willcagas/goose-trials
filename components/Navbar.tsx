'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/app/providers/SessionContext';
import LoginModal from '@/components/LoginModal';
import LoginNotification from '@/components/LoginNotification';

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

  const handleRankingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    
    if (pathname === '/') {
      const rankingsSection = document.getElementById('rankings');
      if (rankingsSection) {
        rankingsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      router.push('/');
      setTimeout(() => {
        const rankingsSection = document.getElementById('rankings');
        if (rankingsSection) {
          rankingsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const navLinkStyles = "relative text-white/70 uppercase text-xs font-bold tracking-widest hover:text-amber-400 transition-colors whitespace-nowrap group/link active:scale-95 cursor-pointer";
  const underlineStyles = "absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-400 transition-all duration-300 group-hover/link:w-full";

  return (
    <>
      {/* Changed relative to fixed, added top-0, left-0, and w-full */}
      <nav className="fixed top-0 left-0 w-full z-50 px-4 md:px-8 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 h-16 md:h-20 flex items-center justify-between">
        {/* Amber glow effect at the top */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60" />
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-amber-400/20 via-amber-400/5 to-transparent" />
        
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3 group shrink-0 cursor-pointer">
          <div className="relative w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <img 
              src="/goosetrialspfp-removebg-preview.png" 
              alt="Goose Trials Logo"
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-base md:text-xl font-bold text-white leading-[0.9] uppercase tracking-wider">
              GOOSE
            </span>
            <span className="text-base md:text-xl font-bold text-amber-400 leading-[0.9] uppercase tracking-wider">
              TRIALS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-10">
          <button onClick={handleGamesClick} className={navLinkStyles}>
            Trials
            <span className={underlineStyles} />
          </button>
          
          <button onClick={handleRankingsClick} className={navLinkStyles}>
            Rankings
            <span className={underlineStyles} />
          </button>

          {user ? (
            <>
              <Link href="/profile" className={navLinkStyles}>
                Profile
                <span className={underlineStyles} />
              </Link>
              <button
                onClick={signOut}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white/80 border border-white/20 rounded-full hover:bg-white/10 hover:border-white/40 hover:text-white transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowLogin(true); }}
              className="px-8 py-3 bg-amber-400 text-gray-900 font-black text-xs uppercase tracking-widest rounded-full shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-white/70 hover:text-amber-400 transition-colors cursor-pointer"
        >
          {mobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu Dropdown - Updated to fixed to stay with the navbar */}
      {mobileMenuOpen && (
        <div className="fixed top-16 md:top-20 left-0 w-full bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 z-40 py-8 px-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4">
          <button onClick={handleGamesClick} className="text-white uppercase text-sm font-bold tracking-widest text-left">Games</button>
          <button onClick={(e) => { handleRankingsClick(e); setMobileMenuOpen(false); }} className="text-white uppercase text-sm font-bold tracking-widest text-left">Rankings</button>
          {user && <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="text-white uppercase text-sm font-bold tracking-widest">Profile</Link>}
          <div className="pt-4 border-t border-white/10">
            {user ? (
              <button onClick={(e) => { e.stopPropagation(); signOut(); setMobileMenuOpen(false); }} className="w-full py-4 border border-white/20 text-white font-bold uppercase text-xs rounded-full">Sign Out</button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setShowLogin(true); setMobileMenuOpen(false); }} className="w-full py-4 bg-amber-400 text-gray-900 font-black uppercase text-xs rounded-full shadow-lg">Sign In</button>
            )}
          </div>
        </div>
      )}

      {/* Spacer to prevent content from going under the fixed navbar */}
      <div className="h-16 md:h-20" />

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      <LoginNotification onOpenModal={() => setShowLogin(true)} />
    </>
  );
}