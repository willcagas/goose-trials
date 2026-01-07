import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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
        {/* Top ceiling light effect */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(to right, transparent, rgba(251, 191, 36, 0.8), transparent)',
            filter: 'blur(2px)',
          }}
        />

        {/* Light cone spreading downward */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at center top, rgba(251, 191, 36, 0.15), transparent 60%)',
          }}
        />

        {/* Main Content */}
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
          {/* Main Heading */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '50px',
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '16px',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                display: 'flex',
              }}
            >
              Think You're Smart?
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: '#fbbf24',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                display: 'flex',
              }}
            >
              Prove It.
            </div>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              color: 'rgba(255, 255, 255, 0.7)',
              textAlign: 'center',
              marginBottom: '16px',
              fontWeight: '600',
              display: 'flex',
            }}
          >
            Battle your campus. Climb the ranks.
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255, 255, 255, 0.4)',
              textAlign: 'center',
              fontWeight: '500',
              display: 'flex',
            }}
          >
            Six quick games. One leaderboard.
          </div>
        </div>

        {/* Branding - Bottom Center */}
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
              fontSize: 36,
              fontWeight: 'bold',
              color: 'white',
              display: 'flex',
            }}
          >
            GOOSE
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color: '#fbbf24',
              display: 'flex',
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
}
