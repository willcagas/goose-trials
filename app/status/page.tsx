'use client';

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="/goosetrialspfp-removebg-preview.png" 
              alt="Goose Trials Logo"
              className="w-32 h-32 md:w-40 md:h-40 object-contain animate-bounce"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Goose taking a break
          </h1>
          <p className="text-2xl md:text-3xl text-amber-400 font-semibold mb-8">
            Back soon!
          </p>
        </div>
        
        <div className="space-y-4 text-white/70 text-lg">
          <p>
            We're currently performing some maintenance to make Goose Trials even better.
          </p>
          <p>
            Check back shortly, or follow us for updates.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-sm text-white/50">
            Questions? Contact{' '}
            <a 
              href="mailto:goosetrials@gmail.com" 
              className="text-amber-400 hover:text-amber-300 underline transition-colors"
            >
              goosetrials@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

