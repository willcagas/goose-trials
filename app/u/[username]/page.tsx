import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProfileByUsername } from '@/lib/db/profiles';
import { getUserHighlightsWithRanks } from '@/lib/db/user-highlights';
import { createClient } from '@/lib/supabase/server';
import PublicProfileClient from '@/components/PublicProfileClient';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ username: string }>;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;

  const profile = await getProfileByUsername(username);

  if (!profile) {
    return {
      title: 'Profile Not Found - Goose Trials',
      description: 'This user profile does not exist.',
    };
  }

  const displayName = profile.username || `User_${profile.id.slice(0, 8)}`;

  // Build OG image URL with profile data
  const ogImageParams = new URLSearchParams({
    username: displayName,
    ...(profile.avatar_url && { avatar: profile.avatar_url }),
  });

  const ogImageUrl = `/api/og/profile?${ogImageParams.toString()}`;

  return {
    title: `${displayName} - Goose Trials`,
    description: `View ${displayName}'s best scores and compete on Goose Trials!`,
    openGraph: {
      title: `${displayName} - Goose Trials`,
      description: `View ${displayName}'s best scores and compete on Goose Trials!`,
      type: 'profile',
      url: `/u/${username}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${displayName}'s profile`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} - Goose Trials`,
      description: `View ${displayName}'s best scores and compete!`,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  
  // Fetch profile by username
  const profile = await getProfileByUsername(username);
  
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Profile Not Found</h1>
            <p className="text-white/60 mb-8">
              This user doesn&apos;t exist or hasn&apos;t created a profile yet.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-amber-400 text-gray-900 font-bold uppercase tracking-wide rounded-full hover:bg-amber-300 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Fetch university info if user has one
  let universityInfo = null;
  if (profile.university_id) {
    const supabase = await createClient();
    const { data: university, error: uniError } = await supabase
      .from('universities')
      .select('id, name, country, alpha_two_code')
      .eq('id', profile.university_id)
      .single();

    if (!uniError && university) {
      universityInfo = university;
    }
  }

  // Fetch user highlights with scoped ranks (country and university)
  const highlights = await getUserHighlightsWithRanks(
    profile.id, 
    20,
    profile.university_id,
    universityInfo?.alpha_two_code
  );

  return (
    <PublicProfileClient
      profile={{
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        university_id: profile.university_id,
      }}
      highlights={highlights}
      universityInfo={universityInfo}
    />
  );
}
