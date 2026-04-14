"use client"

import React, { useState } from "react";

interface MixerProps {
  onResult: (s: string) => void;
  regionSize: number;
  setRegionSize: (v: number) => void;
  regionInner: boolean;
  setRegionInner: (v: boolean) => void;
}

export default function MixerControls({
  onResult,
  regionSize,
  setRegionSize,
  regionInner,
  setRegionInner,
}: MixerProps) {
  const [magWeights, setMagWeights] = useState([100, 0, 0, 0]);
  const [phaseWeights, setPhaseWeights] = useState([100, 0, 0, 0]);
  const [targetPort, setTargetPort] = useState("1");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleMagChange = (index: number, value: number) => {
    const updated = [...magWeights];
    updated[index] = value;
    setMagWeights(updated);
  };

  const handlePhaseChange = (index: number, value: number) => {
    const updated = [...phaseWeights];
    updated[index] = value;
    setPhaseWeights(updated);
  };

  const runMixer = async () => {
    try {
      setIsLoading(true);
      setProgress(20);

      const reqBody = {
        ports: ["1", "2", "3", "4"],
        mag_weights: magWeights,
        phase_weights: phaseWeights,
        target_port: targetPort,
        region: {
          pct: regionSize,
          inner: regionInner,
        },
      };

      setProgress(50);

      const res = await fetch("http://127.0.0.1:8000/api/mixer/mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      setProgress(80);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Mix request failed");
      }

      const data = await res.json();

      if (data.mixed_image_b64) {
        onResult(`data:image/png;base64,${data.mixed_image_b64}`);
      }

      setProgress(100);
    } catch (err) {
      console.error("Mix failed", err);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 400);
    }
  };

  return (
    <div className="bg-[#0f0f10] border border-[#222] rounded-xl p-4 text-white shadow-md">
      <div className="text-sm font-bold tracking-widest uppercase mb-4">
        Mixer Config
      </div>

      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">
          Target Port
        </div>
        <select
          value={targetPort}
          onChange={(e) => setTargetPort(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm"
        >
          <option value="1">Output 1</option>
          <option value="2">Output 2</option>
        </select>
      </div>

      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">
          Magnitude Weights
        </div>

        {magWeights.map((w, i) => (
          <div key={`mag-${i}`} className="mb-4">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Image {i + 1} Magnitude</span>
              <span>{w}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={w}
              onChange={(e) => handleMagChange(i, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">
          Phase Weights
        </div>

        {phaseWeights.map((w, i) => (
          <div key={`phase-${i}`} className="mb-4">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Image {i + 1} Phase</span>
              <span>{w}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={w}
              onChange={(e) => handlePhaseChange(i, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-widest text-gray-400">
            Crop Config
          </div>

          <button
            type="button"
            onClick={() => setRegionInner(!regionInner)}
            className={`px-3 py-1 rounded text-[11px] font-bold tracking-widest uppercase ${
              regionInner
                ? "bg-cyan-500 text-black"
                : "bg-red-500 text-black"
            }`}
          >
            {regionInner ? "Inner Pass" : "Outer Pass"}
          </button>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={regionSize}
          onChange={(e) => setRegionSize(Number(e.target.value))}
          className={`w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer ${
            regionInner ? "accent-cyan-500" : "accent-red-500"
          }`}
        />

        <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-2">
          <span>0% (Point)</span>
          <span className="text-white">{regionSize}% Area</span>
          <span>100% (Full)</span>
        </div>
      </div>

      <button
        className="mt-2 w-full bg-white hover:bg-gray-200 text-black uppercase tracking-widest font-bold text-xs py-3 rounded transition-colors shadow disabled:opacity-50"
        onClick={runMixer}
        disabled={isLoading}
      >
        {isLoading ? "Mixing..." : "Run Mixer"}
      </button>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">
          Progress
        </div>
        <div className="w-full bg-[#222] rounded h-2 overflow-hidden">
          <div
            className="bg-cyan-400 h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-right text-[10px] text-gray-500 mt-1">
          {progress}%
        </div>
      </div>
    </div>
  );
}