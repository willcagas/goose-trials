'use client';

import type { PathSegment, WallSegment } from './types';

interface PathfindingMazeOverlaysProps {
  mazeSize: number;
  showMaze: boolean;
  showPath: boolean;
  wallColor: string;
  wallSegments: WallSegment[];
  pathSegments: PathSegment[];
}

export default function PathfindingMazeOverlays({
  mazeSize,
  showMaze,
  showPath,
  wallColor,
  wallSegments,
  pathSegments,
}: PathfindingMazeOverlaysProps) {
  return (
    <>
      {showMaze && wallSegments.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none z-20"
          viewBox={`0 0 ${mazeSize} ${mazeSize}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          {wallSegments.map((segment, index) => (
            <line
              key={`wall-${index}`}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={wallColor}
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="square"
            />
          ))}
        </svg>
      )}
      {showPath && pathSegments.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none z-5"
          viewBox={`0 0 ${mazeSize} ${mazeSize}`}
          preserveAspectRatio="none"
        >
          {pathSegments.map((segment, index) => (
            <line
              key={`${segment.from.row}-${segment.from.col}-${index}`}
              x1={segment.from.col + 0.5}
              y1={segment.from.row + 0.5}
              x2={segment.to.col + 0.5}
              y2={segment.to.row + 0.5}
              stroke="rgba(16, 185, 129, 1)"
              strokeWidth={0.26}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
    </>
  );
}
