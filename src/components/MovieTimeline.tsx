"use client";

import { useState } from "react";
import { PlotPoint } from "@/types/movie";

interface MovieTimelineProps {
  duration: number; // 电影总时长（分钟）
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
    <div className="w-full py-6">
      <h2 className="text-xl font-bold mb-4 flex items-center text-white">
        <span className="w-1 h-6 bg-yellow-500 mr-3 rounded"></span>
        剧情时间轴
      </h2>

      <div className="relative bg-gray-800/50 rounded-lg p-6">
        {/* 时间标签 */}
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>0</span>
          <span>{duration}分钟</span>
        </div>

        {/* 进度条背景 */}
        <div className="relative h-2 bg-gray-700 rounded-full mb-12 mx-2">
          {/* 节点 */}
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
                {/* 节点圆点 */}
                <button
                  onClick={() => handleNodeClick(point.id)}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 hover:scale-150 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-sm ${
                    isSelected
                      ? "bg-yellow-500 border-yellow-500 scale-150"
                      : "bg-white border-white hover:bg-yellow-400 hover:border-yellow-400"
                  }`}
                  aria-label={`${point.title} - ${point.timestamp}分钟`}
                />

                {/* 时间标签 */}
                <div
                  className={`absolute top-7 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap transition-colors duration-200 ${
                    isSelected ? "text-yellow-500 font-bold" : "text-gray-400"
                  }`}
                >
                  {point.timestamp}′
                </div>

                {/* 剧情卡片 */}
                {isSelected && (
                  <div
                    className="absolute top-14 left-1/2 -translate-x-1/2 z-10 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 animate-fadeIn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 三角箭头 (Border) */}
                    <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-gray-700"></div>
                    {/* 三角箭头 (Background) */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-gray-800"></div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-yellow-500 text-sm">
                          {point.title}
                        </h3>
                        <button
                          onClick={() => setSelectedPoint(null)}
                          className="text-gray-500 hover:text-white transition-colors"
                          aria-label="关闭"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">
                        {point.timestamp} 分钟
                      </p>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 提示文本 */}
        <p className="text-center text-sm text-gray-500 mt-4">
          点击时间轴上的节点查看剧情详情
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
