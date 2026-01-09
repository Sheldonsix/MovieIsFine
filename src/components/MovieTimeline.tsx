"use client";

import { useState } from "react";
import { PlotPoint } from "@/types/movie";

interface MovieTimelineProps {
  duration: number; // Total movie duration (minutes)
  plotPoints: PlotPoint[];
}

export default function MovieTimeline({
  duration,
  plotPoints,
}: MovieTimelineProps) {
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);

  const handleNodeClick = (pointId: string) => {
    setSelectedPoint(selectedPoint === pointId ? null : pointId);
  };

  return (
    <div className="w-full py-4">
      {/* 90s style header */}
      <h2 className="heading-90s text-lg mb-4 flex items-center">
        <span className="inline-block w-4 h-4 bg-[#FFFF00] bevel-outset mr-2"></span>
        剧情时间轴
      </h2>

      <div className="panel-90s p-4">
        {/* Time labels */}
        <div className="flex justify-between text-sm font-bold mb-2 mono-90s">
          <span>0</span>
          <span>{duration}分钟</span>
        </div>

        {/* Progress bar - 90s inset style */}
        <div className="relative h-4 bevel-inset bg-[#808080] mb-16 mx-2">
          {/* Nodes */}
          {plotPoints.map((point) => {
            const position = (point.timestamp / duration) * 100;
            const isSelected = selectedPoint === point.id;

            return (
              <div
                key={point.id}
                className={`absolute top-1/2 ${
                  isSelected ? "z-30" : "z-10 hover:z-20"
                }`}
                style={{
                  left: `${position}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                {/* Node button - 90s beveled style */}
                <button
                  onClick={() => handleNodeClick(point.id)}
                  className={`w-5 h-5 bevel-outset focus-90s ${
                    isSelected
                      ? "bg-[#FFFF00]"
                      : "bg-[#00FF00] hover:bg-[#FFFF00]"
                  }`}
                  aria-label={`${point.title} - ${point.timestamp}分钟`}
                />

                {/* Time label */}
                <div
                  className={`absolute top-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap mono-90s font-bold ${
                    isSelected ? "text-[#FF0000]" : "text-[#000080]"
                  }`}
                >
                  {point.timestamp}′
                </div>

                {/* Plot card - Windows 95 window style */}
                {isSelected && (
                  <div
                    className="absolute top-14 left-1/2 -ml-32 z-10 w-64 window-90s"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Title bar */}
                    <div className="win95-titlebar text-xs flex items-center justify-between">
                      <span>📋 {point.title}</span>
                      <button
                        onClick={() => setSelectedPoint(null)}
                        className="btn-90s px-1.5 py-0 text-xs"
                        aria-label="关闭"
                      >
                        ×
                      </button>
                    </div>

                    {/* Content */}
                    <div className="panel-90s-content p-3 space-y-2">
                      <p className="text-xs text-[#808080] mono-90s">
                        ⏱️ {point.timestamp} 分钟
                      </p>
                      <p className="text-sm leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Help text */}
        <p className="text-center text-sm font-bold text-[#808080] mt-4">
          ► 点击时间轴上的节点查看剧情详情 ◄
        </p>
      </div>
    </div>
  );
}
