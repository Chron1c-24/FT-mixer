"use client"
import React, { useState } from "react";
import ImageViewer from "./ImageViewer";

export default function Emphasizer() {
  const [action, setAction] = useState("shift");
  const [domain, setDomain] = useState("spatial"); // "spatial" or "frequency" applies action on
  const [resultImg, setResultImg] = useState<string | null>(null);

  const handleCompute = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/emphasizer/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: "5", action, domain })
      });
      if (res.ok) {
        const data = await res.json();
        setResultImg(`data:image/png;base64,${data.spatial_b64}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex w-full h-full gap-6 font-sans text-gray-300">
      {/* Left side: Action Controls */}
      <div className="w-[320px] flex flex-col gap-5 bg-[#111] border border-[#222] rounded-xl p-5 shadow-xl overflow-y-auto">
        <h3 className="font-semibold text-sm tracking-wide text-white uppercase border-b border-[#333] pb-3">Properties Emphasizer</h3>
        
        <div className="flex flex-col gap-2 text-xs">
          <label className="font-medium text-gray-400 uppercase tracking-widest">Target Action</label>
          <select 
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="bg-[#0a0a0a] text-white border border-[#444] rounded p-2 outline-none focus:border-white transition-colors"
          >
            <option value="shift">Shift Image</option>
            <option value="multiply_exp">Multiply by Complex Exp</option>
            <option value="stretch">Stretch</option>
            <option value="mirror">Mirror Symmetry</option>
            <option value="even_odd">Even / Odd</option>
            <option value="rotate">Rotate</option>
            <option value="differentiate">Differentiate</option>
            <option value="integrate">Integrate</option>
            <option value="window">Multiply 2D Window</option>
            <option value="multiple_ft">Take Fourier Multiple Times</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 text-xs mt-2">
          <label className="font-medium text-gray-400 uppercase tracking-widest">Apply Action On</label>
          <div className="flex gap-2">
            <button 
              className={`flex-1 py-1.5 px-2 rounded border uppercase tracking-wider font-semibold transition-colors ${domain === 'spatial' ? 'bg-white border-white text-black' : 'bg-[#181818] border-[#333] text-gray-400 hover:bg-[#222]'}`}
              onClick={() => setDomain('spatial')}
            >
              Spatial
            </button>
            <button 
              className={`flex-1 py-1.5 px-2 rounded border uppercase tracking-wider font-semibold transition-colors ${domain === 'frequency' ? 'bg-white border-white text-black' : 'bg-[#181818] border-[#333] text-gray-400 hover:bg-[#222]'}`}
              onClick={() => setDomain('frequency')}
            >
              Frequency
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 border border-[#333] border-dashed rounded text-center text-xs text-gray-500 font-mono">
          [Parameters for {action}]
        </div>

        <div className="mt-auto pt-6">
          <button 
            className="w-full bg-white hover:bg-gray-200 text-black uppercase tracking-widest font-bold text-xs py-3 rounded transition-colors shadow"
            onClick={handleCompute}
           >
            Compute {action}
          </button>
        </div>
      </div>

      {/* Right side: 2 Viewports (Input Sequence & Result Sequence) */}
      <div className="flex-1 grid grid-cols-1 grid-rows-2 gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1">Original Domain</span>
          <ImageViewer id={5} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1">Transformed Domain</span>
          <ImageViewer id={6} externalSrc={resultImg} />
        </div>
      </div>
    </div>
  )
}
