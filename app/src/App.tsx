import React, { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import CreateToken from "./components/CreateToken";
import Dashboard from "./components/Dashboard";
import MintBurn from "./components/MintBurn";
import Compliance from "./components/Compliance";
import RoleManager from "./components/RoleManager";

type TabId = "create" | "dashboard" | "mintburn" | "compliance" | "roles";

const TABS: { id: TabId; label: string }[] = [
  { id: "create", label: "Create Token" },
  { id: "dashboard", label: "Dashboard" },
  { id: "mintburn", label: "Mint / Burn" },
  { id: "compliance", label: "Compliance" },
  { id: "roles", label: "Roles" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("create");
  const [mintAddress, setMintAddress] = useState<string>("");

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">SSS Token Manager</h1>
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <WalletMultiButton />
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "create" && (
          <CreateToken onCreated={(addr) => { setMintAddress(addr); setActiveTab("dashboard"); }} />
        )}
        {activeTab === "dashboard" && <Dashboard mintAddress={mintAddress} />}
        {activeTab === "mintburn" && <MintBurn mintAddress={mintAddress} />}
        {activeTab === "compliance" && <Compliance mintAddress={mintAddress} />}
        {activeTab === "roles" && <RoleManager mintAddress={mintAddress} />}
      </main>
    </div>
  );
}
