import React from "react";

interface Props {
  mintAddress: string;
}

export default function Dashboard({ mintAddress }: Props) {
  if (!mintAddress) {
    return (
      <div className="text-center py-12 text-gray-400">
        Create or connect to a token first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Token Dashboard</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Minted</p>
          <p className="text-2xl font-bold text-green-400">0</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Burned</p>
          <p className="text-2xl font-bold text-red-400">0</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Circulating</p>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-medium mb-2">Token Info</h3>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-400">Mint:</span> {mintAddress}</p>
          <p><span className="text-gray-400">Status:</span> <span className="text-green-400">Active</span></p>
        </div>
      </div>
    </div>
  );
}
