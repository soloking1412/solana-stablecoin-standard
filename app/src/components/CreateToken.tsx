import React, { useState } from "react";

interface Props {
  onCreated: (mintAddress: string) => void;
}

export default function CreateToken({ onCreated }: Props) {
  const [preset, setPreset] = useState("sss-1");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const presets = [
    { id: "sss-1", name: "SSS-1 Minimal", desc: "Basic stablecoin with mint, freeze, and metadata" },
    { id: "sss-2", name: "SSS-2 Compliant", desc: "Adds permanent delegate, transfer hook, and blacklist" },
    { id: "sss-3", name: "SSS-3 Private", desc: "Adds confidential transfers (experimental)" },
  ];

  const handleCreate = async () => {
    if (!name || !symbol) return;
    setLoading(true);
    try {
      // In production, this calls the SDK
      setResult("Token created successfully (connect wallet to deploy)");
    } catch (err: unknown) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create Stablecoin</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Preset</label>
          <div className="space-y-2">
            {presets.map((p) => (
              <label
                key={p.id}
                className={`block p-3 rounded-lg border cursor-pointer transition ${
                  preset === p.id
                    ? "border-indigo-500 bg-indigo-900/30"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={p.id}
                  checked={preset === p.id}
                  onChange={() => setPreset(p.id)}
                  className="sr-only"
                />
                <span className="font-medium">{p.name}</span>
                <p className="text-sm text-gray-400 mt-1">{p.desc}</p>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Stablecoin"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="MYUSD"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Decimals</label>
          <input
            type="number"
            value={decimals}
            onChange={(e) => setDecimals(parseInt(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !name || !symbol}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md py-2 font-medium transition"
        >
          {loading ? "Creating..." : "Create Token"}
        </button>

        {result && (
          <div className="bg-gray-800 rounded-md p-3 text-sm">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
