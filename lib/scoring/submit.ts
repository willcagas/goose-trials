import {getOrCreateGuestId} from '@/lib/guest/guestId'

//restrictions for score submission data
export interface SubmitScoreParameters
{
    test_name: string;
    score: number;
    additionalData?: Record<string, unknown>;
}

//takes in one parameter (a SubmitScoreParameters object)
export async function submitScore(parameters: SubmitScoreParameters)
{
    const guestId = getOrCreateGuestId();
    const response = await fetch('/api/submit-score',
    {
        method: 'POST',
        headers:{
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test_name: parameters.test_name,
          score: parameters.score,
          additionalData: parameters.additionalData,
          guest_id: guestId
        })
    });

    if (!response.ok)
    {
        throw Error('Failed to submit score');
    }
    return await response.json();
}