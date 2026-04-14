"use client";
import React, { useState, useRef, useEffect } from "react";

interface ViewerProps {
  id: number;
  externalSrc?: string | null;
  regionSize?: number;
  regionInner?: boolean;
  regionOffset?: { x: number; y: number };
  setRegionOffset?: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
}

export default function ImageViewer({
  id,
  externalSrc,
  regionSize = 100,
  regionInner = true,
  regionOffset = { x: 0, y: 0 },
  setRegionOffset,
}: ViewerProps) {
  const [component, setComponent] = useState("magnitude");
  const [internalImageSrc, setInternalImageSrc] = useState<string | null>(null);

  const imageSrc = externalSrc !== undefined ? externalSrc : internalImageSrc;

  const [freqImgSrc, setFreqImgSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brightness / Contrast only for spatial image
  const [spatialBC, setSpatialBC] = useState({ b: 100, c: 100 });

  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startB: number;
    startC: number;
    target: "spatial" | null;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startB: 100,
    startC: 100,
    target: null,
  });

  const panRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent, target: "spatial") => {
    if (e.button !== 0) return;

    const bc = spatialBC;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startB: bc.b,
      startC: bc.c,
      target,
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging || !dragRef.current.target) return;

    const { startX, startY, startB, startC } = dragRef.current;

    const newC = Math.max(0, startC + (e.clientX - startX) * 0.5);
    const newB = Math.max(0, startB + (startY - e.clientY) * 0.5);

    setSpatialBC({ b: newB, c: newC });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      dragRef.current.target = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleRegionPanStart = (e: React.PointerEvent) => {
    if (e.button !== 0 || !setRegionOffset) return;

    panRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: regionOffset.x,
      startOffsetY: regionOffset.y,
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handleRegionPanMove = (e: React.PointerEvent) => {
    if (!panRef.current.dragging || !setRegionOffset) return;

    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;

    setRegionOffset({
      x: panRef.current.startOffsetX + dx,
      y: panRef.current.startOffsetY + dy,
    });
  };

  const handleRegionPanEnd = (e: React.PointerEvent) => {
    if (!panRef.current.dragging) return;

    panRef.current.dragging = false;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  const fetchComponent = async () => {
    if (!imageSrc && !internalImageSrc) return;

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
          fetchComponent();
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
          onPointerDown={(e) => handlePointerDown(e, "spatial")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`Spatial ${id}`}
              className="object-contain w-full h-full p-1 pointer-events-none"
              style={{
                filter: `brightness(${spatialBC.b}%) contrast(${spatialBC.c}%)`,
              }}
            />
          ) : (
            <span className="text-gray-500 text-xs text-center px-4 leading-relaxed group-hover/container:text-gray-400 transition-colors pointer-events-none">
              Double click <br />
              to upload
            </span>
          )}
        </div>

        {/* Frequency Display */}
        <div
          className="flex-1 flex items-center justify-center relative hover:bg-white/5 transition-colors overflow-hidden bg-[#0a0a0a] select-none"
          onPointerDown={handleRegionPanStart}
          onPointerMove={handleRegionPanMove}
          onPointerUp={handleRegionPanEnd}
          onPointerCancel={handleRegionPanEnd}
        >
          {freqImgSrc ? (
            <>
              <img
                src={freqImgSrc}
                alt={`Freq ${id}`}
                className="object-contain w-full h-full p-1 pointer-events-none z-0"
              />

              {regionSize < 100 && (
                <div
                  className={`absolute pointer-events-none z-10 ${
                    regionInner
                      ? "bg-cyan-500/20 shadow-[inset_0_0_0_2px_rgba(6,182,212,0.8)]"
                      : "outline outline-[9999px] outline-black/70 shadow-[inset_0_0_0_2px_rgba(239,68,68,0.8)]"
                  }`}
                  style={{
                    width: `${regionSize}%`,
                    height: `${regionSize}%`,
                    top: `calc(${(100 - regionSize) / 2}% + ${regionOffset.y}px)`,
                    left: `calc(${(100 - regionSize) / 2}% + ${regionOffset.x}px)`,
                  }}
                />
              )}
            </>
          ) : (
            <span className="text-gray-600 text-xs text-center px-4 font-mono pointer-events-none">
              {component} <br />
              render
            </span>
          )}
        </div>
      </div>
    </div>
  );
}