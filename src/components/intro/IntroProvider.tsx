/**
 * Decides whether the title sheet plays, and owns the handoff to the navbar.
 *
 * Three modes:
 *
 *   full   first visit — the sheet is drafted in full
 *   brief  seen already this session — the same sheet, assembled in 0.6s
 *   off    reduced motion, or ?intro=0 — the app loads straight away
 *
 * The mode cannot be known on the server, so the markup is rendered for `full`
 * and corrected in a layout effect, which runs before paint. A returning
 * visitor therefore sees the sheet resolve instantly rather than watching it
 * draw for the fourth time, and never sees it flash.
 *
 * `introActive` exists so exactly one component owns the wordmark's shared
 * layout id at a time. Two elements claiming it would make Framer animate
 * between them unpredictably.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";

export type IntroMode = "full" | "brief" | "off";

interface IntroValue {
  mode: IntroMode;
  /** True while the hero still owns the wordmark. */
  introActive: boolean;
  /** Hand the wordmark to the navbar. */
  handOff: () => void;
}

const IntroContext = createContext<IntroValue>({
  mode: "off",
  introActive: false,
  handOff: () => {},
});

export const useIntro = () => useContext(IntroContext);

const SEEN_KEY = "propiq:intro-seen";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function IntroProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<IntroMode>("full");
  const [introActive, setIntroActive] = useState(true);

  useIsomorphicLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("intro");

    // An explicit override wins over everything, so a demo can always be
    // recorded from a cold start without clearing storage.
    if (override === "1") {
      setMode("full");
      return;
    }
    if (override === "0" || reduced) {
      setMode("off");
      setIntroActive(false);
      return;
    }

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Private browsing can throw on access; treat it as a first visit.
    }
    setMode(seen ? "brief" : "full");
  }, [reduced]);

  const handOff = useCallback(() => {
    setIntroActive(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to do — the intro simply plays in full again next time.
    }
  }, []);

  const value = useMemo(
    () => ({ mode, introActive: introActive && mode !== "off", handOff }),
    [mode, introActive, handOff],
  );

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}
