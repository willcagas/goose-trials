export type Direction = 'top' | 'right' | 'bottom' | 'left';
export type GamePhase = 'idle' | 'memorize' | 'input' | 'failed';

export interface Cell {
  row: number;
  col: number;
  walls: Record<Direction, boolean>;
}

export interface Position {
  row: number;
  col: number;
}

export interface PathSegment {
  from: Position;
  to: Position;
}

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
