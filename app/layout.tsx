import {SessionProvider} from '@/app/providers/SessionContext';
import {MeProvider} from '@/app/providers/MeContext';
import './globals.css';

//Next.js feature: automatically wraps all pages with layout.tsx
//this function allows us to use SessionProvider within each page without having to explicitly wrap each page
//now, every app component can use useSession() and useMe()
export default function RootLayout({children,}: {children: React.ReactNode;}) {
  return (
    <html lang="en">
      <body>
          <SessionProvider>
            <MeProvider>
              {children}
            </MeProvider>
          </SessionProvider>
      </body>
    </html>
  )
}