import React, { useState } from "react";

interface Props {
  mintAddress: string;
}

export default function MintBurn({ mintAddress }: Props) {
  const [mintRecipient, setMintRecipient] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");

  if (!mintAddress) {
    return <div className="text-center py-12 text-gray-400">Create a token first.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-green-400">Mint Tokens</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Recipient</label>
            <input
              type="text"
              value={mintRecipient}
              onChange={(e) => setMintRecipient(e.target.value)}
              placeholder="Token account address"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              placeholder="1000000"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <button className="w-full bg-green-600 hover:bg-green-700 rounded py-2 text-sm font-medium transition">
            Mint
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-red-400">Burn Tokens</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              placeholder="1000000"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <button className="w-full bg-red-600 hover:bg-red-700 rounded py-2 text-sm font-medium transition">
            Burn
          </button>
        </div>
      </div>
    </div>
  );
}
