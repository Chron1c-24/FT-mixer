"use client"

import React, { useState } from "react";

interface MixerProps {
  onResult: (s: string) => void;
  regionSize: number;
  setRegionSize: (v: number) => void;
  regionInner: boolean;
  setRegionInner: (v: boolean) => void;
}

export default function MixerControls({ onResult, regionSize, setRegionSize, regionInner, setRegionInner }: MixerProps) {
  // Simple state for sliders: Weight for each image (0 - 100)
  const [weights, setWeights] = useState([25, 25, 25, 25]);
  const [port, setPort] = useState(1);

  return (
    <div className="flex flex-col gap-5 text-sm text-gray-300 mt-2">
      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#222]">
        <select 
          onChange={async (e) => {
            await fetch("http://127.0.0.1:8000/api/mixer/policy", {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ size_mode: e.target.value, keep_aspect: false })
            });
            window.dispatchEvent(new Event("refresh_ports"));
          }}
          className="bg-[#0a0a0a] text-white px-2 py-2 rounded text-xs border border-[#444] outline-none"
        >
          <option value="smallest">Size: Smallest</option>
          <option value="largest">Size: Largest</option>
          <option value="fixed">Size: Fixed (512)</option>
        </select>
        
        <select 
          onChange={async (e) => {
            const keep = e.target.value === "true";
            await fetch("http://127.0.0.1:8000/api/mixer/policy", {
               method: "POST", headers: { "Content-Type": "application/json" },
               // Pass smallest as default context for now, or real state. 
               // For minimal implementation we pass the basic object.
               body: JSON.stringify({ size_mode: "smallest", keep_aspect: keep })
            });
            window.dispatchEvent(new Event("refresh_ports"));
          }}
          className="bg-[#0a0a0a] text-white px-2 py-2 rounded text-xs border border-[#444] outline-none"
        >
          <option value="false">Aspect: Ignore</option>
          <option value="true">Aspect: Preserve</option>
        </select>
      </div>

      <div className="flex justify-between items-center bg-[#181818] p-3 rounded border border-[#333]">
        <label className="font-medium text-xs uppercase tracking-wide">Target Port</label>
        <select 
          value={port} 
          onChange={(e) => setPort(Number(e.target.value))}
          className="bg-[#0a0a0a] text-white px-2 py-1 rounded text-xs border border-[#444] outline-none"
        >
          <option value={1}>Output 1</option>
          <option value={2}>Output 2</option>
        </select>
      </div>

      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4].map((id, idx) => (
          <div key={id} className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-mono">Image {id} Weight</span>
              <span className="text-white font-mono bg-[#222] px-2 py-0.5 rounded">{weights[idx]}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" 
              value={weights[idx]}
              onChange={(e) => {
                const newWeights = [...weights];
                newWeights[idx] = Number(e.target.value);
                setWeights(newWeights);
              }}
              className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 pt-3 border-t border-[#222]">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-mono uppercase tracking-widest">Crop Config</span>
          <button 
            className={`px-3 py-1 font-bold rounded uppercase tracking-wider text-[10px] ${regionInner ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-800' : 'bg-red-500/20 text-red-400 border border-red-800'}`}
            onClick={() => setRegionInner(!regionInner)}
          >
            {regionInner ? 'Inner Pass' : 'Outer Pass'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <input 
            type="range" 
            min="0" max="100" 
            value={regionSize}
            onChange={(e) => setRegionSize(Number(e.target.value))}
            className={`w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer ${regionInner ? 'accent-cyan-500' : 'accent-red-500'}`}
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>0% (Point)</span>
            <span className="text-white">{regionSize}% Area</span>
            <span>100% (Full)</span>
          </div>
        </div>
      </div>

      <button 
        className="mt-6 w-full bg-white hover:bg-gray-200 text-black uppercase tracking-widest font-bold text-xs py-3 rounded transition-colors shadow"
        onClick={async () => {
          try {
            const reqBody = {
              ports: ["1", "2", "3", "4"],
              weights: weights.map(w => ({ mag: w, phase: w })),
              region: { pct: regionSize, inner: regionInner }
            };
            const res = await fetch("http://127.0.0.1:8000/api/mixer/mix", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(reqBody)
            });
            if (res.ok) {
              const data = await res.json();
              onResult(`data:image/png;base64,${data.mixed_image_b64}`);
            }
          } catch (err) {
            console.error("Mix failed", err);
          }
        }}
      >
        Run Mixer
      </button>

      <div className="flex flex-col gap-1 mt-4">
        <div className="flex justify-between text-xs text-gray-500 font-mono tracking-widest uppercase">
          <span>Progress</span>
          <span>0%</span>
        </div>
        <div className="w-full bg-[#222] rounded-full h-1">
          <div className="bg-white h-1 rounded-full" style={{ width: "0%" }}></div>
        </div>
      </div>
    </div>
  )
}
