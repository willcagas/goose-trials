'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';

interface LoginModalProps
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginModal({isOpen, onClose}: LoginModalProps)
{
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (event: React.FormEvent) =>
    {
        //prevents page from refreshing
        event.preventDefault();

        setLoading(true);
        setError('');
        setSuccess(false);

        if(!email.endsWith('@uwaterloo.ca'))
        {
            setError('Must use a @uwaterloo.ca email');
            setLoading(false);
            return;
        }

        try{
            const supabase = createClient();
            //destructuring; allows extraction of only error component of return from supabase call
            const {error} = await supabase.auth.signInWithOtp({
                //signInWithOtp sends magic link (one time password)
                email: email,
                options:
                {
                    //sends user back to the page they were currently on when tried to login (Ex: game page)
                    emailRedirectTo: window.location.origin
                }
            });

            if (error)
            {
                throw error;
            }
            
            setSuccess(true);
            setEmail('');
        }
        catch (err) 
        {
            setError('Failed to send magic link. Please try again');
        }
        finally{
            setLoading(false);
        }
    }

    
    if (!isOpen)
    {
        return null;
    }

    return (
    // Dark overlay covering entire screen
    <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000, // Appears above everything
    }}>
        {/* Black modal box with gold accents */}
        <div style={{
        backgroundColor: '#1a1a1a',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        border: '2px solid #FFD700' //Gold border
        }}>
        {/* Header with title and close button */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
        }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#FFD700'}}>
            Sign in to Goose Trials
            </h2>
            <button
            onClick={onClose}
            style={{
                border: 'none',
                background: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#FFD700',
            }}
            >
            ×
            </button>
        </div>

        {/* Subtitle */}
        <p style={{
            color: '#cccccc',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
        }}>
            Enter your UWaterloo email to appear on the leaderboard
        </p>

        {/* Form - triggered when user clicks Submit (handleSubmit takes action) */}
        <form onSubmit={handleSubmit}>
            <input
            type="email"
            placeholder="your.email@uwaterloo.ca"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '1px solid #FFD700',
                borderRadius: '4px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                backgroundColor: '#2a2a2a',
                color: '#ffffff'
            }}
            />

            <button
            type="submit"
            disabled={loading}
            style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: loading ? '#555555' : '#FFD700',
                color: loading ? '#999999' : '#000000',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
            }}
            >
            {/* Used ternary operator because JSX doesn't allow if statements */}
            {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
        </form>

        {/* && means only execute if statement is true */}
        {error && (
            <p style={{
            color: '#ff6b6b',
            marginTop: '1rem',
            marginBottom: 0,
            fontSize: '0.9rem',
            }}>
            ⚠️ {error}
            </p>
        )}

        {success && (
            <div>
            <p style={{
            color: '#FFD700',
            marginTop: '1rem',
            marginBottom: 0,
            fontSize: '0.9rem',
            }}>
            ✓ Check your email for the magic link!
            </p>
            <p style={{
            color: '#cccccc',
            marginTop: '0.5rem',
            marginBottom: 0,
            fontSize: '0.8rem',
            }}>
            Your guest scores will be transferred to your account automatically.
            </p>
            </div>
        )}
        </div>
    </div>
    );
}
