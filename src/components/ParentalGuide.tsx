'use client';

import { useState } from 'react';
import type {
  ParentalGuide as ParentalGuideType,
  GuideCategoryKey,
  GuideCategory,
} from '@/types/parentalGuide';

interface CategoryConfig {
  key: GuideCategoryKey;
  label: string;
  icon: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  { key: 'sex_nudity', label: '性与裸露', icon: '💋' },
  { key: 'violence_gore', label: '暴力与血腥', icon: '⚔️' },
  { key: 'profanity', label: '粗口', icon: '🗣️' },
  { key: 'alcohol_drugs_smoking', label: '酒精/毒品/吸烟', icon: '🍺' },
  { key: 'frightening_intense', label: '惊吓/紧张', icon: '😱' },
];

// Severity level styles - 90s color scheme
const SEVERITY_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string; barColor: string; barWidth: string }
> = {
  None: {
    label: '无',
    bgColor: '#808080',
    textColor: '#FFFFFF',
    barColor: '#808080',
    barWidth: '0%',
  },
  Mild: {
    label: '轻微',
    bgColor: '#00AA00',
    textColor: '#FFFFFF',
    barColor: '#00FF00',
    barWidth: '33%',
  },
  Moderate: {
    label: '中等',
    bgColor: '#FFCC00',
    textColor: '#000000',
    barColor: '#FFFF00',
    barWidth: '66%',
  },
  Severe: {
    label: '严重',
    bgColor: '#FF0000',
    textColor: '#FFFFFF',
    barColor: '#FF0000',
    barWidth: '100%',
  },
};

interface Props {
  guide: ParentalGuideType;
}

export default function ParentalGuide({ guide }: Props) {
  const [expandedCategory, setExpandedCategory] =
    useState<GuideCategoryKey | null>(null);

  const toggleCategory = (key: GuideCategoryKey) => {
    setExpandedCategory(expandedCategory === key ? null : key);
  };

  return (
    <div className="space-y-4">
      {/* Content rating badge - 90s style */}
      {guide.content_rating && (
        <div className="flex items-center gap-2">
          <span className="bevel-outset bg-[#FFFF00] px-3 py-1 font-bold text-black text-sm">
            ⚠️ {guide.content_rating_zh}
          </span>
        </div>
      )}

      {/* Category overview - table-like layout */}
      <div className="space-y-1">
        {CATEGORY_CONFIGS.map((config, index) => {
          const category = guide[config.key] as GuideCategory;
          if (!category) return null;

          const severityConfig =
            SEVERITY_CONFIG[category.severity] || SEVERITY_CONFIG.None;
          const isExpanded = expandedCategory === config.key;
          const hasItems = category.items && category.items.length > 0;

          return (
            <div
              key={config.key}
              className={`${index % 2 === 0 ? 'bg-[#FFFFFF]' : 'bg-[#E8E8E8]'} border-b-2 border-[#808080]`}
            >
              {/* Category header - clickable to expand */}
              <button
                onClick={() => hasItems && toggleCategory(config.key)}
                disabled={!hasItems}
                className={`w-full flex items-center justify-between p-3 text-left ${
                  hasItems
                    ? 'hover:bg-[#FFFFCC] cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{config.icon}</span>
                  <span className="font-bold text-sm">
                    {config.label}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Severity progress bar - 90s inset style */}
                  <div className="w-20 h-3 bevel-inset bg-[#808080] overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: severityConfig.barWidth,
                        backgroundColor: severityConfig.barColor,
                      }}
                    />
                  </div>

                  {/* Severity badge - 90s beveled */}
                  <span
                    className="bevel-outset px-2 py-0.5 text-xs font-bold min-w-[3rem] text-center"
                    style={{
                      backgroundColor: severityConfig.bgColor,
                      color: severityConfig.textColor,
                    }}
                  >
                    {severityConfig.label}
                  </span>

                  {/* Expand/collapse indicator */}
                  {hasItems && (
                    <span className="text-sm font-bold text-[#000080]">
                      {isExpanded ? '▼' : '►'}
                    </span>
                  )}
                </div>
              </button>

              {/* Detailed items list */}
              {isExpanded && hasItems && (
                <div className="px-4 pb-4 pt-2 bg-[#FFFFCC] border-t-2 border-[#808080]">
                  <ul className="space-y-2 pl-8">
                    {category.items_zh.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="text-sm leading-relaxed list-disc"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* IMDB link - 90s hyperlink style */}
      <div className="pt-2">
        <a
          href={guide.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-bold"
        >
          <span>► 查看 IMDB 完整家长指南</span>
          <span className="text-[#00FF00]">↗</span>
        </a>
      </div>
    </div>
  );
}
