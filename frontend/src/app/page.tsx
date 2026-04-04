"use client"
import { useState } from "react";
import ImageViewer from "@/components/ImageViewer";
import MixerControls from "@/components/MixerControls";
import Emphasizer from "@/components/Emphasizer";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"mixer" | "emphasizer">("mixer");
  const [mixedImage, setMixedImage] = useState<string | null>(null);

  // Region bounds across all viewports
  const [regionSize, setRegionSize] = useState(100);
  const [regionInner, setRegionInner] = useState(true);

  return (
    <div className="flex flex-col flex-1 h-full font-sans bg-[#09090b]">
      {/* Tab Navigation */}
      <div className="flex bg-[#0f0f11] border-b border-[#222] shrink-0 px-4 pt-2 gap-2">
        <button 
          className={`px-6 py-3 font-semibold text-xs tracking-wider uppercase transition-all duration-300 rounded-t-lg ${activeTab === 'mixer' ? 'text-white bg-[#1a1a1c] border-t border-l border-r border-[#333]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'}`}
          onClick={() => setActiveTab('mixer')}
        >
          FT Mixer
        </button>
        <button 
          className={`px-6 py-3 font-semibold text-xs tracking-wider uppercase transition-all duration-300 rounded-t-lg ${activeTab === 'emphasizer' ? 'text-white bg-[#1a1a1c] border-t border-l border-r border-[#333]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'}`}
          onClick={() => setActiveTab('emphasizer')}
        >
          Properties Emphasizer
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden bg-[#09090b] p-6">
        {activeTab === "mixer" && (
          <div className="flex w-full h-full gap-6">
            {/* Left side: Viewports */}
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-6">
              {[1, 2, 3, 4].map(id => (
                <ImageViewer 
                   key={id} id={id} 
                   regionSize={regionSize} 
                   regionInner={regionInner} 
                />
              ))}
            </div>
            
            {/* Right side: Controls and Output */}
            <div className="w-[380px] flex flex-col gap-6">
              <div className="bg-[#111] rounded-lg border border-[#222] p-5 shadow-xl flex flex-col gap-3">
                <h3 className="font-semibold text-sm tracking-wide text-white uppercase border-b border-[#333] pb-3">Mixer Config</h3>
                <MixerControls 
                   onResult={(src) => setMixedImage(src)} 
                   regionSize={regionSize} setRegionSize={setRegionSize}
                   regionInner={regionInner} setRegionInner={setRegionInner}
                />
              </div>

              <div className="flex-1 bg-[#111] rounded-lg border border-[#222] flex flex-col overflow-hidden shadow-xl">
                <div className="bg-[#181818] p-3 border-b border-[#333] font-medium text-xs tracking-widest uppercase text-white flex justify-between items-center">
                  <span>Output Viewport</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-gray-700 bg-black/40 overflow-hidden relative">
                  {mixedImage ? (
                    <img src={mixedImage} alt="Mixed Result" className="w-full h-full object-contain p-2" />
                  ) : (
                    <span>Mixer Result</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "emphasizer" && (
          <Emphasizer />
        )}
      </div>
    </div>
  );
}
