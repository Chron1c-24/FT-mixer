"use client"
import React, { useState, useRef, useEffect } from "react";

interface ViewerProps {
  id: number;
  externalSrc?: string | null;
  regionSize?: number;
  regionInner?: boolean;
}

export default function ImageViewer({ id, externalSrc, regionSize = 100, regionInner = true }: ViewerProps) {
  const [component, setComponent] = useState("magnitude");
  const [internalImageSrc, setInternalImageSrc] = useState<string | null>(null);
  
  // Use externalSrc if providied, else use internal state
  const imageSrc = externalSrc !== undefined ? externalSrc : internalImageSrc;

  const [freqImgSrc, setFreqImgSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brightness/Contrast State
  const [spatialBC, setSpatialBC] = useState({ b: 100, c: 100 });
  const [freqBC, setFreqBC] = useState({ b: 100, c: 100 });

  const dragRef = useRef<{ isDragging: boolean, startX: number, startY: number, startB: number, startC: number, target: 'spatial' | 'freq' | null }>({
    isDragging: false, startX: 0, startY: 0, startB: 100, startC: 100, target: null
  });

  const handlePointerDown = (e: React.PointerEvent, target: 'spatial' | 'freq') => {
    if (e.button !== 0) return; // Only left click
    const bc = target === 'spatial' ? spatialBC : freqBC;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startB: bc.b,
      startC: bc.c,
      target
    };
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch(err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging || !dragRef.current.target) return;
    const { startX, startY, startB, startC, target } = dragRef.current;
    
    // Calculate new values (sensitivity: 0.5 units per pixel)
    const newC = Math.max(0, startC + (e.clientX - startX) * 0.5);
    const newB = Math.max(0, startB + (startY - e.clientY) * 0.5); // Moving mouse Up increases brightness
    
    if (target === 'spatial') setSpatialBC({ b: newB, c: newC });
    else setFreqBC({ b: newB, c: newC });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      dragRef.current.target = null;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(err) {}
    }
  };

  const fetchComponent = async () => {
    if (!imageSrc && !internalImageSrc) return; // Prevent if completely empty
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/mixer/component/${id}/${component}`);
      if (res.ok) {
        const data = await res.json();
        setFreqImgSrc(`data:image/png;base64,${data.image_b64}`);
      }
    } catch (err) {
      console.error("Failed to fetch component", err);
    }
  };

  // Sync refetch whenever the backend policy might have triggered an update
  // So we export a `triggerRefetch` method via useImperativeHandle? No, we can just use an event listener 
  // or simple component fetch polling, but the cleanest is just fetching when policy updates
  useEffect(() => {
    if (imageSrc) {
      fetchComponent();
    }
  }, [component, imageSrc]);

  useEffect(() => {
    const handler = () => fetchComponent();
    window.addEventListener("refresh_ports", handler);
    return () => window.removeEventListener("refresh_ports", handler);
  }, [imageSrc, component]);

  const handleDoubleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const objectUrl = URL.createObjectURL(file);
      setInternalImageSrc(objectUrl);
      
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/mixer/upload/${id}`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
           console.log("Uploaded successfully to port", id);
           fetchComponent(); // Ensure it fetches upon upload
        }
      } catch (err) {
        console.error("Backend not running or failed", err);
      }
    }
  };

  return (
    <div className="bg-[#111] rounded-lg border border-[#222] flex flex-col overflow-hidden shadow-xl h-full group hover:border-[#333] transition-all">
      <div className="bg-[#181818] p-2 border-b border-[#222] font-semibold text-xs text-gray-300 flex justify-between items-center z-10 relative">
        <span className="tracking-widest uppercase ml-1">Image {id}</span>
        <select 
          className="bg-[#111] text-gray-200 px-2 py-1 rounded text-xs border border-[#333] outline-none hover:border-[#555] focus:border-[#777] transition-colors"
          value={component}
          onChange={(e) => setComponent(e.target.value)}
        >
          <option value="magnitude">FT Magnitude</option>
          <option value="phase">FT Phase</option>
          <option value="real">FT Real</option>
          <option value="imaginary">FT Imaginary</option>
        </select>
      </div>

      <div className="flex-1 flex overflow-hidden relative cursor-pointer group/container">
        {/* Hidden input */}
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
        />

        {/* Spatial Display */}
        <div 
          className="flex-1 flex items-center justify-center border-r border-[#222] border-dashed relative hover:bg-white/5 transition-colors overflow-hidden select-none"
          onDoubleClick={handleDoubleClick}
          onPointerDown={(e) => handlePointerDown(e, 'spatial')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
           {imageSrc ? (
             <img 
               src={imageSrc} 
               alt={`Spatial ${id}`} 
               className="object-contain w-full h-full p-1 pointer-events-none" 
               style={{ filter: `brightness(${spatialBC.b}%) contrast(${spatialBC.c}%)` }} 
             />
           ) : (
             <span className="text-gray-500 text-xs text-center px-4 leading-relaxed group-hover/container:text-gray-400 transition-colors pointer-events-none">Double click <br/>to upload</span>
           )}
        </div>

        {/* Frequency Display */}
        <div 
          className="flex-1 flex items-center justify-center relative hover:bg-white/5 transition-colors overflow-hidden bg-[#0a0a0a] select-none"
          onPointerDown={(e) => handlePointerDown(e, 'freq')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
           {freqImgSrc ? (
             <>
               <img 
                 src={freqImgSrc} 
                 alt={`Freq ${id}`} 
                 className="object-contain w-full h-full p-1 pointer-events-none z-0" 
                 style={{ filter: `brightness(${freqBC.b}%) contrast(${freqBC.c}%)` }} 
               />
               {/* Unified Region Select Overlay */}
               {regionSize < 100 && (
                 <div 
                   className={`absolute pointer-events-none transition-all z-10 ${regionInner ? 'bg-cyan-500/20 shadow-[inset_0_0_0_2px_rgba(6,182,212,0.8)]' : 'outline outline-[9999px] outline-black/70 shadow-[inset_0_0_0_2px_rgba(239,68,68,0.8)]'}`}
                   style={{
                     width: `${regionSize}%`,
                     height: `${regionSize}%`,
                     top: `${(100 - regionSize) / 2}%`,
                     left: `${(100 - regionSize) / 2}%`,
                   }}
                 />
               )}
             </>
           ) : (
             <span className="text-gray-600 text-xs text-center px-4 font-mono pointer-events-none">{component} <br/>render</span>
           )}
        </div>
      </div>
    </div>
  )
}
