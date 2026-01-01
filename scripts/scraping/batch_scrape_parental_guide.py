#!/usr/bin/env python3
"""
批量爬取所有电影的 IMDB 家长指南信息

Usage:
    python batch_scrape_parental_guide.py
    python batch_scrape_parental_guide.py --delay 5
    python batch_scrape_parental_guide.py --start-index 50
"""

import json
import os
import random
import re
import time
from pathlib import Path

from imdb_parental_guide_scraper import IMDBParentalGuideScraper, save_to_json


def extract_imdb_ids_from_movies_ts(file_path: str) -> list[str]:
    """从 movies.ts 提取所有 imdbId"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配所有 imdbId
    pattern = r'"imdbId":\s*"(tt\d+)"'
    return re.findall(pattern, content)


def batch_scrape(
    imdb_ids: list[str],
    output_dir: str,
    delay: float = 3.0,
    start_index: int = 0,
    checkpoint_file: str = "checkpoint.json"
):
    """
    批量爬取家长指南

    Args:
        imdb_ids: IMDb ID 列表
        output_dir: 输出目录
        delay: 请求间隔（避免被封）
        start_index: 起始索引（用于断点续爬）
        checkpoint_file: 检查点文件
    """
    os.makedirs(output_dir, exist_ok=True)
    scraper = IMDBParentalGuideScraper(timeout=30, max_retries=3)

    results = []
    failed = []

    # 加载已有的检查点
    checkpoint_path = os.path.join(output_dir, checkpoint_file)
    if os.path.exists(checkpoint_path) and start_index == 0:
        with open(checkpoint_path, 'r', encoding='utf-8') as f:
            checkpoint = json.load(f)
            start_index = checkpoint.get('last_index', 0) + 1
            results = checkpoint.get('results', [])
            failed = checkpoint.get('failed', [])
            print(f"从检查点恢复，起始索引: {start_index}")

    total = len(imdb_ids)

    for i, imdb_id in enumerate(imdb_ids[start_index:], start=start_index):
        print(f"\n[{i + 1}/{total}] 正在爬取: {imdb_id}")

        try:
            guide = scraper.scrape(imdb_id)

            if guide:
                # 保存单个文件
                output_path = os.path.join(output_dir, f"{imdb_id}_parental_guide.json")
                save_to_json(guide, output_path)
                results.append({
                    "imdb_id": imdb_id,
                    "status": "success",
                    "title": guide.title
                })
                print(f"✓ 成功: {guide.title}")
            else:
                failed.append({"imdb_id": imdb_id, "error": "scrape returned None"})
                print(f"✗ 失败: {imdb_id}")

        except Exception as e:
            failed.append({"imdb_id": imdb_id, "error": str(e)})
            print(f"✗ 异常: {imdb_id} - {e}")

        # 保存检查点（每10个保存一次）
        if (i + 1) % 10 == 0:
            with open(checkpoint_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "last_index": i,
                    "results": results,
                    "failed": failed
                }, f, ensure_ascii=False, indent=2)
            print(f"💾 检查点已保存 ({i + 1}/{total})")

        # 随机化请求间隔，避免被检测
        if i < total - 1:
            actual_delay = delay + random.uniform(0, 2)
            time.sleep(actual_delay)

    # 保存最终结果汇总
    summary_path = os.path.join(output_dir, "scrape_summary.json")
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            "total": total,
            "success": len(results),
            "failed_count": len(failed),
            "failed": failed
        }, f, ensure_ascii=False, indent=2)

    # 清理检查点文件
    if os.path.exists(checkpoint_path):
        os.remove(checkpoint_path)

    print(f"\n{'=' * 50}")
    print(f"爬取完成！成功: {len(results)}, 失败: {len(failed)}")
    print(f"结果保存在: {output_dir}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="批量爬取 IMDB 家长指南")
    parser.add_argument(
        "--movies-file",
        default="../src/data/movies.ts",
        help="movies.ts 文件路径 (默认: ../src/data/movies.ts)"
    )
    parser.add_argument(
        "--output-dir",
        default="./parental_guides",
        help="输出目录 (默认: ./parental_guides)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=3.0,
        help="请求间隔秒数，建议 3-5 秒 (默认: 3.0)"
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="起始索引，用于手动断点续爬 (默认: 0)"
    )
    args = parser.parse_args()

    # 获取脚本目录
    script_dir = Path(__file__).parent.absolute()
    movies_path = script_dir / args.movies_file
    output_dir = script_dir / args.output_dir

    # 检查 movies.ts 是否存在
    if not movies_path.exists():
        print(f"错误: 找不到文件 {movies_path}")
        exit(1)

    # 提取 IMDb IDs
    imdb_ids = extract_imdb_ids_from_movies_ts(str(movies_path))
    print(f"找到 {len(imdb_ids)} 部电影")

    if not imdb_ids:
        print("错误: 未找到任何 imdbId")
        exit(1)

    # 显示预估时间
    estimated_time = len(imdb_ids) * (args.delay + 1)  # 加上随机延迟和处理时间
    print(f"预估耗时: {estimated_time / 60:.1f} 分钟")
    print(f"输出目录: {output_dir}")
    print("-" * 50)

    # 开始批量爬取
    batch_scrape(
        imdb_ids=imdb_ids,
        output_dir=str(output_dir),
        delay=args.delay,
        start_index=args.start_index
    )


if __name__ == "__main__":
    main()
