'use client';

import { useEffect, useState } from 'react';

// NEW: This interface now represents a point on the histogram
interface DistributionPoint {
  score: number;
  frequency: number;
}

// NEW: Data structure from the API
interface DistributionData {
  distribution: DistributionPoint[];
  userPercentile: number | null;
  userScore: number | null;
  totalScores: number;
  mean: number;
  stdDev: number;
  maxLeaderboardScore: number | null;
}

interface DistributionGraphProps {
  testSlug: string;
  userId: string | null;
  username: string | null;
  unit: string | null;
  lowerIsBetter?: boolean;
}

// The component is mentally renamed to DistributionGraph
export default function PercentileGraph({
  testSlug,
  userId,
  username,
  unit,
}: DistributionGraphProps) {
  const [data, setData] = useState<DistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ test_slug: testSlug });
        if (userId) {
          params.append('user_id', userId);
        }

        const response = await fetch(`/api/percentile-stats?${params.toString()}`);
        if (response.ok) {
          const { data: responseData } = await response.json();
          setData(responseData);
        }
      } catch (error) {
        console.error('Error fetching distribution data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [testSlug, userId]);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!data || data.distribution.length < 2) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">Not enough data to show distribution</p>
      </div>
    );
  }

  const { distribution, userPercentile, userScore, totalScores, mean, stdDev } = data;

  // SVG dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 40, bottom: 50, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // NEW: Find min/max scores and max frequency for scaling
  const scores = distribution.map(d => d.score);
  const frequencies = distribution.map(d => d.frequency);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const maxFrequency = Math.max(...frequencies);
  const scoreRange = maxScore - minScore;

  // Handle edge case where maxFrequency is 0 or invalid
  if (maxFrequency <= 0 || !isFinite(maxFrequency)) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">Not enough data to show distribution</p>
      </div>
    );
  }

  // NEW: Create smooth curve path for the frequency distribution (already smooth from API)
  const createPath = () => {
    const points = distribution.map(d => ({
      x: padding.left + ((d.score - minScore) / scoreRange) * chartWidth,
      y: padding.top + chartHeight - (d.frequency / maxFrequency) * chartHeight,
    }));

    // Create a smooth path using the points (already smooth from normal distribution)
    let path = `M ${points[0].x} ${padding.top + chartHeight}`; // Start from bottom-left
    path += ` L ${points[0].x} ${points[0].y}`; // Go to first point

    // Use line segments since the curve is already smooth from the normal distribution
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    path += ` L ${points[points.length - 1].x} ${padding.top + chartHeight}`; // Line to bottom-right
    path += ' Z'; // Close path

    return { path, points };
  };

  const { path, points } = createPath();

  // NEW: Calculate user's position on the graph (both X and Y)
  let userX: number | null = null;
  let userY: number | null = null;
  if (userScore !== null && scoreRange > 0) {
    userX = padding.left + ((userScore - minScore) / scoreRange) * chartWidth;

    // Find the Y position by interpolating between the closest distribution points
    const closestPointIndex = distribution.findIndex((d, i) => {
      if (i === distribution.length - 1) return true;
      return userScore >= d.score && userScore <= distribution[i + 1].score;
    });

    if (closestPointIndex !== -1 && points[closestPointIndex]) {
      // Interpolate Y value
      if (closestPointIndex < points.length - 1) {
        const p1 = points[closestPointIndex];
        const p2 = points[closestPointIndex + 1];
        const d1 = distribution[closestPointIndex];
        const d2 = distribution[closestPointIndex + 1];
        const t = (userScore - d1.score) / (d2.score - d1.score);
        userY = p1.y + t * (p2.y - p1.y);
      } else {
        userY = points[closestPointIndex].y;
      }
    }
  }

  // Format score for display
  const formatScore = (score: number): string => {
    const roundedScore = Math.round(score);
    if (unit === 'ms') return `${roundedScore} ms`;
    if (unit === 's') return `${roundedScore} s`;
    if (unit === 'level') return `${roundedScore}`;
    return unit ? `${roundedScore} ${unit}` : `${roundedScore}`;
  };
  
  // NEW: Generate Y-axis ticks for frequency
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => {
    return Math.round((maxFrequency / (yTicks - 1)) * i);
  });
  
  // NEW: Generate X-axis ticks for scores
  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks }, (_, i) => {
    return minScore + (scoreRange / (xTicks - 1)) * i;
  });

  return (
    <div className="relative w-full">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-700 mb-1">Score Distribution</h4>
        <p className="text-xs text-gray-500">
          Based on {totalScores.toLocaleString()} scores
          {userPercentile !== null && (
            <span className="ml-2 text-amber-400 font-semibold">
              • {username ? `${username} is` : 'You are'} in the {userPercentile.toFixed(0)}th percentile
            </span>
          )}
        </p>
      </div>

      <div className="relative bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
        >
          {/* Grid lines */}
          {yTickValues.map((value, i) => {
            const y = padding.top + chartHeight - (value / maxFrequency) * chartHeight;
            return (
              <line
                key={i}
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Area fill */}
          <path d={path} fill="url(#blueGradient)" opacity="0.2" />

          {/* Main curve */}
          <path
            d={path.substring(0, path.length - 2)} // Remove closing part for line
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <defs>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis */}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#9ca3af" strokeWidth="2" />

          {/* X-axis */}
          <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#9ca3af" strokeWidth="2" />

          {/* Y-axis labels */}
          {yTickValues.map((value, i) => {
             const y = padding.top + chartHeight - (value / maxFrequency) * chartHeight;
            return (
              <text key={i} x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                {value}
              </text>
            );
          })}

          {/* X-axis labels */}
          {xTickValues.map((value) => {
            const x = padding.left + ((value - minScore) / scoreRange) * chartWidth;
            return (
              <text key={value} x={x} y={padding.top + chartHeight + 20} textAnchor="middle" fontSize="11" fill="#6b7280">
                {formatScore(value)}
              </text>
            );
          })}
          
          {/* X-axis label */}
          <text x={padding.left + chartWidth / 2} y={padding.top + chartHeight + 40} textAnchor="middle" fontSize="12" fill="#4b5563" fontWeight="600">
            Score
          </text>

          {/* Y-axis label */}
          <text x={-(padding.top + chartHeight / 2)} y={20} textAnchor="middle" fontSize="12" fill="#4b5563" fontWeight="600" transform="rotate(-90)">
            Number of Players
          </text>

          {/* User's position marker - Yellow dot on the curve */}
          {userX !== null && userY !== null && userScore !== null && (
            <>
              {/* Vertical dashed line */}
              <line
                x1={userX}
                y1={padding.top}
                x2={userX}
                y2={padding.top + chartHeight}
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.5"
              />
              {/* Interactive yellow dot on the curve */}
              <g
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                style={{ cursor: 'pointer' }}
              >
                {/* Yellow dot */}
                <circle
                  cx={userX}
                  cy={userY}
                  r="8"
                  fill="#fbbf24"
                  stroke="#fff"
                  strokeWidth="2"
                />
                {/* Outer glow effect */}
                <circle
                  cx={userX}
                  cy={userY}
                  r="12"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  opacity="0.3"
                />
                {/* Invisible larger hitbox for easier hovering */}
                <circle
                  cx={userX}
                  cy={userY}
                  r="20"
                  fill="transparent"
                />
              </g>
              <text x={userX} y={padding.top - 10} textAnchor="middle" fontSize="12" fill="#fbbf24" fontWeight="bold">
                {username ? `${username}'s Score` : 'Your Score'}
              </text>

              {/* Tooltip */}
              {showTooltip && (
                <g>
                  <rect
                    x={userX - 80}
                    y={userY - 60}
                    width="160"
                    height="50"
                    rx="6"
                    fill="#1f2937"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    opacity="0.95"
                  />
                  <text
                    x={userX}
                    y={userY - 38}
                    textAnchor="middle"
                    fontSize="13"
                    fill="#fbbf24"
                    fontWeight="bold"
                  >
                    {formatScore(userScore)}
                  </text>
                  <text
                    x={userX}
                    y={userY - 22}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#d1d5db"
                  >
                    {userPercentile !== null ? `${userPercentile.toFixed(1)}th percentile` : 'N/A'}
                  </text>
                </g>
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
