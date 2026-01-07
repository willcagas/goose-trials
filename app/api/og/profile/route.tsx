import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const username = searchParams.get('username') || 'Player';
    const avatar = searchParams.get('avatar') || 'https://goosetrials.com/cockygoose.png';
    const university = searchParams.get('university');
    const rank = searchParams.get('rank');

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
          }}
        >
          {/* Ambient light effect */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              height: '600px',
              background: 'radial-gradient(ellipse at center top, rgba(251, 191, 36, 0.25), transparent 70%)',
              display: 'flex',
            }}
          />

          {/* Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '80px',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Avatar */}
            <img
              src={avatar}
              alt="Profile"
              width={160}
              height={160}
              style={{
                borderRadius: '50%',
                border: '5px solid rgba(251, 191, 36, 0.4)',
                marginBottom: '40px',
              }}
            />

            {/* Username */}
            <div
              style={{
                fontSize: 56,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '32px',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                maxWidth: '850px',
                wordBreak: 'break-word',
                lineHeight: 1.2,
              }}
            >
              {username}
            </div>

            {/* University */}
            {university && (
              <div
                style={{
                  fontSize: 28,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '30px',
                  textAlign: 'center',
                }}
              >
                {university}
              </div>
            )}

            {/* Rank Badge */}
            {rank && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 28px',
                  backgroundColor: 'rgba(251, 191, 36, 0.12)',
                  borderRadius: '999px',
                  border: '2px solid rgba(251, 191, 36, 0.25)',
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                >
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#fbbf24',
                  }}
                >
                  #{rank}
                </span>
              </div>
            )}
          </div>

          {/* Footer branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '60px',
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
  } catch (e: any) {
    console.log(`Failed to generate OG image: ${e.message}`);
    return new Response(`Failed to generate image`, {
      status: 500,
    });
  }
}
