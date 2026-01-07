import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const gameIcons: Record<string, string> = {
  'reaction-time': 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  'number-memory': 'M3 3h18v18H3z M7 7h2v10H7z M11 7h2v10h-2z M15 7h2v10h-2z',
  'chimp': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  'aim-trainer': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  'pathfinding': 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  'tetris': 'M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6h18z M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6H3z',
  'hanoi': 'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const gameName = searchParams.get('name') || 'Game';
    const gameSlug = searchParams.get('slug') || 'reaction-time';
    const description = searchParams.get('desc') || 'Test your skills';
    const iconPath = gameIcons[gameSlug] || gameIcons['reaction-time'];

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
            position: 'relative',
            padding: '80px',
          }}
        >
          {/* Light effect */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(ellipse 600px 500px at center top, rgba(251, 191, 36, 0.15), transparent 60%)',
              display: 'flex',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Game Icon */}
            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '28px',
                backgroundColor: 'rgba(251, 191, 36, 0.12)',
                border: '3px solid rgba(251, 191, 36, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '50px',
              }}
            >
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={iconPath} />
              </svg>
            </div>

            {/* Game Name */}
            <div
              style={{
                fontSize: 64,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '24px',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
              }}
            >
              {gameName}
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: 28,
                color: 'rgba(255, 255, 255, 0.6)',
                textAlign: 'center',
                maxWidth: '800px',
              }}
            >
              {description}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginTop: '60px',
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              GOOSE
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: '#fbbf24',
              }}
            >
              TRIALS
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    console.log(`Failed to generate game OG image: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return new Response(`Failed to generate image`, {
      status: 500,
    });
  }
}
