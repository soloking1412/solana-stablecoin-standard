import React, { useState } from "react";

interface Props {
  mintAddress: string;
}

export default function Compliance({ mintAddress }: Props) {
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [seizeFrom, setSeizeFrom] = useState("");
  const [seizeTo, setSeizeTo] = useState("");

  if (!mintAddress) {
    return <div className="text-center py-12 text-gray-400">Create a token first.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Compliance Management</h2>
      <p className="text-sm text-gray-400">SSS-2 compliance features: blacklist management and token seizure.</p>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="font-bold mb-4">Blacklist</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address to blacklist"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g., OFAC match)"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button className="flex-1 bg-red-600 hover:bg-red-700 rounded py-2 text-sm font-medium transition">
              Add to Blacklist
            </button>
            <button className="flex-1 bg-gray-600 hover:bg-gray-700 rounded py-2 text-sm font-medium transition">
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="font-bold mb-4">Seize Tokens</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={seizeFrom}
            onChange={(e) => setSeizeFrom(e.target.value)}
            placeholder="Frozen account to seize from"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={seizeTo}
            onChange={(e) => setSeizeTo(e.target.value)}
            placeholder="Treasury account"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button className="w-full bg-yellow-600 hover:bg-yellow-700 rounded py-2 text-sm font-medium transition">
            Seize Tokens
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="font-bold mb-3">Blacklisted Addresses</h3>
        <p className="text-sm text-gray-400">No addresses blacklisted yet.</p>
      </div>
    </div>
  );
}
