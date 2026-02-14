# Engineering Impact Dashboard - Backend

FastAPI backend for analyzing GitHub repository data and calculating engineering impact scores.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set GitHub token in `.env`:
```
GITHUB_TOKEN=your_github_token
GITHUB_REPO=PostHog/posthog
```

3. Fetch data:
```bash
python github_fetcher.py
```

4. Run server:
```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

- `GET /api/top-engineers?limit=5` - Top N most impactful engineers
- `GET /api/methodology` - Scoring methodology explanation
- `GET /api/health` - Health check

---

## Impact Scoring Methodology

Impact is measured across **four dimensions**, each scored 0–100. The **overall impact score** is a weighted average:

```
Overall Impact = 0.30 × Quality + 0.30 × Velocity + 0.20 × Collaboration + 0.20 × Leadership
```

---

### 1. Code Quality Score (30% weight)

**Signals:** Fast merge time, reasonable PR size, review activity

| Component | Formula | Rationale |
|-----------|---------|-----------|
| Merge score | `100 × (1 - min(avg_merge_hours, 72) / 72)` | Lower merge time = higher quality (cap at 72 hours) |
| Size score | 100 if 200–500 lines/PR; 50–100 if &lt;200; decays if &gt;500 | Sweet spot avoids trivial or oversized PRs |
| Review activity | `min(reviews_given / 20, 1) × 100` | Active reviewers understand quality standards |

```
Quality = 0.50 × merge_score + 0.30 × size_score + 0.20 × review_activity
```

**Size score rules:**
- **200–500 lines/PR:** 100 (ideal)
- **&lt;200 lines:** `50 + (avg_changes / 200) × 50`
- **&gt;500 lines:** `max(50, 100 - (avg_changes - 500) / 20)`

---

### 2. Delivery Velocity Score (30% weight)

**Signals:** Consistency (PRs per month), complexity (files per PR)

| Component | Formula | Rationale |
|-----------|---------|-----------|
| Consistency | `min(prs_per_month / 10, 1) × 100` | 10+ PRs/month = max (90-day window) |
| Complexity | `min(avg_files_per_pr / 15, 1) × 100` | 15+ files/PR = max |

```
Velocity = 0.40 × consistency_score + 0.60 × complexity_score
```

---

### 3. Collaboration Score (20% weight)

**Signals:** Review volume, review depth (comments per PR)

| Component | Formula | Rationale |
|-----------|---------|-----------|
| Review volume | `min(reviews_given / 30, 1) × 100` | 30+ reviews = max |
| Review depth | `min((reviews_given / prs_reviewed) / 3, 1) × 100` | 3+ reviews per unique PR = max |

```
Collaboration = 0.70 × review_volume + 0.30 × review_depth
```

---

### 4. Technical Leadership Score (20% weight)

**Signals:** Code ownership (files touched), dual role (author + reviewer)

| Component | Formula | Rationale |
|-----------|---------|-----------|
| Ownership | `min(files_changed / 200, 1) × 100` | 200+ files = max |
| Balance | `min((prs_created + reviews_given) / 40, 1) × 100` if both &gt;0, else 0 | Must author and review |

```
Leadership = 0.60 × ownership + 0.40 × balance
```

---

## Worked Examples (Real Contributors)

Data from PostHog/posthog repository (90-day window).

---

### Example 1: rafaeelaudibert (#1, Impact 66.1)

**Raw stats:** 7 PRs, 135 files changed, 2609 additions, 240 deletions, 64.13 hr avg merge, 24 reviews given, 15 PRs reviewed

**Code Quality:**
- merge_score = 100 × (1 - 64.13/72) = **10.9**
- avg_changes = (2609+240)/7 = 407 → 200–500 → size_score = **100**
- review_activity = min(24/20, 1)×100 = **100**
- Quality = 0.50×10.9 + 0.30×100 + 0.20×100 = **55.5**

**Delivery Velocity:**
- prs_per_month = 7/3 = 2.33 → consistency = 23.3
- avg_files = 135/7 = 19.3 → complexity = 100
- Velocity = 0.40×23.3 + 0.60×100 = **69.3**

**Collaboration:**
- review_volume = min(24/30, 1)×100 = 80
- review_depth = min(24/15/3, 1)×100 = 53.3
- Collaboration = 0.70×80 + 0.30×53.3 = **72.0**

**Technical Leadership:**
- ownership = min(135/200, 1)×100 = 67.5
- balance = min((7+24)/40, 1)×100 = 77.5
- Leadership = 0.60×67.5 + 0.40×77.5 = **71.5**

**Overall Impact:** 0.30×55.5 + 0.30×69.3 + 0.20×72 + 0.20×71.5 = **66.1**

---

### Example 2: pauldambra (#2, Impact 62.1)

**Raw stats:** 7 PRs, 42 files changed, 1196 additions, 274 deletions, 26.83 hr avg merge, 28 reviews given, 11 PRs reviewed

**Code Quality:**
- merge_score = 100 × (1 - 26.83/72) = **62.7**
- avg_changes = 1470/7 = 210 → size_score = **100**
- review_activity = min(28/20, 1)×100 = **100**
- Quality = 0.50×62.7 + 0.30×100 + 0.20×100 = **81.4**

**Delivery Velocity:**
- consistency = 23.3
- avg_files = 42/7 = 6 → complexity = 40
- Velocity = 0.40×23.3 + 0.60×40 = **33.3**

**Collaboration:**
- review_volume = min(28/30, 1)×100 = 93.3
- review_depth = min(28/11/3, 1)×100 = 84.8
- Collaboration = 0.70×93.3 + 0.30×84.8 = **90.8**

**Technical Leadership:**
- ownership = min(42/200, 1)×100 = 21
- balance = min(35/40, 1)×100 = 87.5
- Leadership = 0.60×21 + 0.40×87.5 = **47.6**

**Overall Impact:** 0.30×81.4 + 0.30×33.3 + 0.20×90.8 + 0.20×47.6 = **62.1**

---

### Example 3: Radu-Raicea (#3, Impact 59.9)

**Raw stats:** 2 PRs, 37 files changed, 155 additions, 332 deletions, 1.13 hr avg merge, 10 reviews given, 4 PRs reviewed

**Code Quality:**
- merge_score = 100 × (1 - 1.13/72) = **98.4**
- avg_changes = 487/2 = 243.5 → size_score = **100**
- review_activity = min(10/20, 1)×100 = **50**
- Quality = 0.50×98.4 + 0.30×100 + 0.20×50 = **89.2**

**Delivery Velocity:**
- prs_per_month = 2/3 = 0.67 → consistency = 6.7
- avg_files = 37/2 = 18.5 → complexity = 100
- Velocity = 0.40×6.7 + 0.60×100 = **62.7**

**Collaboration:**
- review_volume = min(10/30, 1)×100 = 33.3
- review_depth = min(10/4/3, 1)×100 = 83.3
- Collaboration = 0.70×33.3 + 0.30×83.3 = **48.3**

**Technical Leadership:**
- ownership = min(37/200, 1)×100 = 18.5
- balance = min(12/40, 1)×100 = 30
- Leadership = 0.60×18.5 + 0.40×30 = **23.1**

**Overall Impact:** 0.30×89.2 + 0.30×62.7 + 0.20×48.3 + 0.20×23.1 = **59.9**

---

### Example 4: andrewjmcgehee (#4, Impact 57.3)

**Raw stats:** 4 PRs, 106 files changed, 8469 additions, 8128 deletions, 190.37 hr avg merge, 21 reviews given, 5 PRs reviewed

**Code Quality:**
- merge_time capped at 72 → merge_score = **0**
- avg_changes = 16597/4 = 4149 → size_score = max(50, 100 - 3649/20) = **50**
- review_activity = min(21/20, 1)×100 = **100**
- Quality = 0.50×0 + 0.30×50 + 0.20×100 = **35.0**

**Delivery Velocity:**
- prs_per_month = 4/3 = 1.33 → consistency = 13.3
- avg_files = 106/4 = 26.5 → complexity = 100
- Velocity = 0.40×13.3 + 0.60×100 = **65.3**

**Collaboration:**
- review_volume = min(21/30, 1)×100 = 70
- review_depth = min(21/5/3, 1)×100 = 100
- Collaboration = 0.70×70 + 0.30×100 = **79.0**

**Technical Leadership:**
- ownership = min(106/200, 1)×100 = 53
- balance = min(25/40, 1)×100 = 62.5
- Leadership = 0.60×53 + 0.40×62.5 = **56.8**

**Overall Impact:** 0.30×35 + 0.30×65.3 + 0.20×79 + 0.20×56.8 = **57.3**

---

### Example 5: adamleithp (#5, Impact 52.7)

**Raw stats:** 9 PRs, 121 files changed, 1739 additions, 1219 deletions, 28.62 hr avg merge, 4 reviews given, 4 PRs reviewed

**Code Quality:**
- merge_score = 100 × (1 - 28.62/72) = **60.3**
- avg_changes = 2958/9 = 328.7 → size_score = **100**
- review_activity = min(4/20, 1)×100 = **20**
- Quality = 0.50×60.3 + 0.30×100 + 0.20×20 = **64.1**

**Delivery Velocity:**
- prs_per_month = 9/3 = 3 → consistency = 30
- avg_files = 121/9 = 13.4 → complexity = 89.3
- Velocity = 0.40×30 + 0.60×89.3 = **65.8**

**Collaboration:**
- review_volume = min(4/30, 1)×100 = 13.3
- review_depth = min(4/4/3, 1)×100 = 33.3
- Collaboration = 0.70×13.3 + 0.30×33.3 = **19.3**

**Technical Leadership:**
- ownership = min(121/200, 1)×100 = 60.5
- balance = min(13/40, 1)×100 = 32.5
- Leadership = 0.60×60.5 + 0.40×32.5 = **49.3**

**Overall Impact:** 0.30×64.1 + 0.30×65.8 + 0.20×19.3 + 0.20×49.3 = **52.7**

---

## Philosophy

This approach avoids vanity metrics (lines of code, raw commit count) and is designed to resist gaming. High impact requires:

- **Quality** – fast merges, well-sized PRs, active reviewing
- **Velocity** – steady delivery and handling complex changes
- **Collaboration** – meaningful review volume and depth
- **Leadership** – broad code ownership and both authoring and reviewing
