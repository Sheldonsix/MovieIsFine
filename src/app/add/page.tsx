"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Link as LinkIcon,
  AlertCircle,
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { addMovie, AddMovieResult } from "./actions";

/**
 * 校验豆瓣电影链接格式
 * 有效格式: https://movie.douban.com/subject/1482072/ 或 https://movie.douban.com/subject/1482072
 */
function validateDoubanUrl(url: string): { valid: boolean; message: string } {
  if (!url.trim()) {
    return { valid: true, message: "" }; // 空输入不显示错误
  }

  const doubanPattern = /^https?:\/\/movie\.douban\.com\/subject\/\d+\/?$/;

  if (!doubanPattern.test(url.trim())) {
    return {
      valid: false,
      message:
        "请输入有效的豆瓣电影链接，格式如：https://movie.douban.com/subject/1482072/",
    };
  }

  return { valid: true, message: "" };
}

export default function AddMoviePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [validation, setValidation] = useState<{
    valid: boolean;
    message: string;
  }>({
    valid: true,
    message: "",
  });
  const [isFocused, setIsFocused] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AddMovieResult | null>(null);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    // 实时校验
    const validationResult = validateDoubanUrl(value);
    setValidation(validationResult);
    // 清除之前的结果
    if (result) {
      setResult(null);
    }
  };

  const handleSubmit = () => {
    const validationResult = validateDoubanUrl(url);
    setValidation(validationResult);

    if (!validationResult.valid || !url.trim()) {
      if (!url.trim()) {
        setValidation({
          valid: false,
          message: "请输入豆瓣电影链接",
        });
      }
      return;
    }

    // 调用 Server Action
    startTransition(async () => {
      const actionResult = await addMovie(url);
      setResult(actionResult);

      // 成功后清空输入框
      if (actionResult.success) {
        setUrl("");
      }
    });
  };

  const handleGoToMovie = () => {
    if (result?.movie?.doubanId) {
      router.push(`/movie/${result.movie.doubanId}`);
    }
  };

  const isValidUrl = validation.valid && url.trim().length > 0;

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* 返回首页导航 */}
      <nav className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
        <Link
          href="/"
          className="flex items-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          返回首页
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-2xl dark:shadow-teal-900/20">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-soft-light"></div>
          <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-900/20 blur-3xl"></div>
        </div>

        <div className="relative z-10 px-8 py-20 md:py-28 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-md">
            添加新电影
          </h1>
          <p className="text-lg md:text-2xl text-emerald-100 max-w-2xl mx-auto font-medium">
            输入豆瓣电影链接，快速添加电影信息
          </p>
        </div>
      </section>

      {/* Add Movie Form Section */}
      <section className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl dark:shadow-gray-900/30 p-8 border border-gray-100 dark:border-gray-700/50">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <LinkIcon className="w-6 h-6 text-teal-500" />
            豆瓣电影链接
          </h2>

          {/* 输入区域 */}
          <div className="space-y-4">
            <div className="relative">
              <div
                className={`
                  flex items-stretch rounded-xl border-2 transition-all duration-300
                  ${
                    !validation.valid
                      ? "border-red-400 dark:border-red-500"
                      : isFocused
                        ? "border-teal-500 dark:border-teal-400 shadow-lg shadow-teal-500/10"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }
                  bg-white dark:bg-gray-800
                  ${isPending ? "opacity-75" : ""}
                `}
              >
                {/* 输入框 */}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidUrl && !isPending) {
                      handleSubmit();
                    }
                  }}
                  placeholder="https://movie.douban.com/subject/1482072/"
                  disabled={isPending}
                  className="
                    flex-1 px-4 py-4 pr-10 rounded-l-xl
                    bg-transparent
                    text-gray-900 dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none
                    text-base
                    disabled:cursor-not-allowed
                  "
                />

                {/* 添加按钮 */}
                <button
                  onClick={handleSubmit}
                  className={`
                    px-6 flex items-center gap-2 rounded-r-xl font-medium transition-all duration-300
                    ${
                      isValidUrl && !isPending
                        ? "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    }
                  `}
                  disabled={!isValidUrl || isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="hidden sm:inline">添加中...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span className="hidden sm:inline">添加</span>
                    </>
                  )}
                </button>
              </div>

              {/* 验证状态图标 */}
              {url.trim() && !isPending && (
                <div className="absolute right-[calc(4rem+theme(spacing.6)+theme(spacing.2))] sm:right-[calc(5rem+theme(spacing.6)+theme(spacing.4))] top-1/2 -translate-y-1/2">
                  {validation.valid ? (
                    <Check className="w-5 h-5 text-emerald-500 animate-in zoom-in duration-200" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 animate-in zoom-in duration-200" />
                  )}
                </div>
              )}
            </div>

            {/* 错误提示 */}
            {!validation.valid && (
              <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm animate-in slide-in-from-top-2 fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validation.message}</span>
              </div>
            )}

            {/* 提示信息 */}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              支持格式：https://movie.douban.com/subject/豆瓣电影ID/
            </p>
          </div>

          {/* 结果提示 */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
                result.success
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      result.success
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-red-700 dark:text-red-300"
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.movie && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      《{result.movie.title}》
                      {result.movie.originalTitle &&
                        ` (${result.movie.originalTitle})`}
                    </p>
                  )}
                  {result.error && !result.movie && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {result.error}
                    </p>
                  )}
                  {result.success && result.movie?.doubanId && (
                    <button
                      onClick={handleGoToMovie}
                      className="mt-3 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      查看电影详情 →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-8 p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            如何获取豆瓣电影链接？
          </h3>
          <ol className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-sm font-medium flex items-center justify-center">
                1
              </span>
              <span>打开豆瓣电影网站 (movie.douban.com)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-sm font-medium flex items-center justify-center">
                2
              </span>
              <span>搜索并进入想要添加的电影详情页</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-sm font-medium flex items-center justify-center">
                3
              </span>
              <span>复制浏览器地址栏中的链接并粘贴到上方输入框</span>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
