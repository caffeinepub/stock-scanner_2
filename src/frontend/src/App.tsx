import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { INITIAL_STOCKS, type Stock } from "@/data/stocks";
import { useActor } from "@/hooks/useActor";
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  Eye,
  Pause,
  Play,
  SlidersHorizontal,
  Star,
  StarOff,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SortKey = keyof Stock;
type SortDir = "asc" | "desc";
type Tab = "scanner" | "momentum" | "watchlist";
type Preset = "all" | "ross5" | "momentum" | "gapups";

interface Filters {
  maxPrice: number;
  minChangePercent: number;
  maxFloat: number;
  minRelVol: number;
  hasCatalyst: boolean;
  technicalSetup: boolean;
}

const DEFAULT_FILTERS: Filters = {
  maxPrice: 1000,
  minChangePercent: -100,
  maxFloat: 10000,
  minRelVol: 0,
  hasCatalyst: false,
  technicalSetup: false,
};

const ROSS5_FILTERS: Filters = {
  maxPrice: 20,
  minChangePercent: -100,
  maxFloat: 20,
  minRelVol: 2,
  hasCatalyst: true,
  technicalSetup: true,
};

const CATALYST_COLORS: Record<string, string> = {
  Earnings: "text-yellow-400",
  FDA: "text-blue-400",
  PR: "text-purple-400",
};

