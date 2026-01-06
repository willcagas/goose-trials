import { MetadataRoute } from 'next';
import { getAllGameSlugs } from '@/lib/games/registry';

const URL = 'https://goosetrials.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const games = getAllGameSlugs();

  // Game pages
  const gameUrls = games.map(game => ({
    url: `${URL}/games/${game}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8
  }));

  // Leaderboard pages
  const leaderboardUrls = games.map(game => ({
    url: `${URL}/leaderboard/${game}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7
  }));

  // Static pages
  const staticUrls = [
    {
      url: `${URL}/profile`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6
    },
    {
      url: `${URL}/share`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5
    },
    {
      url: `${URL}/status`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.4
    }
  ];

  return [
    {
      url: URL,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1.0
    },
    ...staticUrls,
    ...gameUrls,
    ...leaderboardUrls
  ];
}
