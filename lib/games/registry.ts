/**
 * Games Registry
 * 
 * Central registry for all game metadata used by GameShell and GameHelpModal.
 * Each game entry contains title, description, rules, scoring, and controls.
 */

export type GameSlug =
  | 'reaction-time'
  | 'number-memory'
  | 'chimp'
  | 'hanoi'
  | 'pathfinding'
  | 'aim-trainer'
  | 'tetris';

export interface GameMetadata {
  slug: GameSlug;
  title: string;
  description: string; // One-liner
  howToPlay: string[]; // Array of instruction steps
  scoring: string; // Scoring explanation
  lowerIsBetter: boolean;
  unit?: string | null; // Unit for scoring (ms, s, level, etc.)
  controls: {
    keyboard: string[]; // Array of keyboard control descriptions
    mobile: string[]; // Array of mobile control descriptions
  };
}

export const GAMES_REGISTRY: Record<GameSlug, GameMetadata> = {
  'reaction-time': {
    slug: 'reaction-time',
    title: 'Reaction Time',
    description: 'Test your reflexes with split-second timing challenges.',
    howToPlay: [
      'Click "Start Game" to begin',
      'Wait for the screen to turn green',
      'Click as fast as you can when you see green',
      'Don\'t click too early or you\'ll fail!',
      'Your reaction time in milliseconds is your score'
    ],
    scoring: 'Your score is your reaction time in milliseconds. Lower is better. The best players react in under 200ms.',
    lowerIsBetter: true,
    unit: 'ms',
    controls: {
      keyboard: [
        'Space: Start game / Restart',
        'Click: React when screen turns green',
        'R: Restart current attempt',
        'Esc: Return to menu'
      ],
      mobile: [
        'Tap "Start Game" to begin',
        'Tap the screen when it turns green',
        'Tap and hold "Restart" to try again'
      ]
    }
  },
  'number-memory': {
    slug: 'number-memory',
    title: 'Number Memory',
    description: 'Remember and recall increasingly long number sequences.',
    howToPlay: [
      'A number will appear for 2-4 seconds',
      'Memorize the number exactly as shown',
      'Type the number back when prompted (including leading zeros)',
      'Each correct answer adds one more digit',
      'One mistake ends the game'
    ],
    scoring: 'Your score is the highest number of digits you correctly recalled. Each level adds one digit.',
    lowerIsBetter: false,
    unit: 'digits',
    controls: {
      keyboard: [
        'Space: Start game / Restart',
        'Type: Enter the number you memorized',
        'Enter: Submit your answer',
        'R: Restart',
        'Esc: Return to menu'
      ],
      mobile: [
        'Tap "Start" to begin',
        'Type the number using the on-screen keyboard',
        'Tap "Submit" or press Enter'
      ]
    }
  },
  'chimp': {
    slug: 'chimp',
    title: 'Chimp Test',
    description: 'Master pattern recognition and working memory.',
    howToPlay: [
      'A grid displays numbers 1 through N in random positions',
      'You have 5 seconds to memorize their positions',
      'After 5 seconds, all numbers disappear',
      'Tap squares in ascending order (1, 2, 3, ...)',
      'Clicks only count after numbers disappear',
      'Each level adds more numbers',
      'One mistake ends the run'
    ],
    scoring: 'Your score is the highest level you cleared. Each level adds one more number to remember.',
    lowerIsBetter: false,
    unit: 'level',
    controls: {
      keyboard: [
        'Space: Start game / Restart',
        'Click: Select squares in ascending order',
        'R: Restart',
        'Esc: Return to menu'
      ],
      mobile: [
        'Tap "Start" to begin',
        'Tap squares in the correct order after numbers disappear',
        'Tap squares in ascending order (1, 2, 3, ...)'
      ]
    }
  },
  'hanoi': {
    slug: 'hanoi',
    title: 'Tower of Hanoi',
    description: 'Solve the classic puzzle with optimal moves.',
    howToPlay: [
      'Move all disks from rod A to rod C',
      'Click a rod to select the top disk',
      'Click another rod to move the disk there',
      'You can only move one disk at a time',
      'Never place a larger disk on a smaller one',
      'Complete in the fewest moves possible'
    ],
    scoring: 'Your score = Time + (1200ms × extra moves). Lower is better. Optimal moves for 5 disks is 31.',
    lowerIsBetter: true,
    unit: 's',
    controls: {
      keyboard: [
        '1/A/8: Select rod A',
        '2/S/9: Select rod B',
        '3/D/0: Select rod C',
        'Esc: Return to menu',
        'R: Restart',
        'Space: Start game'
      ],
      mobile: [
        'Tap a rod to select the top disk',
        'Tap another rod to move the disk',
        'Tap "Restart" to start over'
      ]
    }
  },
  'pathfinding': {
    slug: 'pathfinding',
    title: 'Pathfinding',
    description: 'Navigate mazes and find the shortest route.',
    howToPlay: [
      'A maze appears and stays visible until you start moving',
      'Navigate from the start (green) to the end (red)',
      'Use your mouse to drag a path or tap squares',
      'You are allowed up to one mistake per round',
      'After each successful attempt, the maze gets bigger',
      'The test ends when you fail to navigate the maze'
    ],
    scoring: 'Your score is the number of rounds you completed. Each round adds one square to the maze size.',
    lowerIsBetter: false,
    unit: 'rounds',
    controls: {
      keyboard: [
        'Space: Start game / Restart',
        'Mouse: Drag to draw path',
        'Arrow keys: Navigate (if supported)',
        'R: Restart',
        'Esc: Return to menu'
      ],
      mobile: [
        'Tap "Start" to begin',
        'Tap squares to build your path',
        'Drag your finger to draw a continuous path',
        'Reach the red square to complete the round'
      ]
    }
  },
  'aim-trainer': {
    slug: 'aim-trainer',
    title: 'Aim Trainer',
    description: 'Hit targets as quick as possible to test accuracy.',
    howToPlay: [
      'Targets appear randomly on the screen',
      'Click or tap targets as fast as you can',
      'You have a limited time to hit as many as possible',
      'Each hit counts toward your score',
      'Misses reduce your accuracy percentage'
    ],
    scoring: 'Your score is the number of targets you hit. Accuracy percentage shows hits vs misses.',
    lowerIsBetter: false,
    unit: 'hits',
    controls: {
      keyboard: [
        'Space: Start run / Restart',
        'Mouse: Click targets',
        'R: Restart',
        'Esc: Return to menu'
      ],
      mobile: [
        'Tap "Start Run" to begin',
        'Tap targets as they appear',
        'Hit as many as you can before time runs out'
      ]
    }
  },
  'tetris': {
    slug: 'tetris',
    title: 'Tetris',
    description: 'Clear 30 lines as fast as possible.',
    howToPlay: [
      'Tetromino pieces fall from the top of the board',
      'Use arrow keys to move and rotate pieces',
      'Complete horizontal lines to clear them',
      'Clear 30 lines total to complete the game',
      'Your time is your score - faster is better'
    ],
    scoring: 'Your score is the time (in seconds) it took to clear 30 lines. Lower time is better.',
    lowerIsBetter: true,
    unit: 's',
    controls: {
      keyboard: [
        'Space: Start game / Restart',
        'Left/Right Arrow: Move piece sideways',
        'Up Arrow: Rotate piece',
        'Down Arrow: Soft drop (move faster)',
        'R: Restart',
        'Esc: Return to menu'
      ],
      mobile: [
        'Tap "Start Game" to begin',
        'Swipe left/right to move piece',
        'Tap to rotate piece',
        'Swipe down for soft drop'
      ]
    }
  }
};

/**
 * Get metadata for a specific game
 */
export function getGameMetadata(slug: GameSlug): GameMetadata {
  return GAMES_REGISTRY[slug];
}

/**
 * Get all game slugs
 */
export function getAllGameSlugs(): GameSlug[] {
  return Object.keys(GAMES_REGISTRY) as GameSlug[];
}