function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtCap(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}B`;
  return `${n.toFixed(0)}M`;
}

function passesFilters(s: Stock, filters: Filters): boolean {
  if (s.price > filters.maxPrice) return false;
  if (s.changePercent < filters.minChangePercent) return false;
  if (s.float > filters.maxFloat) return false;
  if (s.relativeVolume < filters.minRelVol) return false;
  if (filters.hasCatalyst && s.catalyst.length === 0) return false;
  if (filters.technicalSetup && !s.technicalSetup) return false;
  return true;
}

function meetsPillars(s: Stock): boolean {
  return (
    s.float < 20 &&
    s.relativeVolume >= 2 &&
    s.price < 20 &&
    s.catalyst.length > 0 &&
    s.technicalSetup
  );
}

export default function App() {
  const { actor } = useActor();

  const [stocks, setStocks] = useState<Stock[]>(INITIAL_STOCKS);
  const [sortKey, setSortKey] = useState<SortKey>("changePercent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activePreset, setActivePreset] = useState<Preset>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<Tab>("scanner");
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("stockscan_watchlist") || "[]");
    } catch {
      return [];
    }
  });
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [momentumTab, setMomentumTab] = useState<"1min" | "5min">("1min");
  const [momentumThreshold, setMomentumThreshold] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh simulation
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setStocks((prev) =>
        prev.map((s) => {
          const priceDelta = s.price * (Math.random() * 0.01 - 0.005);
          const newPrice = Math.max(0.01, s.price + priceDelta);
          const newChangePct = s.changePercent + (Math.random() * 0.4 - 0.2);
          const newRelVol = Math.max(
            0.1,
            s.relativeVolume + (Math.random() * 0.2 - 0.1),
          );
          const newMom1 = s.momentum1Min + (Math.random() * 0.6 - 0.3);
          const newMom5 = s.momentum5Min + (Math.random() * 0.4 - 0.2);
          const newVol = Math.max(
            100,
            s.volume * (1 + (Math.random() * 0.2 - 0.1)),
          );
          return {
            ...s,
            price: Math.round(newPrice * 100) / 100,
            changePercent: Math.round(newChangePct * 10) / 10,
            changeDollar:
              Math.round((newChangePct / 100) * newPrice * 100) / 100,
            relativeVolume: Math.round(newRelVol * 10) / 10,
            momentum1Min: Math.round(newMom1 * 10) / 10,
            momentum5Min: Math.round(newMom5 * 10) / 10,
            volume: Math.round(newVol),
          };
        }),
      );
      setLastUpdated(new Date());
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused]);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem("stockscan_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDir("desc");
      return key;
    });
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setActivePreset(preset);
    if (preset === "ross5") {
      setFilters(ROSS5_FILTERS);
      setDraftFilters(ROSS5_FILTERS);
    } else if (preset === "momentum") {
      setFilters({ ...DEFAULT_FILTERS, minChangePercent: 3 });
      setDraftFilters({ ...DEFAULT_FILTERS, minChangePercent: 3 });
    } else if (preset === "gapups") {
      setFilters({ ...DEFAULT_FILTERS, minChangePercent: 10 });
      setDraftFilters({ ...DEFAULT_FILTERS, minChangePercent: 10 });
    } else {
      setFilters(DEFAULT_FILTERS);
      setDraftFilters(DEFAULT_FILTERS);
    }
  }, []);

  const toggleWatchlist = useCallback(
    (ticker: string) => {
      setWatchlist((prev) => {
        const next = prev.includes(ticker)
          ? prev.filter((t) => t !== ticker)
          : [...prev, ticker];
        if (!prev.includes(ticker)) {
          actor?.addToWatchlist(ticker).catch(() => {});
        } else {
          actor?.removeFromWatchlist(ticker).catch(() => {});
        }
        return next;
      });
    },
    [actor],
  );

  const filteredSorted = useMemo(() => {
    const filtered = stocks.filter((s) => passesFilters(s, filters));
    return filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return sortDir === "asc"
          ? Number(av) - Number(bv)
          : Number(bv) - Number(av);
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [stocks, filters, sortKey, sortDir]);

  const topMomentum = useMemo(() => {
    const key = momentumTab === "1min" ? "momentum1Min" : "momentum5Min";
    return [...stocks]
      .filter(
        (s) =>
          (momentumTab === "1min" ? s.momentum1Min : s.momentum5Min) >=
          momentumThreshold,
      )
      .sort((a, b) => b[key] - a[key])
      .slice(0, 8);
  }, [stocks, momentumTab, momentumThreshold]);

  const watchlistStocks = useMemo(
    () => stocks.filter((s) => watchlist.includes(s.ticker)),
    [stocks, watchlist],
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0B0F14", color: "#E6EDF3" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 h-12 border-b"
        style={{ background: "#141B24", borderColor: "#232D3A" }}
      >
        {/* Logo + Brand */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 flex items-center justify-center rounded"
            style={{ background: "#1FCB9A20" }}
          >
            <TrendingUp className="w-4 h-4" style={{ color: "#20C997" }} />
          </div>
          <span
            className="font-bold text-sm tracking-wide"
            style={{ color: "#E6EDF3" }}
          >
            StockScan
          </span>
        </div>

        {/* Nav Tabs */}
        <nav className="flex items-center gap-1">
          {(["scanner", "momentum", "watchlist"] as Tab[]).map((tab) => (
            <button
              type="button"
              key={tab}
              data-ocid={`nav.${tab}.tab`}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 text-xs font-medium rounded capitalize transition-colors"
              style={{
                background: activeTab === tab ? "#1FCB9A20" : "transparent",
                color: activeTab === tab ? "#20C997" : "#9AA6B2",
                border:
                  activeTab === tab
                    ? "1px solid #20C99730"
                    : "1px solid transparent",
              }}
            >
              {tab === "scanner"
                ? "Scanner"
                : tab === "momentum"
                  ? "Momentum"
                  : "Watchlist"}
            </button>
          ))}
        </nav>

        {/* Right: Live badge + pause */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: isPaused ? "#6B7785" : "#2EEA8A",
                boxShadow: isPaused ? "none" : "0 0 6px #2EEA8A80",
              }}
            />
            <span
              className="text-xs"
              style={{ color: isPaused ? "#6B7785" : "#2EEA8A" }}
            >
              {isPaused ? "PAUSED" : "LIVE"}
            </span>
          </div>
          <div className="flex items-center gap-1" style={{ color: "#6B7785" }}>
            <Clock className="w-3 h-3" />
            <span className="text-xs font-mono">
              {lastUpdated.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <button
            type="button"
            data-ocid="header.toggle"
            onClick={() => setIsPaused((p) => !p)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{ background: "#232D3A", color: "#9AA6B2" }}
          >
            {isPaused ? (
              <Play className="w-3 h-3" />
            ) : (
              <Pause className="w-3 h-3" />
            )}
            {isPaused ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      {/* Filter Strip */}
      <div className="px-4 pt-3 pb-0">
        <div
          className="rounded-lg p-3"
          style={{ background: "#141B24", border: "1px solid #232D3A" }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs" style={{ color: "#6B7785" }}>
              Presets:
            </span>
            {[
              { key: "ross5" as Preset, label: "Ross Cameron 5 Pillars" },
              { key: "momentum" as Preset, label: "Momentum Movers" },
              { key: "gapups" as Preset, label: "Gap Ups" },
              { key: "all" as Preset, label: "All Stocks" },
            ].map(({ key, label }) => (
              <button
                type="button"
                key={key}
                data-ocid={`filter.${key}.button`}
                onClick={() => applyPreset(key)}
                className="px-2.5 py-1 text-xs rounded-md transition-all"
                style={{
                  background: activePreset === key ? "#1FCB9A20" : "#0F141C",
                  color: activePreset === key ? "#20C997" : "#9AA6B2",
                  border:
                    activePreset === key
                      ? "1px solid #20C997"
                      : "1px solid #232D3A",
                  fontWeight: activePreset === key ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quick filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "#6B7785" }}>
                Price ≤
              </span>
              <input
                data-ocid="filter.price.input"
                type="number"
                value={filters.maxPrice >= 1000 ? "" : filters.maxPrice}
                placeholder="Any"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxPrice: Number(e.target.value) || 1000,
                  }))
                }
                className="w-16 h-7 text-xs rounded px-2 font-mono"
                style={{
                  background: "#0F141C",
                  border: "1px solid #232D3A",
                  color: "#E6EDF3",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "#6B7785" }}>
                % Chg ≥
              </span>
              <input
                data-ocid="filter.change.input"
                type="number"
                value={
                  filters.minChangePercent <= -100
                    ? ""
                    : filters.minChangePercent
                }
                placeholder="Any"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minChangePercent: Number(e.target.value) || -100,
                  }))
                }
                className="w-16 h-7 text-xs rounded px-2 font-mono"
                style={{
                  background: "#0F141C",
                  border: "1px solid #232D3A",
                  color: "#E6EDF3",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "#6B7785" }}>
                Float ≤
              </span>
              <input
                data-ocid="filter.float.input"
                type="number"
                value={filters.maxFloat >= 10000 ? "" : filters.maxFloat}
                placeholder="Any"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxFloat: Number(e.target.value) || 10000,
                  }))
                }
                className="w-16 h-7 text-xs rounded px-2 font-mono"
                style={{
                  background: "#0F141C",
                  border: "1px solid #232D3A",
                  color: "#E6EDF3",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "#6B7785" }}>
                Rel Vol ≥
              </span>
              <input
                data-ocid="filter.relvol.input"
                type="number"
                value={filters.minRelVol === 0 ? "" : filters.minRelVol}
                placeholder="Any"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minRelVol: Number(e.target.value) || 0,
                  }))
                }
                className="w-16 h-7 text-xs rounded px-2 font-mono"
                style={{
                  background: "#0F141C",
                  border: "1px solid #232D3A",
                  color: "#E6EDF3",
                }}
              />
            </div>
            <button
              type="button"
              data-ocid="filter.advanced.toggle"
              onClick={() => setShowFilterBuilder((v) => !v)}
              className="flex items-center gap-1.5 px-3 h-7 text-xs rounded transition-colors ml-auto"
              style={{
                background: showFilterBuilder ? "#1FCB9A20" : "#0F141C",
                color: showFilterBuilder ? "#20C997" : "#9AA6B2",
                border: "1px solid #232D3A",
              }}
            >
              <SlidersHorizontal className="w-3 h-3" />
              Filters
            </button>
            <button
              type="button"
              data-ocid="filter.run.primary_button"
              className="px-4 h-7 text-xs rounded font-semibold transition-colors"
              style={{ background: "#1FCB9A", color: "#0B0F14" }}
              onClick={() => {}}
            >
              Run Scan
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Filter Builder */}
      <AnimatePresence>
        {showFilterBuilder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-4 pt-2"
          >
            <div
              className="rounded-lg p-4"
              data-ocid="filter.panel"
              style={{ background: "#141B24", border: "1px solid #232D3A" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#9AA6B2" }}
                >
                  Custom Filter Builder
                </span>
                <button
                  type="button"
                  onClick={() => setShowFilterBuilder(false)}
                  style={{ color: "#6B7785" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs" style={{ color: "#9AA6B2" }}>
                    Max Price ($)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[Math.min(draftFilters.maxPrice, 100)]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) =>
                        setDraftFilters((f) => ({ ...f, maxPrice: v }))
                      }
                      className="flex-1"
                    />
                    <Input
                      data-ocid="filter.maxprice.input"
                      type="number"
                      value={
                        draftFilters.maxPrice >= 1000
                          ? ""
                          : draftFilters.maxPrice
                      }
                      placeholder="∞"
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          maxPrice: Number(e.target.value) || 1000,
                        }))
                      }
                      className="w-16 h-7 text-xs font-mono"
                      style={{
                        background: "#0F141C",
                        border: "1px solid #232D3A",
                        color: "#E6EDF3",
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs" style={{ color: "#9AA6B2" }}>
                    Min % Change
                  </Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[Math.max(draftFilters.minChangePercent, -20)]}
                      min={-20}
                      max={100}
                      step={1}
                      onValueChange={([v]) =>
                        setDraftFilters((f) => ({ ...f, minChangePercent: v }))
                      }
                      className="flex-1"
                    />
                    <Input
                      data-ocid="filter.minchange.input"
                      type="number"
                      value={
                        draftFilters.minChangePercent <= -100
                          ? ""
                          : draftFilters.minChangePercent
                      }
                      placeholder="∞"
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          minChangePercent: Number(e.target.value) || -100,
                        }))
                      }
                      className="w-16 h-7 text-xs font-mono"
                      style={{
                        background: "#0F141C",
                        border: "1px solid #232D3A",
                        color: "#E6EDF3",
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs" style={{ color: "#9AA6B2" }}>
                    Max Float (M)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[Math.min(draftFilters.maxFloat, 500)]}
                      min={0}
                      max={500}
                      step={5}
                      onValueChange={([v]) =>
                        setDraftFilters((f) => ({ ...f, maxFloat: v }))
                      }
                      className="flex-1"
                    />
                    <Input
                      data-ocid="filter.maxfloat.input"
                      type="number"
                      value={
                        draftFilters.maxFloat >= 10000
                          ? ""
                          : draftFilters.maxFloat
                      }
                      placeholder="∞"
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          maxFloat: Number(e.target.value) || 10000,
                        }))
                      }
                      className="w-16 h-7 text-xs font-mono"
                      style={{
                        background: "#0F141C",
                        border: "1px solid #232D3A",
                        color: "#E6EDF3",
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs" style={{ color: "#9AA6B2" }}>
                    Min Rel Volume
                  </Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[draftFilters.minRelVol]}
                      min={0}
                      max={20}
                      step={0.5}
                      onValueChange={([v]) =>
                        setDraftFilters((f) => ({ ...f, minRelVol: v }))
                      }
                      className="flex-1"
                    />
                    <Input
                      data-ocid="filter.minrelvol.input"
                      type="number"
                      value={
                        draftFilters.minRelVol === 0
                          ? ""
                          : draftFilters.minRelVol
                      }
                      placeholder="0"
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          minRelVol: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-16 h-7 text-xs font-mono"
                      style={{
                        background: "#0F141C",
                        border: "1px solid #232D3A",
                        color: "#E6EDF3",
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-4 pt-5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasCatalyst"
                      data-ocid="filter.catalyst.checkbox"
                      checked={draftFilters.hasCatalyst}
                      onCheckedChange={(v) =>
                        setDraftFilters((f) => ({ ...f, hasCatalyst: !!v }))
                      }
                    />
                    <Label
                      htmlFor="hasCatalyst"
                      className="text-xs cursor-pointer"
                      style={{ color: "#9AA6B2" }}
                    >
                      Has Catalyst
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="techSetup"
                      data-ocid="filter.setup.checkbox"
                      checked={draftFilters.technicalSetup}
                      onCheckedChange={(v) =>
                        setDraftFilters((f) => ({ ...f, technicalSetup: !!v }))
                      }
                    />
                    <Label
                      htmlFor="techSetup"
                      className="text-xs cursor-pointer"
                      style={{ color: "#9AA6B2" }}
                    >
                      Setup ✓
                    </Label>
                  </div>
                </div>
                <div className="flex items-end gap-2 pt-1">
                  <button
                    type="button"
                    data-ocid="filter.apply.primary_button"
                    onClick={() => {
                      setFilters(draftFilters);
                      setActivePreset("all");
                    }}
                    className="px-3 h-7 text-xs rounded font-semibold"
                    style={{ background: "#1FCB9A", color: "#0B0F14" }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    data-ocid="filter.reset.button"
                    onClick={() => {
                      setDraftFilters(DEFAULT_FILTERS);
                      setFilters(DEFAULT_FILTERS);
                      setActivePreset("all");
                    }}
                    className="px-3 h-7 text-xs rounded"
                    style={{
                      background: "#0F141C",
                      color: "#9AA6B2",
                      border: "1px solid #232D3A",
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 px-4 py-3">
        {activeTab === "scanner" && (
          <div className="flex gap-3 h-full">
            {/* Left: Scanner Table */}
            <div className="flex-1 min-w-0" style={{ flex: "0 0 72%" }}>
              <div
                className="rounded-lg overflow-hidden h-full flex flex-col"
                style={{ background: "#141B24", border: "1px solid #232D3A" }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: "1px solid #232D3A" }}
                >
                  <div className="flex items-center gap-2">
                    <BarChart2
                      className="w-4 h-4"
                      style={{ color: "#20C997" }}
                    />
                    <span className="text-sm font-semibold">
                      Stock Scanner Table
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-mono"
                      style={{ background: "#1FCB9A20", color: "#20C997" }}
                    >
                      {filteredSorted.length} stocks
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activePreset === "ross5" && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: "#1FCB9A30",
                          color: "#20C997",
                          border: "1px solid #20C99750",
                        }}
                      >
                        5 Pillars Active
                      </span>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <table
                    className="w-full text-xs"
                    style={{ borderCollapse: "collapse" }}
                  >
                    <thead
                      style={{
                        background: "#0F141C",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      <tr>
                        {(
                          [
                            { key: "ticker", label: "Ticker" },
                            { key: "price", label: "Price" },
                            { key: "changePercent", label: "% Chg" },
                            { key: "changeDollar", label: "$ Chg" },
                            { key: "volume", label: "Volume" },
                            { key: "relativeVolume", label: "Rel Vol" },
                            { key: "float", label: "Float (M)" },
                            { key: "marketCap", label: "Mkt Cap" },
                            { key: "catalyst", label: "Catalyst" },
                            { key: "technicalSetup", label: "Setup" },
                          ] as { key: SortKey; label: string }[]
                        ).map(({ key, label }) => (
                          <th
                            key={key}
                            className="px-0 py-0 text-left cursor-pointer select-none"
                            style={{
                              borderBottom: "1px solid #232D3A",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleSort(key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSort(key);
                              }}
                              className="flex items-center gap-1 px-3 py-2 w-full uppercase tracking-wider"
                              style={{
                                color: "#6B7785",
                                fontSize: "10px",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              {label}
                              <SortIcon col={key} />
                            </button>
                          </th>
                        ))}
                        <th
                          className="px-3 py-2 text-left uppercase tracking-wider"
                          style={{
                            color: "#6B7785",
                            fontSize: "10px",
                            fontWeight: 600,
                            borderBottom: "1px solid #232D3A",
                          }}
                        >
                          WL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSorted.map((s, idx) => {
                        const allPillars = meetsPillars(s);
                        const hotMomentum = Math.abs(s.momentum1Min) >= 2;
                        const isWatched = watchlist.includes(s.ticker);
                        const rowBg = allPillars
                          ? "rgba(32, 201, 151, 0.07)"
                          : idx % 2 === 0
                            ? "#0F141C"
                            : "transparent";
                        const leftBorderColor = hotMomentum
                          ? s.momentum1Min > 0
                            ? "#F59E0B"
                            : "#EF4444"
                          : allPillars
                            ? "#20C997"
                            : "transparent";
                        return (
                          <tr
                            key={s.ticker}
                            data-ocid={`scanner.item.${idx + 1}`}
                            style={{
                              background: rowBg,
                              borderLeft: `2px solid ${leftBorderColor}`,
                              borderBottom: "1px solid #1a2332",
                            }}
                          >
                            <td
                              className="px-3 py-1.5 font-bold font-mono"
                              style={{ color: "#20C997", whiteSpace: "nowrap" }}
                            >
                              {s.ticker}
                              {allPillars && (
                                <span
                                  className="ml-1 text-xs"
                                  style={{ color: "#20C997" }}
                                >
                                  ★
                                </span>
                              )}
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right"
                              style={{ color: "#E6EDF3" }}
                            >
                              ${fmtNum(s.price)}
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right font-semibold"
                              style={{
                                color:
                                  s.changePercent >= 0 ? "#2EEA8A" : "#FF4D4F",
                              }}
                            >
                              {s.changePercent >= 0 ? "+" : ""}
                              {fmtNum(s.changePercent, 1)}%
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right"
                              style={{
                                color:
                                  s.changeDollar >= 0 ? "#2EEA8A" : "#FF4D4F",
                              }}
                            >
                              {s.changeDollar >= 0 ? "+" : ""}
                              {fmtNum(s.changeDollar)}
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right"
                              style={{ color: "#9AA6B2" }}
                            >
                              {fmtVol(s.volume)}
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right"
                              style={{
                                color:
                                  s.relativeVolume >= 2 ? "#20C997" : "#9AA6B2",
                              }}
                            >
                              {fmtNum(s.relativeVolume, 1)}x
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right"
                              style={{
                                color: s.float < 20 ? "#2EEA8A" : "#9AA6B2",
                              }}
                            >
                              {fmtNum(s.float, 1)}
                            </td>
                            <td
                              className="px-3 py-1.5 font-mono text-right"
                              style={{ color: "#9AA6B2" }}
                            >
                              {fmtCap(s.marketCap)}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                {s.catalyst.map((c) => (
                                  <span
                                    key={c}
                                    className={`text-xs ${CATALYST_COLORS[c] ?? "text-gray-400"}`}
                                    style={{ fontSize: "10px" }}
                                  >
                                    [{c}]
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {s.technicalSetup ? (
                                <span style={{ color: "#20C997" }}>✓</span>
                              ) : (
                                <span style={{ color: "#232D3A" }}>—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                type="button"
                                data-ocid={`scanner.watchlist.toggle.${idx + 1}`}
                                onClick={() => toggleWatchlist(s.ticker)}
                                className="transition-colors"
                                style={{
                                  color: isWatched ? "#F59E0B" : "#3A4755",
                                }}
                              >
                                {isWatched ? (
                                  <Star className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                  <Star className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredSorted.length === 0 && (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-8 text-center"
                            data-ocid="scanner.empty_state"
                            style={{ color: "#6B7785" }}
                          >
                            No stocks match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>

            {/* Right Sidebar */}
            <div
              className="flex flex-col gap-3"
              style={{ flex: "0 0 27%", minWidth: 0 }}
            >
              {/* Momentum Scanner Card */}
              <div
                className="rounded-lg overflow-hidden flex flex-col"
                style={{ background: "#141B24", border: "1px solid #232D3A" }}
              >
                <div
                  className="px-4 py-2.5"
                  style={{ borderBottom: "1px solid #232D3A" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity
                        className="w-4 h-4"
                        style={{ color: "#20C997" }}
                      />
                      <span className="text-sm font-semibold">
                        Momentum Scanner
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="flex rounded overflow-hidden"
                      style={{ border: "1px solid #232D3A" }}
                    >
                      {(["1min", "5min"] as const).map((t) => (
                        <button
                          type="button"
                          key={t}
                          data-ocid={`momentum.${t}.tab`}
                          onClick={() => setMomentumTab(t)}
                          className="px-2.5 py-1 text-xs"
                          style={{
                            background:
                              momentumTab === t ? "#1FCB9A20" : "transparent",
                            color: momentumTab === t ? "#20C997" : "#6B7785",
                          }}
                        >
                          {t === "1min" ? "1-Min" : "5-Min"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: "#6B7785" }}>
                        ≥
                      </span>
                      <input
                        data-ocid="momentum.threshold.input"
                        type="number"
                        value={momentumThreshold}
                        step={0.5}
                        min={0}
                        onChange={(e) =>
                          setMomentumThreshold(Number(e.target.value) || 0)
                        }
                        className="w-12 h-6 text-xs rounded px-1.5 font-mono"
                        style={{
                          background: "#0F141C",
                          border: "1px solid #232D3A",
                          color: "#E6EDF3",
                        }}
                      />
                      <span className="text-xs" style={{ color: "#6B7785" }}>
                        %
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div
                    className="grid px-3 py-1.5"
                    style={{
                      gridTemplateColumns: "1fr auto auto",
                      borderBottom: "1px solid #1a2332",
                    }}
                  >
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{ color: "#6B7785", fontSize: "10px" }}
                    >
                      Ticker
                    </span>
                    <span
                      className="text-xs uppercase tracking-wider text-right w-14"
                      style={{ color: "#6B7785", fontSize: "10px" }}
                    >
                      1-Min
                    </span>
                    <span
                      className="text-xs uppercase tracking-wider text-right w-14"
                      style={{ color: "#6B7785", fontSize: "10px" }}
                    >
                      5-Min
                    </span>
                  </div>
                  {topMomentum.length === 0 ? (
                    <div
                      className="px-4 py-6 text-center"
                      data-ocid="momentum.empty_state"
                      style={{ color: "#6B7785", fontSize: "12px" }}
                    >
                      No movers above {momentumThreshold}%
                    </div>
                  ) : (
                    topMomentum.map((s, idx) => (
                      <div
                        key={s.ticker}
                        data-ocid={`momentum.item.${idx + 1}`}
                        className="grid px-3 py-1.5 items-center"
                        style={{
                          gridTemplateColumns: "1fr auto auto",
                          borderBottom: "1px solid #1a2332",
                        }}
                      >
                        <span
                          className="text-xs font-bold font-mono"
                          style={{ color: "#20C997" }}
                        >
                          {s.ticker}
                        </span>
                        <span
                          className="text-xs font-mono text-right w-14"
                          style={{
                            color: s.momentum1Min >= 0 ? "#2EEA8A" : "#FF4D4F",
                          }}
                        >
                          {s.momentum1Min >= 0 ? "+" : ""}
                          {fmtNum(s.momentum1Min, 1)}%
                        </span>
                        <span
                          className="text-xs font-mono text-right w-14"
                          style={{
                            color: s.momentum5Min >= 0 ? "#2EEA8A" : "#FF4D4F",
                          }}
                        >
                          {s.momentum5Min >= 0 ? "+" : ""}
                          {fmtNum(s.momentum5Min, 1)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Watchlist Card */}
              <div
                className="rounded-lg overflow-hidden flex flex-col"
                style={{ background: "#141B24", border: "1px solid #232D3A" }}
              >
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ borderBottom: "1px solid #232D3A" }}
                >
                  <Eye className="w-4 h-4" style={{ color: "#20C997" }} />
                  <span className="text-sm font-semibold">My Watchlist</span>
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ background: "#1FCB9A20", color: "#20C997" }}
                  >
                    {watchlist.length}
                  </span>
                </div>
                {watchlistStocks.length === 0 ? (
                  <div
                    className="px-4 py-6 text-center"
                    data-ocid="watchlist.empty_state"
                    style={{ color: "#6B7785", fontSize: "12px" }}
                  >
                    No stocks in watchlist.
                    <br />
                    <span style={{ color: "#3A4755" }}>
                      Click ★ in the scanner to add.
                    </span>
                  </div>
                ) : (
                  <div>
                    <div
                      className="grid px-3 py-1.5"
                      style={{
                        gridTemplateColumns: "1fr auto auto auto",
                        borderBottom: "1px solid #1a2332",
                      }}
                    >
                      <span
                        className="text-xs uppercase tracking-wider"
                        style={{ color: "#6B7785", fontSize: "10px" }}
                      >
                        Ticker
                      </span>
                      <span
                        className="text-xs uppercase tracking-wider text-right w-16"
                        style={{ color: "#6B7785", fontSize: "10px" }}
                      >
                        Price
                      </span>
                      <span
                        className="text-xs uppercase tracking-wider text-right w-14"
                        style={{ color: "#6B7785", fontSize: "10px" }}
                      >
                        % Chg
                      </span>
                      <span className="w-7" />
                    </div>
                    {watchlistStocks.map((s, idx) => (
                      <div
                        key={s.ticker}
                        data-ocid={`watchlist.item.${idx + 1}`}
                        className="grid px-3 py-1.5 items-center"
                        style={{
                          gridTemplateColumns: "1fr auto auto auto",
                          borderBottom: "1px solid #1a2332",
                        }}
                      >
                        <span
                          className="text-xs font-bold font-mono"
                          style={{ color: "#20C997" }}
                        >
                          {s.ticker}
                        </span>
                        <span
                          className="text-xs font-mono text-right w-16"
                          style={{ color: "#E6EDF3" }}
                        >
                          ${fmtNum(s.price)}
                        </span>
                        <span
                          className="text-xs font-mono text-right w-14"
                          style={{
                            color: s.changePercent >= 0 ? "#2EEA8A" : "#FF4D4F",
                          }}
                        >
                          {s.changePercent >= 0 ? "+" : ""}
                          {fmtNum(s.changePercent, 1)}%
                        </span>
                        <button
                          type="button"
                          data-ocid={`watchlist.delete_button.${idx + 1}`}
                          onClick={() => toggleWatchlist(s.ticker)}
                          className="w-7 flex items-center justify-center transition-colors"
                          style={{ color: "#3A4755" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#FF4D4F";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#3A4755";
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Momentum Full View */}
        {activeTab === "momentum" && (
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: "#141B24", border: "1px solid #232D3A" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid #232D3A" }}
            >
              <Activity className="w-5 h-5" style={{ color: "#20C997" }} />
              <span className="text-base font-semibold">Momentum Scanner</span>
              <span className="text-xs ml-2" style={{ color: "#6B7785" }}>
                Stocks making significant intraday price moves
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div
                  className="flex rounded overflow-hidden"
                  style={{ border: "1px solid #232D3A" }}
                >
                  {(["1min", "5min"] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      data-ocid={`momentum_full.${t}.tab`}
                      onClick={() => setMomentumTab(t)}
                      className="px-3 py-1.5 text-xs"
                      style={{
                        background:
                          momentumTab === t ? "#1FCB9A20" : "transparent",
                        color: momentumTab === t ? "#20C997" : "#6B7785",
                      }}
                    >
                      {t === "1min" ? "1-Min" : "5-Min"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "#6B7785" }}>
                    Threshold ≥
                  </span>
                  <input
                    data-ocid="momentum_full.threshold.input"
                    type="number"
                    value={momentumThreshold}
                    step={0.5}
                    min={0}
                    onChange={(e) =>
                      setMomentumThreshold(Number(e.target.value) || 0)
                    }
                    className="w-16 h-7 text-xs rounded px-2 font-mono"
                    style={{
                      background: "#0F141C",
                      border: "1px solid #232D3A",
                      color: "#E6EDF3",
                    }}
                  />
                  <span className="text-xs" style={{ color: "#6B7785" }}>
                    %
                  </span>
                </div>
              </div>
            </div>
            <table
              className="w-full text-xs"
              style={{ borderCollapse: "collapse" }}
            >
              <thead style={{ background: "#0F141C" }}>
                <tr>
                  {[
                    "Ticker",
                    "Company",
                    "Price",
                    "% Chg",
                    "1-Min %",
                    "5-Min %",
                    "Rel Vol",
                    "Float (M)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left uppercase tracking-wider"
                      style={{
                        color: "#6B7785",
                        fontSize: "10px",
                        fontWeight: 600,
                        borderBottom: "1px solid #232D3A",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...stocks]
                  .filter(
                    (s) =>
                      Math.abs(
                        momentumTab === "1min"
                          ? s.momentum1Min
                          : s.momentum5Min,
                      ) >= momentumThreshold,
                  )
                  .sort((a, b) =>
                    momentumTab === "1min"
                      ? b.momentum1Min - a.momentum1Min
                      : b.momentum5Min - a.momentum5Min,
                  )
                  .map((s, idx) => (
                    <tr
                      key={s.ticker}
                      data-ocid={`momentum_full.item.${idx + 1}`}
                      style={{
                        borderBottom: "1px solid #1a2332",
                        background: idx % 2 === 0 ? "#0F141C" : "transparent",
                      }}
                    >
                      <td
                        className="px-4 py-2 font-bold font-mono"
                        style={{ color: "#20C997" }}
                      >
                        {s.ticker}
                      </td>
                      <td
                        className="px-4 py-2"
                        style={{
                          color: "#9AA6B2",
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.company}
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{ color: "#E6EDF3" }}
                      >
                        ${fmtNum(s.price)}
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{
                          color: s.changePercent >= 0 ? "#2EEA8A" : "#FF4D4F",
                        }}
                      >
                        {s.changePercent >= 0 ? "+" : ""}
                        {fmtNum(s.changePercent, 1)}%
                      </td>
                      <td
                        className="px-4 py-2 font-mono font-semibold"
                        style={{
                          color: s.momentum1Min >= 0 ? "#2EEA8A" : "#FF4D4F",
                        }}
                      >
                        {s.momentum1Min >= 0 ? "+" : ""}
                        {fmtNum(s.momentum1Min, 1)}%
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{
                          color: s.momentum5Min >= 0 ? "#2EEA8A" : "#FF4D4F",
                        }}
                      >
                        {s.momentum5Min >= 0 ? "+" : ""}
                        {fmtNum(s.momentum5Min, 1)}%
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{
                          color: s.relativeVolume >= 2 ? "#20C997" : "#9AA6B2",
                        }}
                      >
                        {fmtNum(s.relativeVolume, 1)}x
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{ color: s.float < 20 ? "#2EEA8A" : "#9AA6B2" }}
                      >
                        {fmtNum(s.float, 1)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Watchlist Full View */}
        {activeTab === "watchlist" && (
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: "#141B24", border: "1px solid #232D3A" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid #232D3A" }}
            >
              <Eye className="w-5 h-5" style={{ color: "#20C997" }} />
              <span className="text-base font-semibold">My Watchlist</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{ background: "#1FCB9A20", color: "#20C997" }}
              >
                {watchlist.length} stocks
              </span>
            </div>
            {watchlistStocks.length === 0 ? (
              <div
                className="px-4 py-16 text-center"
                data-ocid="watchlist_full.empty_state"
              >
                <Star
                  className="w-10 h-10 mx-auto mb-3"
                  style={{ color: "#232D3A" }}
                />
                <p className="text-sm" style={{ color: "#6B7785" }}>
                  Your watchlist is empty.
                </p>
                <p className="text-xs mt-1" style={{ color: "#3A4755" }}>
                  Go to the Scanner tab and click ★ next to any stock to add it.
                </p>
              </div>
            ) : (
              <table
                className="w-full text-xs"
                style={{ borderCollapse: "collapse" }}
              >
                <thead style={{ background: "#0F141C" }}>
                  <tr>
                    {[
                      "Ticker",
                      "Company",
                      "Price",
                      "% Chg",
                      "$ Chg",
                      "Volume",
                      "Rel Vol",
                      "Float (M)",
                      "Catalyst",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left uppercase tracking-wider"
                        style={{
                          color: "#6B7785",
                          fontSize: "10px",
                          fontWeight: 600,
                          borderBottom: "1px solid #232D3A",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {watchlistStocks.map((s, idx) => (
                    <tr
                      key={s.ticker}
                      data-ocid={`watchlist_full.item.${idx + 1}`}
                      style={{
                        borderBottom: "1px solid #1a2332",
                        background: idx % 2 === 0 ? "#0F141C" : "transparent",
                      }}
                    >
                      <td
                        className="px-4 py-2 font-bold font-mono"
                        style={{ color: "#20C997" }}
                      >
                        {s.ticker}
                      </td>
                      <td className="px-4 py-2" style={{ color: "#9AA6B2" }}>
                        {s.company}
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{ color: "#E6EDF3" }}
                      >
                        ${fmtNum(s.price)}
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{
                          color: s.changePercent >= 0 ? "#2EEA8A" : "#FF4D4F",
                        }}
                      >
                        {s.changePercent >= 0 ? "+" : ""}
                        {fmtNum(s.changePercent, 1)}%
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{
                          color: s.changeDollar >= 0 ? "#2EEA8A" : "#FF4D4F",
                        }}
                      >
                        {s.changeDollar >= 0 ? "+" : ""}
                        {fmtNum(s.changeDollar)}
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{ color: "#9AA6B2" }}
                      >
                        {fmtVol(s.volume)}
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{
                          color: s.relativeVolume >= 2 ? "#20C997" : "#9AA6B2",
                        }}
                      >
                        {fmtNum(s.relativeVolume, 1)}x
                      </td>
                      <td
                        className="px-4 py-2 font-mono"
                        style={{ color: s.float < 20 ? "#2EEA8A" : "#9AA6B2" }}
                      >
                        {fmtNum(s.float, 1)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {s.catalyst.map((c) => (
                            <span
                              key={c}
                              className={`text-xs ${CATALYST_COLORS[c] ?? "text-gray-400"}`}
                              style={{ fontSize: "10px" }}
                            >
                              [{c}]
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          data-ocid={`watchlist_full.delete_button.${idx + 1}`}
                          onClick={() => toggleWatchlist(s.ticker)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                          style={{
                            color: "#FF4D4F",
                            border: "1px solid #FF4D4F30",
                          }}
                        >
                          <StarOff className="w-3 h-3" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="px-4 py-2.5 mt-1"
        style={{ background: "#0B0F14", borderTop: "1px solid #232D3A" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "#3A4755" }}>
            ⚠ For educational purposes only. Simulated data — not real market
            data. Not financial advice.
          </p>
          <p className="text-xs" style={{ color: "#3A4755" }}>
            © {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#20C997" }}
            >
              Built with caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
