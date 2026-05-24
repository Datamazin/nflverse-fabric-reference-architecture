"use client";

import React from "react";
import { useAuth } from "./AuthProvider";

export function SplashScreen() {
  const { signIn } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="text-center max-w-lg">
        <div className="text-6xl mb-6">🏈</div>
        <h1 className="text-4xl font-bold text-white mb-3">
          NFL Data Agent
        </h1>
        <p className="text-lg text-blue-200 mb-8 leading-relaxed">
          Ask natural language questions about NFL play-by-play data, team
          performance, player stats, and more — powered by Microsoft Fabric
          Data Agents.
        </p>
        <button
          onClick={signIn}
          className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg shadow-lg shadow-blue-600/30 transition-all hover:shadow-blue-500/40 hover:scale-105"
        >
          Sign In to Get Started
        </button>
        <p className="text-sm text-slate-400 mt-6">
          Requires a Microsoft organizational account
        </p>
      </div>
    </div>
  );
}
