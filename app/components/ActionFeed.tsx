"use client";

interface Recommendation {
  id: number;
  site_name: string;
  tier: string;
  action_text: string;
  reason: string;
  status: string;
  ts: string;
}

const TIER_BADGE: Record<string, string> = {
  Caution: "bg-yellow-100 text-yellow-800",
  Warning: "bg-orange-100 text-orange-800",
  Danger: "bg-red-100 text-red-800",
  Extreme: "bg-red-200 text-red-900",
};

export default function ActionFeed({
  recommendations,
  onApprove,
}: {
  recommendations: Recommendation[];
  onApprove: (id: number) => void;
}) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-gray-500">No recommendations yet — click Refresh to pull conditions.</p>;
  }

  return (
    <ul className="space-y-3">
      {recommendations.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2 py-1 rounded ${TIER_BADGE[r.tier] ?? "bg-gray-100"}`}>
              {r.tier}
            </span>
            <span className="text-xs text-gray-400">{new Date(r.ts).toLocaleString()}</span>
          </div>
          <p className="mt-2 font-medium">{r.site_name}: {r.action_text}</p>
          <p className="text-sm text-gray-500 italic">{r.reason}</p>
          <div className="mt-2">
            {r.status === "pending" ? (
              <button
                onClick={() => onApprove(r.id)}
                className="text-sm bg-blue-900 text-white px-3 py-1 rounded hover:bg-blue-800"
              >
                Approve
              </button>
            ) : (
              <span className="text-sm text-green-700 font-medium">✓ {r.status}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
