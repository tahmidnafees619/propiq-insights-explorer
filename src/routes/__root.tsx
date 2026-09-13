import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";

import appCss from "../styles.css?url";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { BlueprintBackground } from "@/components/background/BlueprintBackground";
import { IntroProvider } from "@/components/intro/IntroProvider";
import { IntroSequence } from "@/components/intro/IntroSequence";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PropIQ — King County Real Estate Intelligence" },
      {
        name: "description",
        content:
          "ML-powered real estate market intelligence for King County, WA. Explore 21k+ property sales and predict home values with a calibrated confidence range.",
      },
      { property: "og:title", content: "PropIQ — King County Real Estate Intelligence" },
      {
        property: "og:description",
        content: "ML-powered real estate market intelligence dashboard for King County, WA.",
      },
      { property: "og:site_name", content: "PropIQ" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#070D10" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="grain">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      {/* Outside the route tree, so navigating never re-drafts the drawing. */}
      <BlueprintBackground />
      <IntroProvider>
        {/* The sheet is a spacer with a sticky stage; the app sits beneath it
            in normal flow, so it is in the document and costs no LCP. */}
        <IntroSequence />
        <div className="relative z-10 min-h-screen flex flex-col">
          <Navbar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 min-w-0 pb-20 lg:pb-0">
              <AnimatePresence mode="wait">
                <Outlet />
              </AnimatePresence>
            </main>
          </div>
          <MobileTabBar />
        </div>
      </IntroProvider>
    </QueryClientProvider>
  );
}
