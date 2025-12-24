'use client';
import {useState} from 'react';
import LoginModal from '@/components/LoginModal';
import {useSession} from '@/app/providers/SessionContext';

export default function HomePage()
{
  const [showLogin, setShowLogin] = useState(false);
  //get session data
  const {user, loading, signOut} = useSession();
  if (loading)
  {
    return <div style={{padding: '2rem'}}> Loading... </div>;
  }

  return(
    <div style={{padding: '2rem'}}>
      <h1>Welcome to Goose Trials</h1>
      <p>Test your cognitive skills!</p>
    {/* 2 different versions of content: one for logged in user, other for guest*/}
    {user ? (
      <div>
      <p style={{color: '#FFD700'}}> Logged in as: {user.email} </p>
      <button onClick={signOut} style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginRight: '1rem',
            }}>
            Sign Out
          </button>
        </div>
      ) : (
        <button onClick={() => setShowLogin(true)}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#FFD700',
          color: '#000',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: 'pointer',
        }}>
          Sign In to Leaderboard
        </button>
      )}

      {/* Login modal*/}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)}/>
      </div>
    )
  }