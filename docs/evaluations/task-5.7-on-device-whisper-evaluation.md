# Task 5.7 — On-Device Whisper Evaluation

**Date:** April 11, 2026
**Sprint:** 5 (Communication Intelligence)
**Author:** Aurora AI Solutions Studio
**Status:** Research Spike Complete — Recommendation Ready

---

## Executive Summary

ClientPulse currently uses OpenAI's cloud Whisper API (`whisper-1`) for meeting transcription.
This evaluation assesses whether local/on-device Whisper transcription is feasible and
beneficial for the product, focusing on three questions:

1. Can we achieve comparable accuracy locally?
2. What hardware does the agency need?
3. Does the privacy benefit justify the complexity?

**Recommendation:** Ship a **hybrid architecture** — cloud Whisper as default (current),
with an opt-in "Privacy Mode" using faster-whisper for Agency-tier customers ($199/mo).
Do not build for Sprint 5-6; target Sprint 7 (Pre-Launch Hardening) when infra is stable.

---

## Current State: Cloud Whisper API

| Metric | Current (whisper-1 API) |
|---|---|
| Model | whisper-1 (hosted by OpenAI) |
| Accuracy (English) | ~95-97% WER on meeting audio |
| Latency | ~10-30s for a 30-min recording |
| Cost | $0.006/min = $0.18 per 30-min meeting |
| Privacy | Audio uploaded to OpenAI servers |
| Integration | 5 lines of code (OpenAI SDK) |

At 20 clients × 2 meetings/week × 30 min average = $14.40/mo per agency.
Well within margin at all pricing tiers.

---

## Candidate Runtimes

### 1. whisper.cpp (C/C++)

**Architecture:** Pure C/C++ port of Whisper. Runs on CPU by default, optional
CoreML (Apple Silicon) and CUDA (NVIDIA GPU) acceleration.

| Dimension | Assessment |
|---|---|
| **Best for** | Edge devices, Apple Silicon Macs, environments with no GPU |
| **Models** | All Whisper sizes (tiny → large-v3-turbo) via GGML format |
| **Apple Silicon** | Excellent — CoreML backend leverages Neural Engine |
| **Speed (M1, large-v3-turbo)** | ~1.2x real-time (30-min audio in ~36 min) |
| **Speed (M3/M4, large-v3-turbo)** | ~0.5-0.7x real-time (30-min audio in ~15-21 min) |
| **VRAM/RAM** | ~2-3 GB for large-v3-turbo |
| **Integration** | CLI binary or C library; no native Node.js bindings |
| **Maturity** | Very mature (30k+ GitHub stars), active development |

**Pros:** Zero Python dependency, smallest memory footprint, runs on anything.
**Cons:** No native JS/TS bindings — requires spawning a subprocess or building
a sidecar service. No GPU on most agency laptops (CPU-only inference).

### 2. faster-whisper (Python + CTranslate2)

**Architecture:** Python wrapper around CTranslate2, an optimized C++ inference
engine for Transformer models. Supports CPU (with INT8 quantization) and CUDA GPU.

| Dimension | Assessment |
|---|---|
| **Best for** | Server-side deployment, GPU-equipped machines |
| **Models** | All Whisper sizes including large-v3-turbo |
| **Speed (CPU, large-v3-turbo, INT8)** | ~2-3x real-time |
| **Speed (GPU T4, large-v3-turbo)** | ~0.2x real-time (30-min audio in ~6 min) |
| **VRAM** | ~3-5 GB (large-v3-turbo, FP16) |
| **RAM (CPU mode)** | ~3 GB (INT8 quantized) |
| **Integration** | Python package; call via subprocess or microservice |
| **Maturity** | Very mature (14k+ GitHub stars), CTranslate2-backed |

**Pros:** 4x faster than vanilla Whisper, INT8 quantization for CPU, excellent
accuracy preservation, VAD (Silero) built-in for skipping silence.
**Cons:** Python runtime required — not native to the Next.js stack. Needs a
sidecar service (Flask/FastAPI) or a separate worker process.

### 3. Whisper Large-v3-Turbo (Model Variant)

Not a runtime but a model choice — works with both whisper.cpp and faster-whisper.

