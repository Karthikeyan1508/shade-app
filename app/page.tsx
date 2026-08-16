"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import ActionFeed from "./components/ActionFeed";
import type { SiteMarker } from "./components/MapView";

// Leaflet touches `window` — must be client-only, no SSR.
const MapView = dynamic(() => import("./components/MapView"), { ssr: false });

export default function Home() {
  const [sites, setSites] = useState<SiteMarker[]>([]);
  const [recommendations, setRecommendations] = useState([]);
  const [dataSource, setDataSource] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadSites = useCallback(async () => {
    const res = await fetch("/api/sites");
    const json = await res.json();
    setSites(json.sites);
    setDataSource(json.dataSource);
  }, []);

  const loadRecommendations = useCallback(async () => {
    const res = await fetch("/api/recommendations");
    const json = await res.json();
    setRecommendations(json.recommendations);
  }, []);

  useEffect(() => {
    // Initial data load. Deliberately fire-and-forget: this is the standard
    // effect-driven fetch pattern, not an accidental synchronous setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSites();
    loadRecommendations();
  }, [loadSites, loadRecommendations]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/ingest/refresh", { method: "POST" });
      await Promise.all([loadSites(), loadRecommendations()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleApprove(id: number) {
    await fetch(`/api/recommendations/${id}/approve`, { method: "POST" });
    await loadRecommendations();
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">Shade — Command Center</h1>
          <p className="text-sm text-gray-500">
            Data source: <span className="font-medium">{dataSource}</span>
            {dataSource.includes("fallback") && (
              <span className="ml-2 text-amber-600">
                (placeholder — set FORTYGUARD_API_KEY in .env.local once you have one)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-blue-950 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh conditions"}
          </button>
          <a
            href="/api/compliance/export"
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Export compliance log
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-xl p-4 shadow-sm">
          <MapView sites={sites} />
        </section>
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3 text-blue-950">Recommendations</h2>
          <ActionFeed recommendations={recommendations} onApprove={handleApprove} />
        </section>
      </main>
    </div>
  );
}
