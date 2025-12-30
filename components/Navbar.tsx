'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {useSession} from '@/app/providers/SessionContext';
import LoginModal from '@/components/LoginModal';

export default function Navbar() {
  const [showLogin, setShowLogin] = useState(false);
  const {user, signOut} = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const handleGamesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (pathname === '/') {
      // On homepage, scroll to trials section
      const trialsSection = document.getElementById('trials');
      if (trialsSection) {
        trialsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // On other pages, navigate to homepage then scroll after load
      router.push('/');
      // Wait for navigation, then scroll
      setTimeout(() => {
        const trialsSection = document.getElementById('trials');
        if (trialsSection) {
          trialsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <>
      <nav className="relative z-20 px-4 md:px-6 lg:px-8 py-4 flex items-center justify-between bg-[#0a0a0a] border-b border-white/10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFD700] rounded-full flex items-center justify-center shadow-md">
            <span className="text-gray-900 font-bold text-xl">G</span>
          </div>
          <span className="text-white font-bold text-lg md:text-xl uppercase tracking-wide">
            GOOSE TRIALS
          </span>
        </Link>

        {/* Navigation Links and Sign In / Sign Out Button */}
        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={handleGamesClick}
            className="text-white uppercase text-sm font-medium tracking-wide hover:text-[#FFD700] transition-colors cursor-pointer bg-transparent border-none"
          >
            Games
          </button>
          <Link 
            href="/leaderboard" 
            className="text-white uppercase text-sm font-medium tracking-wide hover:text-[#FFD700] transition-colors"
          >
            Rankings
          </Link>
          {user ? (
            <>
              <Link 
                href="/profile" 
                className="text-white uppercase text-sm font-medium tracking-wide hover:text-[#FFD700] transition-colors"
              >
                Profile
              </Link>
              <button
                onClick={signOut}
                className="px-4 md:px-6 py-2 bg-transparent border-2 border-white text-white font-bold text-sm uppercase tracking-wide rounded-lg hover:bg-white/10 transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="px-4 md:px-6 py-2 bg-transparent border-2 border-white text-white font-bold text-sm uppercase tracking-wide rounded-lg hover:bg-white/10 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