| Metric | large-v3 | large-v3-turbo |
|---|---|---|
| Parameters | 1,550M | 809M |
| Decoder layers | 32 | 4 |
| Speed improvement | baseline | ~6x faster |
| English accuracy | best | within 1-2% of large-v3 |
| Multilingual accuracy | best | some degradation (Thai, Cantonese) |
| Translation support | yes | no |

**Verdict:** large-v3-turbo is the right model for ClientPulse. English-only
meeting transcription with minimal accuracy loss and massive speed gain.

---

## Privacy & Compliance Analysis

### Why On-Device Matters

1. **GDPR Article 44-49 (Cross-border transfers):** Client meeting recordings
   contain business-sensitive information. Sending audio to OpenAI (US servers)
   requires either Standard Contractual Clauses or explicit consent from all
   meeting participants. On-device transcription eliminates this entirely.

2. **Post-Cluely landscape (2025):** The Cluely data breach (83,000 users'
   meeting recordings exposed) has made agencies extremely sensitive about
   cloud-based meeting recording tools. "Your audio never leaves your machine"
   is a competitive differentiator.

3. **Colorado AI Act (2026):** Requires algorithmic discrimination prevention
   for AI deployers. On-device processing reduces the regulatory surface area
   since no third party processes the audio.

4. **EU agency customers:** German/EU agencies (Aurora's home market) are
   particularly privacy-conscious. On-device transcription could be the
   deciding factor for enterprise agency deals.

### What Cloud AI Still Sees

Even with on-device transcription, the transcript text is still sent to:
- Claude API for meeting intelligence extraction (sentiment, action items)
- Supabase for storage

The privacy gain is: **raw audio never leaves the agency's infrastructure.**
Only the derived transcript (text) is transmitted. This is a meaningful
distinction under GDPR — audio recordings are far more sensitive than text
transcripts.

---

## Architecture Options

### Option A: Sidecar Microservice (Recommended)

```
Agency Mac/Server
├── ClientPulse (Next.js) ← browser
└── whisper-service (Python/faster-whisper) ← local port 5111
    └── Receives audio file → returns transcript JSON
```

**How it works:**
1. User uploads audio in ClientPulse UI
2. If "Privacy Mode" enabled, audio is sent to `localhost:5111` instead of OpenAI
3. Sidecar runs faster-whisper with large-v3-turbo (INT8 CPU or GPU)
4. Returns transcript in same format as Whisper API
5. ClientPulse proceeds with Claude extraction as normal

**Pros:** Clean separation. No changes to Next.js runtime. Works on Mac/Linux.
**Cons:** Agency must install and run the sidecar. Adds onboarding friction.

### Option B: whisper.cpp CLI Subprocess

```
ClientPulse API route → spawn whisper.cpp binary → parse output → return transcript
```

**Pros:** No Python dependency. Single binary.
**Cons:** Requires distributing platform-specific binaries. Harder to manage.
Won't work on Vercel (serverless) — only on self-hosted or agency-local setups.

### Option C: Electron Wrapper

Package ClientPulse as an Electron app with whisper.cpp built in.

**Pros:** Single install, best UX, audio never touches the network.
**Cons:** Massive scope expansion. Not justified until post-launch (Sprint 9+).

---

## Feasibility Matrix

| Criterion | Cloud (current) | Sidecar (Option A) | CLI (Option B) |
|---|---|---|---|
| Accuracy | 95-97% | 93-96% (turbo) | 93-96% (turbo) |
| Speed (30-min meeting) | 10-30s | 6-21 min (varies by HW) | 15-36 min (CPU) |
| Cost per meeting | $0.18 | $0 (local compute) | $0 (local compute) |
| Setup complexity | Zero | Medium (install Python + model) | Low (download binary) |
| Privacy | Audio to OpenAI | Audio stays local | Audio stays local |
| Works on Vercel | Yes | No (local only) | No (local only) |
| Multilingual | Excellent | Good (turbo: some degradation) | Good |
| Maintenance | Zero | Model updates, sidecar health | Binary updates |

---

## Cost-Benefit Analysis

### For the Agency-Tier Customer ($199/mo)

An agency with 30 clients, 4 meetings/week average:
- **Cloud cost:** 30 × 4 × 30 min × $0.006 = $21.60/mo (absorbed by Aurora)
- **On-device cost:** $0 (agency's own hardware)
- **Savings to Aurora:** $21.60/mo per Agency-tier customer
- **Privacy value:** High — major differentiator for EU agencies

### For Aurora (Product-Level)

At 100 Agency-tier customers: $2,160/mo saved on Whisper API costs.
At 500 Agency-tier customers: $10,800/mo saved.

The cost savings are meaningful at scale but not the primary driver. The
primary driver is the privacy/trust positioning for EU market entry.

---

## Hardware Requirements for Agencies

### Minimum (CPU-only, faster-whisper INT8)
- Any modern laptop with 8+ GB RAM
- Intel i5/AMD Ryzen 5 or Apple M1+
- ~3 GB disk for model weights
- Processing: ~2-3x real-time (30-min meeting in ~60-90 min)

### Recommended (Apple Silicon)
- MacBook Pro M2/M3/M4 with 16+ GB RAM
- whisper.cpp with CoreML acceleration
- Processing: ~0.5-1x real-time (30-min meeting in ~15-30 min)

### Optimal (GPU Server)
- NVIDIA T4/RTX 3060+ with 6+ GB VRAM
- faster-whisper with CUDA
- Processing: ~0.2x real-time (30-min meeting in ~6 min)

Most agency employees use MacBooks. Apple Silicon path is the most relevant.

---

## Recommendation

### Do Not Build Now (Sprint 5-6)

The integration effort is moderate (~3-5 days) but introduces operational
complexity (sidecar installation, model distribution, hardware compatibility
testing) that competes with higher-priority Sprint 6 work (team features,
recursive learning). The cloud Whisper API works well and costs are low.

### Target Sprint 7 (Pre-Launch Hardening)

Sprint 7 is the right home for this feature because:
1. Infrastructure is stable — adding a sidecar option won't destabilize core
2. Security audit (Task 7.5) naturally includes the on-device data flow
3. GDPR compliance work (Task 7.4) benefits from having on-device as an option
4. Load testing (Task 7.6) should include the local transcription path

### Implementation Plan (When Ready)

1. **faster-whisper sidecar** as a Docker container or pip-installable package
2. **large-v3-turbo INT8** as the default model (best speed/accuracy tradeoff)
3. **Feature flag** in ClientPulse settings: "Privacy Mode — transcribe locally"
4. **Fallback to cloud** if sidecar is unreachable (graceful degradation)
5. **Agency-tier only** — positions on-device as a premium privacy feature

### Pricing Justification

On-device transcription strengthens the Agency tier ($199/mo) value proposition:
- "Your meeting audio never leaves your infrastructure"
- Zero per-meeting transcription costs
- GDPR compliance by design
- Could justify a price increase to $249/mo if bundled with other privacy features

---

## Open Questions for CEO Decision

1. **Should on-device be Agency-tier exclusive, or available on Pro ($79/mo)?**
   Recommendation: Agency-tier only at launch. Can expand later.

2. **Docker or native install for the sidecar?**
   Docker is easier to maintain but adds Docker as a dependency.
   Native pip install is simpler but requires Python on the agency machine.

3. **Should we explore a partnership with Alter or Meetily?**
   Both offer local Whisper transcription as a product. Integration via their
   SDK might be faster than building our own sidecar.

---

## References

- [whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp) — C/C++ port, 30k+ stars
- [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper) — CTranslate2 runtime, 14k+ stars
- [Whisper large-v3-turbo on HuggingFace](https://huggingface.co/openai/whisper-large-v3-turbo) — 809M params, 6x faster
- [Choosing Whisper Variants (Modal)](https://modal.com/blog/choosing-whisper-variants) — comprehensive comparison
- [Apple Silicon Whisper Performance](https://www.voicci.com/blog/apple-silicon-whisper-performance.html) — M1-M4 benchmarks
- [Best Local AI Meeting Recorders 2026](https://blog.buildbetter.ai/best-local-ai-meeting-recorders-no-cloud-2026/) — market landscape
- [Privacy-Focused Transcription Tools 2025](https://meetily.ai/blog/best-privacy-focused-meeting-transcription-tools-2025) — GDPR context
