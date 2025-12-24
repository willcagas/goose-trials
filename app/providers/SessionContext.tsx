'use client';
import {createContext, useContext, useEffect, useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import type {User} from '@supabase/supabase-js';
import {migrateGuestScores} from '@/lib/guest/migrate';

interface SessionContextType
{
    user: User | null;
    loading: boolean;
    signOut:() => Promise<void>;
}

//can be type SessionContextType or undefined (if not existing yet)
//default value is undefined
const SessionContext = createContext<SessionContextType | undefined>(undefined);

//destructuring to extract children
//children are of type React.ReactNode
export function SessionProvider({children}: {children: React.ReactNode})
{
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasAttemptedMigration, setHasAttemptedMigration] = useState(false);

    //useEffect only runs once React component renders
    useEffect(() => {
        const supabase = createClient();
        //checking if there's already a logged in session
        const checkSession = async () =>
        {
            try
            {
                //get current session from Supabase
                const {data: {session}} = await supabase.auth.getSession();

                let result;
                if (session !== null && session !== undefined) {
                    result = session.user;
                } else {
                    result = undefined;
                }
                if (result === null || result === undefined)
                {
                    result = null;
                }
                setUser(result);
            } catch (error){
                setUser(null);
            }
            //done checking, stop showing loading state
            setLoading(false);

        }

        checkSession();

        const{data: {subscription}} = supabase.auth.onAuthStateChange(async (event, session) => {
            let result;
            if (session !== null && session !== undefined) {
                result = session.user;
            } else {
                result = undefined;
            }
            if (result === null || result === undefined)
            {
                result = null;
            }
            setUser(result);

            if (event === 'SIGNED_IN' && session?.user && !hasAttemptedMigration)
            {
                console.log('User signed in, attempting migration');
                const migrated = await migrateGuestScores();
                if (migrated)
                {
                    console.log('Guest scores successfully migrated to account');
                }
                setHasAttemptedMigration(true);
            }
            if (event === 'SIGNED_OUT')
            {
                setHasAttemptedMigration(false);
            }
        })

        return () => 
        {
            subscription.unsubscribe();
        }
    }, [])

    const signOut = async () =>
    {
        const supabase = createClient();
        await supabase.auth.signOut();
        setUser(null);
        setHasAttemptedMigration(false);
    }
    //function provides user, loading state, and signOut function to all children
    return(
        <SessionContext.Provider value = {{user, loading, signOut}}>
            {children}
        </SessionContext.Provider>
    )
}

//custom hook to use session data in any component
export function useSession()
{
    const context = useContext(SessionContext);

    if (context === undefined)
    {
        throw Error('useSession must be used within SessionProvider');
    }
    return context;
}