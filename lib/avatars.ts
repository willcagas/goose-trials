// Available goose avatars for user profiles
export const GOOSE_AVATARS = [
  {
    id: 'cocky',
    name: 'Cocky Goose',
    url: '/cockygoose.png',
  },
  {
    id: 'detective',
    name: 'Detective Goose',
    url: '/detectivegoose.png',
  },
  {
    id: 'evil',
    name: 'Evil Goose',
    url: '/evilgoose.png',
  },
  {
    id: 'knight',
    name: 'Knight Goose',
    url: '/knightgoose.png',
  },
  {
    id: 'monocle',
    name: 'Monocle Goose',
    url: '/monoclegoose.png',
  },
  {
    id: 'screaming',
    name: 'Screaming Goose',
    url: '/screaminggoose.png',
  },
  {
    id: 'sleep',
    name: 'Sleep Goose',
    url: '/sleepgoose.png',
  },
  {
    id: 'unhinged',
    name: 'Unhinged Goose',
    url: '/unhingedgoose.png',
  },
] as const;

export type GooseAvatarId = typeof GOOSE_AVATARS[number]['id'];

export function getAvatarUrl(avatarId: string | null): string | null {
  if (!avatarId) return null;
  const avatar = GOOSE_AVATARS.find(a => a.id === avatarId);
  return avatar?.url || null;
}

export function isValidAvatarId(avatarId: string): avatarId is GooseAvatarId {
  return GOOSE_AVATARS.some(a => a.id === avatarId);
}
