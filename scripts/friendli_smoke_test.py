#!/usr/bin/env python3
"""Minimal FriendliAI OpenAI-compatible chat completion smoke test.

Reads FRIENDLI_API_KEY and optional Friendli settings from the environment,
sends one small Korean teacher-material prompt, and prints a sanitized summary.
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://api.friendli.ai/serverless/v1"
DEFAULT_MODEL = "LGAI-EXAONE/K-EXAONE-236B-A23B"

SYSTEM_PROMPT = """당신은 외국어로서의 한국어 교육 전문가입니다.
학습자 수준에 맞는 자연스럽고 명확한 한국어 수업자료를 만듭니다.
문제의 정답은 하나로 명확해야 하며, 교사가 바로 검토할 수 있게 구조화합니다."""

USER_PROMPT = """다음 조건에 맞는 아주 짧은 한국어 수업자료 샘플을 만들어 주세요.
- 학습자 수준: 초급
- 주제: 카페에서 주문하기
- 목표 문법: -고 싶어요
- 목표 어휘: 커피, 주문하다, 계산하다
- 연습문제 수: 1

출력 형식:
# 제목
## 대화문
## 핵심 어휘
## 연습문제
## 정답 및 해설"""


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        raise SystemExit(f"{name} must be a number, got {raw!r}")


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        raise SystemExit(f"{name} must be an integer, got {raw!r}")


def redact_key(value: str) -> str:
    if len(value) <= 8:
        return "***"
    return f"{value[:4]}...{value[-4:]}"


def post_chat_completion(payload: dict[str, Any], api_key: str, base_url: str) -> dict[str, Any]:
    endpoint = base_url.rstrip("/") + "/chat/completions"
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    api_key = os.getenv("FRIENDLI_API_KEY")
    if not api_key:
        print("FRIENDLI_API_KEY is required in the current process environment.", file=sys.stderr)
        print(
            "If you added it in Codex web project environment variables, "
            "start a new task/session or refresh the runtime environment before running this script.",
            file=sys.stderr,
        )
        return 2

    base_url = os.getenv("FRIENDLI_BASE_URL", DEFAULT_BASE_URL)
    model = os.getenv("FRIENDLI_MODEL", DEFAULT_MODEL)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
        "temperature": env_float("FRIENDLI_TEMPERATURE", 0.4),
        "top_p": env_float("FRIENDLI_TOP_P", 0.9),
        "max_tokens": env_int("FRIENDLI_MAX_TOKENS", 800),
    }

    print("FriendliAI smoke test")
    print(f"- base_url: {base_url}")
    print(f"- model: {model}")
    print(f"- api_key: {redact_key(api_key)}")

    started = time.perf_counter()
    try:
        data = post_chat_completion(payload, api_key, base_url)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"HTTP {error.code} from FriendliAI", file=sys.stderr)
        print(body[:2000], file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Network error: {error}", file=sys.stderr)
        return 1

    elapsed = time.perf_counter() - started
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content", "")
    usage = data.get("usage", {})

    print(f"- elapsed_seconds: {elapsed:.2f}")
    if usage:
        print(f"- usage: {json.dumps(usage, ensure_ascii=False)}")
    print("\n--- model output ---")
    print(content.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
