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

// 严重程度对应的样式和中文
const SEVERITY_CONFIG: Record<
  string,
  { label: string; bgClass: string; textClass: string; barClass: string }
> = {
  None: {
    label: '无',
    bgClass: 'bg-gray-100 dark:bg-gray-700',
    textClass: 'text-gray-600 dark:text-gray-400',
    barClass: 'bg-gray-400',
  },
  Mild: {
    label: '轻微',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    barClass: 'bg-green-500',
  },
  Moderate: {
    label: '中等',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    textClass: 'text-yellow-700 dark:text-yellow-400',
    barClass: 'bg-yellow-500',
  },
  Severe: {
    label: '严重',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    barClass: 'bg-red-500',
  },
};

// 严重程度对应的进度条宽度
const SEVERITY_WIDTH: Record<string, string> = {
  None: 'w-0',
  Mild: 'w-1/3',
  Moderate: 'w-2/3',
  Severe: 'w-full',
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
      {/* 内容分级标签 */}
      {guide.content_rating && (
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg font-medium">
            {guide.content_rating_zh}
          </span>
        </div>
      )}

      {/* 各类别概览 */}
      <div className="grid gap-3">
        {CATEGORY_CONFIGS.map((config) => {
          const category = guide[config.key] as GuideCategory;
          if (!category) return null;

          const severityConfig =
            SEVERITY_CONFIG[category.severity] || SEVERITY_CONFIG.None;
          const isExpanded = expandedCategory === config.key;
          const hasItems = category.items && category.items.length > 0;

          return (
            <div
              key={config.key}
              className="bg-gray-50 dark:bg-gray-700/30 rounded-xl overflow-hidden"
            >
              {/* 类别头部 - 可点击展开 */}
              <button
                onClick={() => hasItems && toggleCategory(config.key)}
                disabled={!hasItems}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                  hasItems
                    ? 'hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{config.icon}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {config.label}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* 严重程度进度条 */}
                  <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${severityConfig.barClass} ${SEVERITY_WIDTH[category.severity]} transition-all duration-300`}
                    />
                  </div>

                  {/* 严重程度标签 */}
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${severityConfig.bgClass} ${severityConfig.textClass}`}
                  >
                    {severityConfig.label}
                  </span>

                  {/* 展开/收起箭头 */}
                  {hasItems && (
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </div>
              </button>

              {/* 详细条目列表 */}
              {isExpanded && hasItems && (
                <div className="px-4 pb-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <ul className="space-y-2 pl-10">
                    {category.items_zh.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed list-disc"
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

      {/* IMDB 链接 */}
      <div className="pt-2">
        <a
          href={guide.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>查看 IMDB 完整家长指南</span>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
