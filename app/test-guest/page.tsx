'use client';

import { useState } from 'react';
import { getOrCreateGuestId, getGuestId, clearGuestId } from '@/lib/guest/guestId';
import { createClient } from '@/lib/supabase/client';

export default function TestGuestPage() {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');

  const handleGetGuestId = () => {
    const id = getOrCreateGuestId();
    setGuestId(id);
    setResult(`Guest ID created/retrieved: ${id}`);
  };

  const handleCheckGuestId = () => {
    const id = getGuestId();
    setGuestId(id);
    setResult(id ? `Existing Guest ID: ${id}` : 'No guest ID found');
  };

  const handleClearGuestId = () => {
    clearGuestId();
    setGuestId(null);
    setResult('Guest ID cleared from localStorage');
  };

  const handleSubmitTestScore = async () => {
    if (!guestId) {
      setResult('Please create a guest ID first');
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('scores')
        .insert([
          {
            test_slug: 'reaction-speed',
            score_value: Math.floor(Math.random() * 500) + 200, // Random score 200-700ms
            guest_id: guestId,
            user_id: null
          }
        ])
        .select();

      if (error) {
        setResult(`Error: ${error.message}`);
      } else {
        setResult(`✅ Score submitted successfully! Data: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleViewGuestScores = async () => {
    if (!guestId) {
      setResult('Please create a guest ID first');
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('guest_id', guestId);

      if (error) {
        setResult(`Error: ${error.message}`);
      } else {
        setResult(`Scores for guest ${guestId}:\n${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Guest ID & Score Testing</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Current Guest ID</h2>
          <div className="p-4 bg-gray-100 rounded font-mono text-sm mb-4">
            {guestId || 'No guest ID'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleGetGuestId}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Get/Create Guest ID
            </button>
            <button
              onClick={handleCheckGuestId}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Check Existing ID
            </button>
            <button
              onClick={handleSubmitTestScore}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Submit Test Score
            </button>
            <button
              onClick={handleViewGuestScores}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              View Guest Scores
            </button>
            <button
              onClick={handleClearGuestId}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 col-span-2"
            >
              Clear Guest ID
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Result</h2>
          <pre className="p-4 bg-gray-100 rounded text-sm overflow-auto whitespace-pre-wrap">
            {result || 'Click a button to test...'}
          </pre>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded">
          <h3 className="font-bold mb-2">How to test:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click "Get/Create Guest ID" to generate a guest ID</li>
            <li>Click "Submit Test Score" to add a random score to the database</li>
            <li>Click "View Guest Scores" to see all scores for this guest</li>
            <li>Check Supabase dashboard to verify the data</li>
            <li>Click "Clear Guest ID" to test creating a new guest</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
