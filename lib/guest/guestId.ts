const GUEST_ID_KEY = 'goose_trials_guest_id';

export function generateGuestId(): string
{
    return crypto.randomUUID();
}

//if key doesn't exist: generate & set the key, then return it
//else, guest key already exists; return it regularly
export function getOrCreateGuestId(): string
{
    if (typeof window === 'undefined') {
        return ''; // Server-side, no localStorage
    }
    if (localStorage.getItem(GUEST_ID_KEY) == null)
    {
        localStorage.setItem(GUEST_ID_KEY, generateGuestId());
    }
    //exclamation point tells typescript that this won't ever be null
    return localStorage.getItem(GUEST_ID_KEY)!;
}

//solely check if guest key exists
export function getGuestId(): string | null
{
    if (typeof window === 'undefined') {
        return null; // Server-side, no localStorage
    }
    return localStorage.getItem(GUEST_ID_KEY);
}
//to clear guest ID if user logs in
export function clearGuestId(): void
{
    if (typeof window === 'undefined') {
        return; // Server-side, no localStorage
    }
    localStorage.removeItem(GUEST_ID_KEY);
}
