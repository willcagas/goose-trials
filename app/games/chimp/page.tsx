'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { submitScore } from '@/lib/db/scores';

type Phase = 'idle' | 'showing' | 'hidden' | 'failed';

type Cell = {
id: number;
value: number | null;
};


//Helper functions

//Returns a random integer between min and max (both included)
function randInt(min: number, max: number) {
return Math.floor(min + Math.random() * (max - min + 1));
}

//Decide grid size based on level
function computeGridSize(level: number) {
if (level <= 25) return 5;
if (level <= 36) return 6;
return 7;
}

//Generate an array of unique random cell indices
//maxExclusive is the number of cells possible (ex: for a 5x5, maxExclusive would be 25)
function pickRandomUniqueIndices(count: number, maxExclusive: number) {
const all: number[] = [];
for (let i = 0; i < maxExclusive; i++) all.push(i);

//Fisher-Yates list shuffle
for (let i = all.length - 1; i > 0; i--) {
  const j = randInt(0, i);
  const temp = all[i];
  all[i] = all[j];
  all[j] = temp;
}

// Take the first `count`
return all.slice(0, count);
}

// Build the cells for a level: place numbers 1..level in random positions
function makeCells(level: number, gridSize: number): Cell[] {
const total = gridSize * gridSize;

// Start with everything empty
const cells: Cell[] = [];
for (let id = 0; id < total; id++) {
  cells.push({ id, value: null });
}

// Choose random cell positions where numbers will go
const chosenPositions = pickRandomUniqueIndices(level, total);

// Put 1..level into those positions
for (let i = 0; i < level; i++) {
  const cellIndex = chosenPositions[i];
  cells[cellIndex].value = i + 1;
}

return cells;
}


// Component
export default function ChimpGamePage() {

// Main game state
//starts off at idle & level 4
const [phase, setPhase] = useState<Phase>('idle');
const [level, setLevel] = useState(4);

//Board state
//used arrow function for cells for lazy initialization (runs function only on mount/first time rendering rather than re-running each render)
//because running makeCells after every render is expensive
const [gridSize, setGridSize] = useState(computeGridSize(4));
const [cells, setCells] = useState<Cell[]>(() => makeCells(4, computeGridSize(4)));

//What number the user must click next (starts at 1)
const [nextExpected, setNextExpected] = useState(1);

//Keep track of which numbers have been clicked correctly
const [clicked, setClicked] = useState<number[]>([]);

//Best score
const [bestLevel, setBestLevel] = useState(0);

//Saving score UI
const [submitting, setSubmitting] = useState(false);

//Timer reference so we can clear it safely
//useRef allows us to store the timer without resetting each render (persists despite re-renders) & without causing the component to re-render when it changes
const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

//Best score: load/save localStorage
useEffect(() => {
  const stored = localStorage.getItem('chimp_best_level');
  if (stored !== null) setBestLevel(Number(stored));
}, []);

useEffect(() => {
  localStorage.setItem('chimp_best_level', String(bestLevel));
}, [bestLevel]);

//Cleanup timer if component unmounts
useEffect(() => {
  return () => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
  };
}, []);

//Timer logic
function scheduleHideNumbers() {
  //Clear old timer if it exists
  if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

  //After 5 seconds, switch phase to "hidden"
  hideTimerRef.current = setTimeout(() => {
    setPhase('hidden');
  }, 5000);
}


//Start helper function
function startRun(startLevel: number) {
  if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

  const gs = computeGridSize(startLevel);

  setLevel(startLevel);
  setGridSize(gs);
  setCells(makeCells(startLevel, gs));

  setNextExpected(1);
  setClicked([]);

  setPhase('showing');
  scheduleHideNumbers();
}

//When user clears a level
async function advanceToNextLevel() {
  const clearedLevel = level;

  // Update best if needed
  if (clearedLevel > bestLevel) {
    setBestLevel(clearedLevel);
  }

  //Move to next level
  const nextLevel = clearedLevel + 1;
  startRun(nextLevel);
}

//Handle clicking a cell
async function handleCellClick(cell: Cell) {
  //Only allow clicks after numbers are hidden
  if (phase !== 'hidden') return;

  //Ignore empty cells
  if (cell.value === null) return;

  const valueClicked = cell.value;

  //Wrong number => fail immediately, submit final score
  if (valueClicked !== nextExpected) {
    setPhase('failed');
    
    // Submit score - the last successfully cleared level (level - 1)
    // If player fails on level 4, their score is 3 (or 0 if they never cleared any level)
    const finalScore = Math.max(level - 1, 0);
    if (finalScore > 0) {
      setSubmitting(true);
      const result = await submitScore('chimp', finalScore);
      setSubmitting(false);
      
      if (result.success) {
        console.log('Score submitted successfully!');
      } else {
        console.error('Failed to submit score:', result.error);
      }
    }
    return;
  }

  //Correct number: add to clicked list
  setClicked((prev) => [...prev, valueClicked]);

  //If that was the last number, level is cleared
  if (valueClicked === level) {
    await advanceToNextLevel();
    return;
  }

  //Otherwise expect the next number
  setNextExpected((prev) => prev + 1);
}

