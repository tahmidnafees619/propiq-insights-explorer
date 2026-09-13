/**
 * Decides whether the title sheet plays, and owns the handoff to the navbar.
 *
 * The sheet belongs to one moment only: the first time a visitor lands on the
 * dashboard in a session. Three things have to be true for it to run —
 *
 *   - the route is the dashboard (it is the dashboard's cover page, not the
 *     app's; reaching Predictor should not mean scrolling past a title sheet)
 *   - it has not already been shown in this session
 *   - the visitor has not asked for reduced motion
 *
 * An earlier version also played an abbreviated 0.6s version on return
 * visits. It was still a sheet standing between someone and the thing they
 * came back for, so return visits now go straight to the dashboard.
 *
 * "Shown" is decided the moment the sheet appears, not when it finishes, so
 * navigating away mid-sequence also counts — otherwise coming back to the
 * dashboard would replay it.
 *
 * The mode cannot be known on the server, so the markup renders for `full`
 * and is corrected in a layout effect, which runs before paint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { useReducedMotion } from "framer-motion";

interface IntroValue {
  /** True while the title sheet is on screen and owns the wordmark. */
  introActive: boolean;
  /** Called when the sheet has finished handing over to the app. */
  handOff: () => void;
}

const IntroContext = createContext<IntroValue>({
  introActive: false,
  handOff: () => {},
});

export const useIntro = () => useContext(IntroContext);

const SEEN_KEY = "propiq:intro-seen";
/** The sheet is the dashboard's cover page; no other route carries it. */
const INTRO_ROUTE = "/";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private browsing can throw on write; the sheet simply plays again.
  }
}

export function IntroProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [allowed, setAllowed] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  /** Whether the sheet has ever been on screen during this session. */
  const shown = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("intro");

    // An explicit override wins over everything, so a demo can always be
    // recorded from a cold start without clearing storage.
    if (override === "1") {
      setAllowed(true);
      return;
    }
    if (override === "0" || reduced) {
      setAllowed(false);
      return;
    }

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Treat an unreadable store as a first visit.
    }
    setAllowed(!seen);
  }, [reduced]);

  const onIntroRoute = pathname === INTRO_ROUTE;
  const introActive = allowed && onIntroRoute && !dismissed;

  useEffect(() => {
    if (introActive) shown.current = true;
  }, [introActive]);

  // Leaving the dashboard while the sheet is up retires it: returning should
  // land on the dashboard itself, not on a cover page a second time.
  useEffect(() => {
    if (!onIntroRoute && shown.current && !dismissed) {
      setDismissed(true);
      markSeen();
    }
  }, [onIntroRoute, dismissed]);

  const handOff = useCallback(() => {
    setDismissed(true);
    markSeen();
  }, []);

  const value = useMemo(() => ({ introActive, handOff }), [introActive, handOff]);

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}
