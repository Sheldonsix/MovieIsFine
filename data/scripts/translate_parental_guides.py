#!/usr/bin/env python3
"""
家长指南翻译脚本
使用 OpenAI 格式 API 将 parental_guides 中的英文内容翻译为中文
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

# 延迟导入 openai，允许 --dry-run 和 --help 在未安装时使用
OpenAI = None


def ensure_openai():
    """确保 openai 库已安装"""
    global OpenAI
    if OpenAI is None:
        try:
            from openai import OpenAI as _OpenAI

            OpenAI = _OpenAI
        except ImportError:
            print("请先安装 openai 库: pip install openai")
            sys.exit(1)


# 需要翻译的类别
CATEGORIES = [
    "sex_nudity",
    "violence_gore",
    "profanity",
    "alcohol_drugs_smoking",
    "frightening_intense",
]

# 翻译提示词
SYSTEM_PROMPT = """你是一个专业的电影内容翻译专家。请将以下电影家长指南内容从英文翻译成简体中文。

要求：
1. 保持原文的语气和表达方式
2. 专业术语使用电影行业常用译法
3. 翻译要准确、自然、流畅
4. 保持原文的分条格式，每条翻译对应原文的一条
5. 只返回翻译结果，不要添加额外的解释或编号"""


def create_client(api_base: str, api_key: str) -> OpenAI:
    """创建 OpenAI 客户端"""
    return OpenAI(base_url=api_base, api_key=api_key)


def translate_items(
    client: OpenAI,
    items: list[str],
    model: str,
    max_retries: int = 3,
) -> Optional[list[str]]:
    """翻译 items 列表"""
    if not items:
        return []

    # 构建翻译请求
    items_text = "\n---\n".join(items)
    user_prompt = f"请翻译以下{len(items)}条内容，每条用 --- 分隔：\n\n{items_text}"

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )

            translated_text = response.choices[0].message.content.strip()
            translated_items = [
                item.strip() for item in translated_text.split("---") if item.strip()
            ]

            # 验证翻译数量是否匹配
            if len(translated_items) != len(items):
                print(
                    f"  警告: 翻译数量不匹配 (原文 {len(items)} 条, 翻译 {len(translated_items)} 条)"
                )
                # 尝试修复：如果翻译少了，用原文补齐；如果多了，截断
                if len(translated_items) < len(items):
                    translated_items.extend(items[len(translated_items) :])
                else:
                    translated_items = translated_items[: len(items)]

            return translated_items

        except Exception as e:
            print(f"  翻译失败 (尝试 {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** (attempt + 1))  # 指数退避

    return None


def translate_file(
    client: OpenAI,
    file_path: Path,
    model: str,
    force: bool = False,
    delay: float = 0.5,
) -> bool:
    """翻译单个文件"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  读取文件失败: {e}")
        return False

    # 检查是否已翻译
    if not force:
        has_translation = any(
            cat in data and "items_zh" in data[cat] and data[cat]["items_zh"]
            for cat in CATEGORIES
        )
        if has_translation:
            print(f"  跳过 (已翻译)")
            return True

    modified = False

    for category in CATEGORIES:
        if category not in data:
            continue

        cat_data = data[category]
        items = cat_data.get("items", [])

        if not items:
            cat_data["items_zh"] = []
            continue

        # 如果已有翻译且不强制更新，跳过
        if not force and "items_zh" in cat_data and cat_data["items_zh"]:
            continue

        print(f"  翻译 {category} ({len(items)} 条)...")
        translated = translate_items(client, items, model)

        if translated is not None:
            cat_data["items_zh"] = translated
            modified = True
            time.sleep(delay)  # 请求间隔
        else:
            print(f"  {category} 翻译失败")

    if modified:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"  写入文件失败: {e}")
            return False

    return True


def main():
    parser = argparse.ArgumentParser(description="翻译家长指南内容")
    parser.add_argument(
        "--api-base",
        default=os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1"),
        help="API 基础地址 (默认: 环境变量 OPENAI_API_BASE)",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("OPENAI_API_KEY", "sk-xxx"),
        help="API Key (默认: 环境变量 OPENAI_API_KEY)",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="模型名称 (默认: gpt-4o-mini)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制重新翻译已翻译的文件",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="请求间隔秒数 (默认: 0.5)",
    )
    parser.add_argument(
        "--file",
        help="只翻译指定文件 (文件名或完整路径)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只显示要处理的文件，不实际翻译",
    )

    args = parser.parse_args()

    # 确定目录
    script_dir = Path(__file__).parent
    guides_dir = script_dir.parent / "parental_guides"

    if not guides_dir.exists():
        print(f"错误: 找不到目录 {guides_dir}")
        sys.exit(1)

    # 获取文件列表
    if args.file:
        # 指定单个文件
        if os.path.isabs(args.file):
            files = [Path(args.file)]
        else:
            files = [guides_dir / args.file]
        if not files[0].exists():
            print(f"错误: 找不到文件 {files[0]}")
            sys.exit(1)
    else:
        files = sorted(guides_dir.glob("*_parental_guide.json"))

    print(f"找到 {len(files)} 个文件")
    print(f"API: {args.api_base}")
    print(f"模型: {args.model}")
    print()

    if args.dry_run:
        for f in files:
            print(f"  {f.name}")
        return

    # 确保 openai 库已安装（仅在实际翻译时需要）
    ensure_openai()

    # 创建客户端
    client = create_client(args.api_base, args.api_key)

    success_count = 0
    fail_count = 0

    for i, file_path in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {file_path.name}")

        if translate_file(client, file_path, args.model, args.force, args.delay):
            success_count += 1
        else:
            fail_count += 1

    print()
    print(f"完成: 成功 {success_count}, 失败 {fail_count}")


if __name__ == "__main__":
    main()