//UI helpers
function headerText() {
  if (phase === 'idle') return 'Chimp Test';
  if (phase === 'showing') return `Level ${level} — Memorize`;
  if (phase === 'hidden') return `Level ${level} — Tap ${nextExpected}`;
  return `Game Over — You reached level ${level}`;
}

function subText() {
  if (phase === 'idle')
    return 'Numbers appear, then vanish. Tap squares in ascending order. One mistake ends the run.';
  if (phase === 'showing') return 'You have 5 seconds to memorize…';
  if (phase === 'hidden') return 'Tap in ascending order.';
  return 'One mistake ends the run.';
}

function backgroundClass() {
  if (phase === 'failed') return 'bg-yellow-600';
  if (phase === 'showing') return 'bg-black';
  if (phase === 'hidden') return 'bg-zinc-900';
  return 'bg-black';
}

function shouldShowNumber(value: number | null) {
  if (value === null) return false;

  // During showing: reveal all numbers
  if (phase === 'showing') return true;

  // During hidden: reveal only the ones already clicked correctly
  if (phase === 'hidden') return clicked.includes(value);

  // During failed: reveal everything
  if (phase === 'failed') return true;

  return false;
}

//Cell styling based on phase
function cellClass(cell: Cell) {
  const base =
    'aspect-square rounded-xl flex items-center justify-center font-extrabold select-none transition border border-yellow-400/20 text-yellow-100';

  const isNumberCell = cell.value !== null;
  const isClicked = cell.value !== null && clicked.includes(cell.value);

  if (phase === 'failed') {
    if (!isNumberCell) return base + ' bg-yellow-950/40';
    return base + ' bg-yellow-900/40';
  }

  if (phase === 'showing') {
    return base + (isNumberCell ? ' bg-yellow-900/40 cursor-default' : ' bg-yellow-950/40');
  }

  if (phase === 'hidden') {
    if (!isNumberCell) return base + ' bg-yellow-950/40 cursor-default';
    if (isClicked) return base + ' bg-yellow-900/40 cursor-default';
    return base + ' bg-yellow-950/25 hover:bg-yellow-950/40 cursor-pointer active:scale-[0.98]';
  }

  //idle
  return base + ' bg-yellow-950/25';
}

//Render
return (
  <div className={`min-h-screen ${backgroundClass()} transition-colors duration-300 text-yellow-50 relative`}>
    {/* Back Home Button */}
    <Link
      href="/"
      className="absolute top-4 left-4 px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-50 font-semibold rounded-lg transition z-10 border border-yellow-400/30"
    >
      ← Back Home
    </Link>

    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-black tracking-tight text-yellow-50">{headerText()}</h1>
        <p className="text-yellow-100/80 mt-2">{subText()}</p>

        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <div className="px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/25">
            Best (cleared): <span className="font-bold text-yellow-50">{bestLevel}</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/25">
            Grid: <span className="font-bold text-yellow-50">{gridSize}×{gridSize}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* Start button */}
        {phase === 'idle' && (
          <button
            onClick={() => startRun(4)}
            className="px-8 py-4 bg-yellow-400 text-black font-black text-xl rounded-xl hover:bg-yellow-300 transition"
          >
            Start
          </button>
        )}

        {/* Game Over screen */}
        {phase === 'failed' && (
          <div className="text-center">
            <div className="text-2xl font-bold mb-2 text-yellow-50">
              Score: <span className="text-yellow-50">{Math.max(bestLevel, level - 1)}</span>
            </div>

            {submitting && <p className="text-yellow-100/80 mb-2">Saving score...</p>}
            {!submitting && <p className="text-green-300/80 mb-2">✓ Score saved!</p>}

            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <button
                onClick={() => startRun(4)}
                className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition"
              >
                Restart
              </button>
            </div>

            <p className="text-yellow-100/80 mt-4 text-sm">Tip: clicks only count after numbers disappear.</p>
          </div>
        )}

        {/* Grid */}
        <div className="w-full max-w-xl">
          <div
            className="grid gap-2 sm:gap-3"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => (
              <button
                key={cell.id}
                className={cellClass(cell)}
                onClick={() => handleCellClick(cell)}
                disabled={
                  phase !== 'hidden' ||
                  cell.value === null ||
                  (cell.value !== null && clicked.includes(cell.value))
                }
              >
                {shouldShowNumber(cell.value) ? (
                  <span className="text-2xl sm:text-3xl text-yellow-50">{cell.value}</span>
                ) : (
                  <span className="opacity-0">0</span> // keeps the size consistent
                )}
              </button>
            ))}
          </div>

          {/* Bottom helper text */}
          {phase !== 'idle' && phase !== 'failed' && (
            <div className="mt-5 text-center text-yellow-100/80 text-sm">
              {phase === 'showing' ? 'Memorize…' : `Next: ${nextExpected}`}
            </div>
          )}
        </div>

        {/* Rules */}
        {phase === 'idle' && (
          <div className="text-center text-yellow-100/80 text-sm max-w-xl">
            Rules:
            <ul className="mt-2 space-y-1">
              <li>• A grid displays numbers 1…N in random positions.</li>
              <li>• After 5 seconds, all numbers disappear.</li>
              <li>• Tap squares in the correct ascending order.</li>
              <li>• Numbers increase each level.</li>
              <li>• One mistake ends the run.</li>
              <li>• Score = highest level cleared.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);
}

