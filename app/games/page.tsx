'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Zap, Hash, Eye, Layers, Route, ArrowUpDown } from 'lucide-react';

export default function GamesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-12 md:mb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
            The <span className="text-[#c9a504]">Trials</span>
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Each game is 20 seconds of pure cognitive intensity.
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/games/reaction">
            <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#c9a504] transition-all shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-[#c9a504]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#c9a504]/30">
                  REACTION
                </span>
              </div>
              <div className="mb-4">
                <Zap className="w-8 h-8 text-[#c9a504]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Reaction Time</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Test your reflexes with split-second timing challenges.
              </p>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#c9a504] w-0 group-hover:w-full transition-all duration-700"></div>
              </div>
            </div>
          </Link>

          <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#c9a504] transition-all shadow-sm hover:shadow-md">
            <div className="absolute top-0 right-0 p-4">
              <span className="px-3 py-1 bg-[#c9a504]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#c9a504]/30">
                MEMORY
              </span>
            </div>
            <div className="mb-4">
              <Hash className="w-8 h-8 text-[#c9a504]" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Number Memory</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Remember and recall increasingly long number sequences.
            </p>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a504] w-0 group-hover:w-full transition-all duration-700"></div>
            </div>
          </div>

          <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#c9a504] transition-all shadow-sm hover:shadow-md">
            <div className="absolute top-0 right-0 p-4">
              <span className="px-3 py-1 bg-[#c9a504]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#c9a504]/30">
                VISUAL
              </span>
            </div>
            <div className="mb-4">
              <Eye className="w-8 h-8 text-[#c9a504]" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Chimp Test</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Master pattern recognition and working memory.
            </p>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a504] w-0 group-hover:w-full transition-all duration-700"></div>
            </div>
          </div>

          <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#c9a504] transition-all shadow-sm hover:shadow-md">
            <div className="absolute top-0 right-0 p-4">
              <span className="px-3 py-1 bg-[#c9a504]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#c9a504]/30">
                SPATIAL
              </span>
            </div>
            <div className="mb-4">
              <Layers className="w-8 h-8 text-[#c9a504]" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Tower of Hanoi</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Solve the classic puzzle with optimal moves.
            </p>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a504] w-0 group-hover:w-full transition-all duration-700"></div>
            </div>
          </div>

          <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#c9a504] transition-all shadow-sm hover:shadow-md">
            <div className="absolute top-0 right-0 p-4">
              <span className="px-3 py-1 bg-[#c9a504]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#c9a504]/30">
                SPATIAL
              </span>
            </div>
            <div className="mb-4">
              <Route className="w-8 h-8 text-[#c9a504]" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Pathfinding</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Navigate mazes and find the shortest route.
            </p>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a504] w-0 group-hover:w-full transition-all duration-700"></div>
            </div>
          </div>

          <div className="relative overflow-hidden group p-8 rounded-3xl bg-white border-2 border-gray-200 hover:border-[#c9a504] transition-all shadow-sm hover:shadow-md">
            <div className="absolute top-0 right-0 p-4">
              <span className="px-3 py-1 bg-[#c9a504]/10 text-[#E6C200] text-[10px] font-bold uppercase rounded-full border border-[#c9a504]/30">
                VISUAL
              </span>
            </div>
            <div className="mb-4">
              <ArrowUpDown className="w-8 h-8 text-[#c9a504]" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 uppercase pr-20">Sorting</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Organize elements quickly and efficiently.
            </p>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a504] w-0 group-hover:w-full transition-all duration-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}