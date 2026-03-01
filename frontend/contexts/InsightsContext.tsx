import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

import { Insight } from "@/services/InsightService";

type InsightsContextValue = {
  insights: Insight[];
  setInsights: (insights: Insight[]) => void;
};

const InsightsContext = createContext<InsightsContextValue | null>(null);

export function InsightsProvider({ children }: { children: ReactNode }) {
  const [insights, setInsights] = useState<Insight[]>([]);

  const value = useMemo(
    () => ({
      insights,
      setInsights,
    }),
    [insights],
  );

  return (
    <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>
  );
}

export function useInsights() {
  const context = useContext(InsightsContext);
  if (!context) {
    throw new Error("useInsights must be used within an InsightsProvider");
  }
  return context;
}
