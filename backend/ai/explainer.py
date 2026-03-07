"""
CryptoGuard — Explainable AI Layer
Generates compliance-ready natural language explanations for flagged transactions.

Uses Google Gemini (gemini-2.5-flash) for streaming AI explanations.
Only called for medium/critical tier transactions.
"""

from __future__ import annotations

import os
from typing import Any, AsyncGenerator

import google.generativeai as genai


# ---------------------------------------------------------------------------
# Prompt template — same template, now feeds into Gemini
# ---------------------------------------------------------------------------
EXPLANATION_PROMPT_TEMPLATE = """You are a cryptocurrency compliance officer. A transaction has been flagged by our automated risk system.

Transaction Details:
- From: {from_address}
- To: {to_address}
- Value: {eth_value:.3f} ETH
- Risk Score: {risk_score}/100
- Risk Tier: {risk_tier}
- Triggered Rules: {triggered_rules}
{hop_chain_section}

Write exactly 2-3 sentences explaining why this transaction is suspicious and what action should be taken.
Write for a compliance officer, not a developer. Be specific about the risk pattern detected.
Do not use bullet points. Do not start with "I". Be direct and professional."""


def _build_prompt(risk_result: dict[str, Any]) -> str:
    """Build the Gemini prompt from a RiskResult dict."""
    hop_chain = risk_result.get("hop_chain")
    hop_section = ""
    if hop_chain:
        hop_section = f"- Fund Hop Chain: {len(hop_chain)} wallets deep"

    return EXPLANATION_PROMPT_TEMPLATE.format(
        from_address=risk_result.get("from_address", "unknown"),
        to_address=risk_result.get("to_address", "unknown"),
        eth_value=risk_result.get("eth_value", 0.0),
        risk_score=risk_result.get("risk_score", 0),
        risk_tier=str(risk_result.get("risk_tier", "low")).upper(),
        triggered_rules=", ".join(risk_result.get("triggered_rules", [])),
        hop_chain_section=hop_section,
    )


def _build_fallback(risk_result: dict[str, Any]) -> str:
    """Generate a fallback explanation when API is unavailable."""
    tier = risk_result.get("risk_tier", "low")
    rules = risk_result.get("triggered_rules", [])
    score = risk_result.get("risk_score", 0)
    from_addr = risk_result.get("from_address", "unknown")
    eth_value = risk_result.get("eth_value", 0.0)

    parts: list[str] = []

    if "BLACKLIST_HIT" in rules:
        parts.append(
            f"Wallet {from_addr[:8]}... appears on a sanctioned address list."
        )
    if "TORNADO_PROXIMITY" in rules:
        parts.append(
            "Transaction is linked to a known crypto mixer (Tornado Cash)."
        )
    if "PEEL_CHAIN" in rules:
        hop_chain = risk_result.get("hop_chain") or []
        parts.append(
            f"Peel chain pattern detected across {len(hop_chain)} wallet hops."
        )
    if "HIGH_VELOCITY" in rules:
        parts.append(
            "Abnormally high transaction velocity from this wallet."
        )
    if "LARGE_VALUE" in rules:
        parts.append(f"Large value transfer of {eth_value:.3f} ETH.")
    if "NEW_WALLET" in rules:
        parts.append("Sending wallet has minimal transaction history.")

    if not parts:
        parts.append(f"Transaction scored {score}/100 ({tier.upper()} risk).")

    action = "Immediate hold recommended." if tier == "critical" else \
             "Flag for analyst review." if tier == "medium" else \
             "Continue monitoring."

    return " ".join(parts) + " " + action


async def generate_explanation(
    risk_result: dict[str, Any],
) -> AsyncGenerator[str, None]:
    """
    Stream an AI-generated compliance explanation for a flagged transaction.

    Priority:
    1. If risk_result already has 'ai_explanation' (from sim data) → yield it directly
    2. Otherwise → call Gemini gemini-2.5-flash with streaming
    3. On error → yield rule-based fallback explanation

    Only call for risk_tier in ['medium', 'critical'].

    Args:
        risk_result: The full RiskResult dict from scorer.py

    Yields:
        str: Text chunks of the explanation
    """
    # ── Priority 1: pre-baked explanation from simulation data ──
    existing = risk_result.get("ai_explanation")
    if existing:
        yield existing
        return

    # ── Priority 1.5: Do not call AI for Low Risk ──
    if risk_result.get("risk_tier", "low") == "low":
        yield _build_fallback(risk_result)
        return

    # ── Priority 2: live Gemini API call with streaming ──
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        # No API key → fall back to rule-based explanation
        yield _build_fallback(risk_result)
        return

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = _build_prompt(risk_result)

        response = model.generate_content(
            prompt,
            stream=True,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=200,
                temperature=0.3,
            ),
        )

        has_content = False
        for chunk in response:
            if chunk.text:
                has_content = True
                yield chunk.text

        if not has_content:
            yield _build_fallback(risk_result)

    except Exception:
        # Any API error → graceful fallback
        yield _build_fallback(risk_result)
