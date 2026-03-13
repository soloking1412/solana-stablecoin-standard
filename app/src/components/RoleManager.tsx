import React, { useState } from "react";

interface Props {
  mintAddress: string;
}

const ROLES = ["Admin", "Minter", "Burner", "Freezer", "Pauser", "Blacklister", "Seizer"];

export default function RoleManager({ mintAddress }: Props) {
  const [grantAddress, setGrantAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState("Minter");

  if (!mintAddress) {
    return <div className="text-center py-12 text-gray-400">Create a token first.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Role Management</h2>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="font-bold mb-4">Grant Role</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={grantAddress}
            onChange={(e) => setGrantAddress(e.target.value)}
            placeholder="Wallet address"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded py-2 text-sm font-medium transition">
              Grant
            </button>
            <button className="flex-1 bg-gray-600 hover:bg-gray-700 rounded py-2 text-sm font-medium transition">
              Revoke
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="font-bold mb-3">Current Roles</h3>
        <div className="space-y-2">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center justify-between py-1 border-b border-gray-700 last:border-0">
              <span className="text-sm">{role}</span>
              <span className="text-xs text-gray-400">No holders</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
