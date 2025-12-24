import {getGuestId, clearGuestId} from './guestId';

export async function migrateGuestScores(): Promise<boolean>
{
    const guestId = getGuestId();

    if (!guestId)
    {
        console.log('No guest scores to migrate');
        return false;
    }

    try{
        const response = await fetch('/api/migrate-guest',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                guest_id:guestId,
            }),
        })

        if (!response.ok)
        {
            throw Error('Migration failed');
        }

        const data = await response.json();

        if (data.success)
        {
            clearGuestId();
            console.log('Guest scores migrated successfully');
            return true;
        }
        return false;
    }catch (error){
        return false;
    }
}