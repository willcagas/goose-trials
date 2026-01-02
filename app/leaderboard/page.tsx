import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface Test {
  slug: string;
  name: string;
  description: string | null;
}

async function getTests(): Promise<Test[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('tests')
    .select('slug, name, description')
    .order('name');

  if (error) {
    console.error('Error fetching tests:', error);
    return [];
  }

  return data || [];
}

export default async function LeaderboardPage() {
  const tests = await getTests();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-gray-900">
            Leaderboards
          </h1>
          <p className="text-gray-600 text-lg">
            Compare your scores with players from your university and the world.
          </p>
        </div>

        {/* Tests Grid */}
        {tests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No tests available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => (
              <Link
                key={test.slug}
                href={`/leaderboard/${test.slug}`}
                className="group block"
              >
                <div className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-amber-400 transition-all shadow-sm hover:shadow-md h-full">
                  <h2 className="text-2xl font-bold mb-3 text-gray-900 group-hover:text-amber-400 transition-colors">
                    {test.name}
                  </h2>
                  {test.description && (
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      {test.description}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500 group-hover:text-amber-400 transition-colors">
                      View Leaderboard →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}