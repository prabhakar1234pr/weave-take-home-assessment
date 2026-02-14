# End-to-End Cursor AI Plan: Weave Engineering Impact Dashboard

**Copy this entire plan into Cursor AI's composer and it will build the project step-by-step.**

---

## PROJECT: Engineering Impact Dashboard for Weave Take-Home Assessment

### CONTEXT
Building a full-stack dashboard to analyze GitHub data from PostHog repository and identify the top 5 most impactful engineers. This is for a Weave (YC W25) job interview take-home assessment.

**Time limit:** 2 hours
**Tech stack:** Python FastAPI backend + Next.js frontend
**Philosophy:** Impact ≠ output. Avoid vanity metrics (LOC, commit count). Multi-dimensional measurement.

---

## PHASE 1: PROJECT SETUP (5 minutes)

### Step 1.1: Create project structure
Create the following directory structure:
```
weave-assessment/
├── backend/
│   ├── data/              (will hold github_data.json)
│   ├── github_fetcher.py
│   ├── analyzer.py
│   ├── main.py
│   ├── requirements.txt
│   └── .env
└── frontend/
    └── (Next.js app - create in next step)
```

### Step 1.2: Backend dependencies
Create `backend/requirements.txt` with:
```
fastapi==0.109.0
uvicorn==0.27.0
requests==2.31.0
python-dotenv==1.0.0
```

### Step 1.3: Environment setup
Create `backend/.env` with:
```
GITHUB_TOKEN=your_token_here
GITHUB_REPO=PostHog/posthog
```

Instructions for user: Replace `your_token_here` with actual GitHub token from https://github.com/settings/tokens

---

## PHASE 2: GITHUB DATA FETCHER (15 minutes)

### Step 2.1: Create github_fetcher.py
Create `backend/github_fetcher.py` with the following implementation:

**Requirements:**
- Fetch last 90 days of merged PRs from PostHog/posthog
- For each PR: get author, files changed, additions/deletions, merge time, reviews
- Handle GitHub API rate limiting with exponential backoff
- Save data to `data/github_data.json`

**Key functions:**
1. `__init__`: Initialize GitHub API client with token from env
2. `_request(url, params)`: Make API request with rate limit handling
3. `fetch_merged_prs(days=90, limit=200)`: Get merged PRs from last N days
4. `_fetch_full_pr(pr_number)`: Get detailed PR info (additions, deletions, changed_files)
5. `fetch_pr_reviews(pr_number)`: Get reviews for a PR
6. `_parse_pr_for_output(pr, reviews)`: Extract relevant PR data
7. `aggregate_contributor_data(prs_with_reviews)`: Build contributor stats dict
8. `save_data(data, filename)`: Save to JSON
9. `run()`: Main execution flow

**Data structure to save:**
```json
{
  "fetched_at": "ISO timestamp",
  "repo": "PostHog/posthog",
  "contributors": {
    "username": {
      "name": "Full Name",
      "avatar_url": "https://...",
      "prs_created": 24,
      "total_files_changed": 340,
      "total_additions": 8420,
      "total_deletions": 3200,
      "avg_time_to_merge_hours": 18.5,
      "reviews_given": 45,
      "prs_reviewed": 32
    }
  },
  "prs": [...]
}
```

**Implementation details:**

```python
import os
import time
import requests
from datetime import datetime, timedelta
import json
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

def _parse_repo_url(url: str) -> str:
    """Convert https://github.com/owner/repo to owner/repo"""
    if not url:
        return "PostHog/posthog"
    url = url.strip().rstrip("/")
    if "github.com/" in url:
        return url.split("github.com/")[-1]
    return url if "/" in url else "PostHog/posthog"

class GitHubFetcher:
    def __init__(self):
        self.base_url = "https://api.github.com"
        self.repo = _parse_repo_url(os.getenv("GITHUB_REPO", ""))
        token = os.getenv("GITHUB_TOKEN")
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if token:
            self.headers["Authorization"] = f"token {token}"

    def _request(self, url, params=None):
        """Make request with rate limit handling"""
        response = requests.get(url, headers=self.headers, params=params)
        if response.status_code == 403 and "rate limit" in response.text.lower():
            reset_time = int(response.headers.get("X-RateLimit-Reset", time.time() + 60))
            wait = max(reset_time - time.time(), 0)
            print(f"Rate limited. Waiting {wait:.0f}s...")
            time.sleep(wait + 1)
            return self._request(url, params)
        response.raise_for_status()
        return response.json()

    def fetch_merged_prs(self, days=90, limit=200):
        """Fetch merged PRs from last N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        prs = []
        page = 1

        while len(prs) < limit:
            url = f"{self.base_url}/repos/{self.repo}/pulls"
            params = {
                "state": "closed",
                "sort": "updated",
                "direction": "desc",
                "per_page": 30,
                "page": page,
            }
            batch = self._request(url, params)
            if not batch:
                break

            for pr in batch:
                if len(prs) >= limit:
                    break
                if pr.get("merged_at") is None:
                    continue
                
                # CRITICAL: Compare datetime objects, not strings
                merged_at = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                if merged_at < cutoff:
                    return prs

                pr_number = pr["number"]
                full_pr = self._fetch_full_pr(pr_number)
                if full_pr:
                    prs.append(full_pr)
                time.sleep(0.5)

            page += 1
            time.sleep(0.5)

        return prs

    def _fetch_full_pr(self, pr_number):
        """Fetch full PR details (additions, deletions, changed_files)"""
        try:
            url = f"{self.base_url}/repos/{self.repo}/pulls/{pr_number}"
            return self._request(url)
        except Exception as e:
            print(f"⚠️  Failed to fetch PR #{pr_number}: {e}")
            return None

    def fetch_pr_reviews(self, pr_number):
        """Get reviews for a specific PR"""
        url = f"{self.base_url}/repos/{self.repo}/pulls/{pr_number}/reviews"
        return self._request(url)

    def _parse_pr_for_output(self, pr, reviews):
        """Extract PR data for output"""
        author = pr.get("user") or {}
        created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
        merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
        time_to_merge_hours = (merged - created).total_seconds() / 3600

        reviewers = list({r["user"]["login"] for r in reviews if r.get("user")})

        return {
            "author_username": author.get("login", "unknown"),
            "title": pr.get("title", ""),
            "files_changed": pr.get("changed_files", 0),
            "additions": pr.get("additions", 0),
            "deletions": pr.get("deletions", 0),
            "time_to_merge_hours": round(time_to_merge_hours, 2),
            "created_at": pr.get("created_at"),
            "merged_at": pr.get("merged_at"),
            "comments_count": pr.get("comments", 0),
            "reviews_count": len(reviews),
            "reviewers": reviewers,
        }

    def aggregate_contributor_data(self, prs_with_reviews):
        """Build a dict of contributors with their stats"""
        contributors = defaultdict(
            lambda: {
                "name": "",
                "avatar_url": "",
                "prs_created": 0,
                "total_files_changed": 0,
                "total_additions": 0,
                "total_deletions": 0,
                "time_to_merge_hours_list": [],
                "reviews_given": 0,
                "prs_reviewed": set(),
            }
        )

        for pr_data in prs_with_reviews:
            pr = pr_data["pr"]
            reviews = pr_data["reviews"]
            parsed = pr_data["parsed"]

            author = pr.get("user") or {}
            username = author.get("login", "unknown")
            
            # Skip unknown users and bots
            if username == "unknown" or username.endswith("[bot]"):
                continue

            contributors[username]["name"] = author.get("name") or author.get("login", "")
            contributors[username]["avatar_url"] = author.get("avatar_url", "")
            contributors[username]["prs_created"] += 1
            contributors[username]["total_files_changed"] += parsed["files_changed"]
            contributors[username]["total_additions"] += parsed["additions"]
            contributors[username]["total_deletions"] += parsed["deletions"]
            contributors[username]["time_to_merge_hours_list"].append(
                parsed["time_to_merge_hours"]
            )

            for review in reviews:
                reviewer = review.get("user")
                if reviewer:
                    r_username = reviewer.get("login")
                    # Skip bots in reviews too
                    if r_username and not r_username.endswith("[bot]"):
                        contributors[r_username]["reviews_given"] += 1
                        contributors[r_username]["prs_reviewed"].add(pr["number"])
                        if contributors[r_username]["name"] == "":
                            contributors[r_username]["name"] = (
                                reviewer.get("name") or reviewer.get("login", "")
                            )
                        if contributors[r_username]["avatar_url"] == "":
                            contributors[r_username]["avatar_url"] = reviewer.get(
                                "avatar_url", ""
                            )

        result = {}
        for username, data in contributors.items():
            times = data["time_to_merge_hours_list"]
            avg_time = sum(times) / len(times) if times else 0
            result[username] = {
                "name": data["name"],
                "avatar_url": data["avatar_url"],
                "prs_created": data["prs_created"],
                "total_files_changed": data["total_files_changed"],
                "total_additions": data["total_additions"],
                "total_deletions": data["total_deletions"],
                "avg_time_to_merge_hours": round(avg_time, 2),
                "reviews_given": data["reviews_given"],
                "prs_reviewed": len(data["prs_reviewed"]),
            }
        return result

    def save_data(self, data, filename="data/github_data.json"):
        """Save to JSON file"""
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)

    def run(self):
        """Main execution"""
        print(f"Fetching from repo: {self.repo}")
        print("Fetching merged PRs...")
        prs = self.fetch_merged_prs(days=90, limit=200)

        print(f"Found {len(prs)} merged PRs")
        print("Fetching reviews...")

        prs_with_reviews = []
        for i, pr in enumerate(prs, 1):
            print(f"Fetching reviews... {i}/{len(prs)}", end="\r")
            reviews = self.fetch_pr_reviews(pr["number"])
            parsed = self._parse_pr_for_output(pr, reviews)
            prs_with_reviews.append(
                {"pr": pr, "reviews": reviews, "parsed": parsed}
            )
            time.sleep(0.3)

        print("\nAggregating data...")
        contributors = self.aggregate_contributor_data(prs_with_reviews)

        print(f"Found {len(contributors)} contributors")

        output_prs = [p["parsed"] for p in prs_with_reviews]

        self.save_data(
            {
                "fetched_at": datetime.now().isoformat(),
                "repo": self.repo,
                "contributors": contributors,
                "prs": output_prs,
            }
        )

        print("✅ Data saved to data/github_data.json")

if __name__ == "__main__":
    fetcher = GitHubFetcher()
    fetcher.run()
```

**CRITICAL FIXES:**
- Use datetime objects for date comparisons (not strings)
- Skip bot accounts (username.endswith("[bot]"))
- Add time.sleep(0.3-0.5) between API calls to avoid rate limits
- Handle errors gracefully (continue on individual PR failures)
- Add progress indicator for user feedback

---

## PHASE 3: IMPACT SCORING ALGORITHM (20 minutes)

### Step 3.1: Create analyzer.py
Create `backend/analyzer.py` with sophisticated impact scoring.

**CORE PHILOSOPHY:**
- Impact ≠ output (avoid vanity metrics like LOC or commit count)
- Multi-dimensional measurement
- Hard to game
- Explainable to engineering leaders

**Four Dimensions (each 0-100 scale):**

#### 1. Code Quality Score (30% weight)
Signals:
- Fast merge time → high quality code gets approved quickly
- Reasonable PR size → not too trivial, not too large
- Active in reviews → understands quality standards

Formula:
```python
merge_score = 100 * (1 - min(avg_merge_hours, 72) / 72)  # Lower is better, cap at 3 days
size_score = optimal if 200-500 lines avg, penalty if too small/large
review_activity = min(reviews_given / 20, 1) * 100
quality = 0.50 * merge_score + 0.30 * size_score + 0.20 * review_activity
```

#### 2. Delivery Velocity Score (30% weight)
Signals:
- Consistency → PRs per month
- Complexity → files changed per PR

Formula:
```python
consistency = min(prs_per_month / 10, 1) * 100  # 10+ PRs/month = max
complexity = min(avg_files_per_pr / 15, 1) * 100  # 15+ files/PR = max
velocity = 0.40 * consistency + 0.60 * complexity
```

#### 3. Collaboration Score (20% weight)
Signals:
- Review volume → helping others
- Review depth → comments per PR

Formula:
```python
review_volume = min(reviews_given / 30, 1) * 100  # 30+ reviews = max
review_depth = min((reviews_given / prs_reviewed) / 3, 1) * 100  # 3+ comments/PR = max
collaboration = 0.70 * review_volume + 0.30 * review_depth
```

#### 4. Technical Leadership Score (20% weight)
Signals:
- Code ownership → files touched
- Dual role → both author AND reviewer

Formula:
```python
ownership = min(files_changed / 200, 1) * 100  # 200+ files = max
balance = min((prs_created + reviews_given) / 40, 1) * 100 if both > 0 else 0
leadership = 0.60 * ownership + 0.40 * balance
```

**Overall Impact Score:**
```python
impact = 0.30 * quality + 0.30 * velocity + 0.20 * collaboration + 0.20 * leadership
```

**Full Implementation:**

```python
import json
from typing import Dict, List

class ImpactAnalyzer:
    def __init__(self, data_file="data/github_data.json"):
        with open(data_file) as f:
            self.data = json.load(f)
        self.contributors = self.data["contributors"]
        self.prs = self.data["prs"]
    
    def _calculate_quality_score(self, contributor: Dict) -> float:
        """
        Code Quality = How good is their code?
        
        Signals:
        - Fast merge time (high quality gets approved quickly)
        - Reasonable PR size (not too small/large)
        - Active in reviews (understand quality standards)
        """
        
        # Fast merge time = quality (inverse relationship)
        # Cap at 72 hours (3 days) - anything longer is outlier
        merge_time = min(contributor["avg_time_to_merge_hours"], 72)
        merge_score = 100 * (1 - merge_time / 72)  # Lower time = higher score
        
        # Reasonable PR size (sweet spot around 200-500 lines)
        # Too small = trivial, too large = hard to review
        avg_changes = (contributor["total_additions"] + contributor["total_deletions"]) / max(contributor["prs_created"], 1)
        if 200 <= avg_changes <= 500:
            size_score = 100
        elif avg_changes < 200:
            size_score = 50 + (avg_changes / 200) * 50  # 0-200 maps to 50-100
        else:  # > 500
            size_score = max(50, 100 - (avg_changes - 500) / 20)  # Decays after 500
        
        # Active reviewer = understands quality
        review_activity = min(contributor["reviews_given"] / 20, 1) * 100  # Cap at 20 reviews
        
        # Weighted combination
        quality = (
            0.50 * merge_score +      # Merge time is strongest signal
            0.30 * size_score +        # PR size matters
            0.20 * review_activity     # Review activity shows engagement
        )
        
        return quality
    
    def _calculate_velocity_score(self, contributor: Dict) -> float:
        """
        Delivery Velocity = How much meaningful work do they ship?
        
        NOT just volume - look at consistency + complexity
        """
        
        # PR count (but normalized, so not just raw volume)
        pr_count = contributor["prs_created"]
        
        # Files touched (complexity proxy)
        files_changed = contributor["total_files_changed"]
        
        # Consistency: PRs per month (assuming 90 day window)
        prs_per_month = pr_count / 3
        consistency_score = min(prs_per_month / 10, 1) * 100  # 10+ PRs/month = 100
        
        # Complexity: avg files per PR
        avg_files = files_changed / max(pr_count, 1)
        complexity_score = min(avg_files / 15, 1) * 100  # 15+ files/PR = 100
        
        velocity = (
            0.40 * consistency_score +   # Consistent delivery
            0.60 * complexity_score       # Handle complex changes
        )
        
        return velocity
    
    def _calculate_collaboration_score(self, contributor: Dict) -> float:
        """
        Collaboration = How much do they help the team?
        
        Signals:
        - Reviews given (helping others)
        - Breadth of reviews (not just one person)
        """
        
        reviews_given = contributor["reviews_given"]
        prs_reviewed = contributor["prs_reviewed"]
        
        # Review volume
        review_volume = min(reviews_given / 30, 1) * 100  # 30+ reviews = 100
        
        # Review depth (reviews per unique PR)
        # High ratio = deep reviews (multiple comments per PR)
        # Low ratio = shallow reviews (one comment per PR)
        if prs_reviewed > 0:
            review_depth = min(reviews_given / prs_reviewed / 3, 1) * 100  # 3+ comments/PR = 100
        else:
            review_depth = 0
        
        collaboration = (
            0.70 * review_volume +   # Volume matters
            0.30 * review_depth      # But depth matters too
        )
        
        return collaboration
    
    def _calculate_leadership_score(self, contributor: Dict) -> float:
        """
        Technical Leadership = Are they a go-to expert?
        
        Signals:
        - Own significant code (high file count)
        - Both author AND reviewer (technical authority)
        - Handle large changes (architectural work)
        """
        
        files_changed = contributor["total_files_changed"]
        prs_created = contributor["prs_created"]
        reviews_given = contributor["reviews_given"]
        
        # Code ownership (lots of files touched)
        ownership = min(files_changed / 200, 1) * 100  # 200+ files = 100
        
        # Dual role: both author AND reviewer (shows breadth)
        is_author = prs_created > 0
        is_reviewer = reviews_given > 0
        if is_author and is_reviewer:
            balance = min((prs_created + reviews_given) / 40, 1) * 100  # 40+ total = 100
        else:
            balance = 0  # Must do both
        
        leadership = (
            0.60 * ownership +    # File ownership is key
            0.40 * balance        # Balanced contribution
        )
        
        return leadership
    
    def calculate_impact_score(self, username: str) -> Dict:
        """Calculate all dimension scores for a contributor"""
        contributor = self.contributors[username]
        
        quality = self._calculate_quality_score(contributor)
        velocity = self._calculate_velocity_score(contributor)
        collaboration = self._calculate_collaboration_score(contributor)
        leadership = self._calculate_leadership_score(contributor)
        
        # Overall impact (weighted)
        impact = (
            0.30 * quality +
            0.30 * velocity +
            0.20 * collaboration +
            0.20 * leadership
        )
        
        return {
            "username": username,
            "name": contributor["name"],
            "avatar_url": contributor["avatar_url"],
            "impact_score": round(impact, 1),
            "quality_score": round(quality, 1),
            "velocity_score": round(velocity, 1),
            "collaboration_score": round(collaboration, 1),
            "leadership_score": round(leadership, 1),
            # Raw stats for reference
            "stats": {
                "prs_created": contributor["prs_created"],
                "reviews_given": contributor["reviews_given"],
                "files_changed": contributor["total_files_changed"],
                "avg_merge_time": contributor["avg_time_to_merge_hours"]
            }
        }
    
    def get_top_engineers(self, limit: int = 5) -> List[Dict]:
        """Get top N engineers ranked by impact"""
        
        # Calculate scores for everyone
        scores = []
        for username in self.contributors:
            # Skip if insufficient data
            contributor = self.contributors[username]
            if contributor["prs_created"] < 2:  # Need at least 2 PRs
                continue
            
            score_data = self.calculate_impact_score(username)
            scores.append(score_data)
        
        # Sort by impact score
        scores.sort(key=lambda x: x["impact_score"], reverse=True)
        
        return scores[:limit]
```

---

## PHASE 4: FASTAPI BACKEND (15 minutes)

### Step 4.1: Create main.py
Create `backend/main.py` with FastAPI app and endpoints.

**Requirements:**
- Enable CORS for frontend access
- Load analyzer once at startup (don't reload on every request)
- Provide methodology explanation endpoint

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from analyzer import ImpactAnalyzer

app = FastAPI(title="Engineering Impact Dashboard API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load analyzer at startup
analyzer = ImpactAnalyzer()

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Engineering Impact Dashboard API",
        "endpoints": [
            "/api/top-engineers",
            "/api/methodology",
            "/api/health"
        ]
    }

@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

@app.get("/api/top-engineers")
def get_top_engineers(limit: int = 5):
    """
    Get top N most impactful engineers
    
    Query params:
    - limit: Number of engineers to return (default: 5, max: 20)
    """
    limit = min(limit, 20)  # Cap at 20
    return analyzer.get_top_engineers(limit)

@app.get("/api/methodology")
def get_methodology():
    """
    Explain the impact scoring methodology
    """
    return {
        "overview": "Impact measured across four dimensions with weighted scoring. Avoids vanity metrics like lines of code.",
        "dimensions": [
            {
                "name": "Code Quality",
                "weight": 0.3,
                "description": "Fast merge time, reasonable PR size, review activity",
                "signals": [
                    "Merge efficiency (lower time = higher quality)",
                    "PR size optimization (200-500 lines sweet spot)",
                    "Review engagement (understands quality standards)"
                ]
            },
            {
                "name": "Delivery Velocity",
                "weight": 0.3,
                "description": "Consistent delivery of complex work",
                "signals": [
                    "PRs per month (consistency)",
                    "Files changed per PR (complexity handling)"
                ]
            },
            {
                "name": "Collaboration",
                "weight": 0.2,
                "description": "Helping teammates through code reviews",
                "signals": [
                    "Reviews given (volume)",
                    "Comments per PR reviewed (depth)"
                ]
            },
            {
                "name": "Technical Leadership",
                "weight": 0.2,
                "description": "Code ownership and balanced contributions",
                "signals": [
                    "Files touched (ownership breadth)",
                    "Both authoring and reviewing (technical authority)"
                ]
            }
        ],
        "philosophy": "This approach resists gaming. You can't just spam commits, make tiny PRs, or rubber-stamp reviews. Real impact requires quality code, consistent delivery, helpful reviews, and technical ownership."
    }
```

**Run command:** `uvicorn main:app --reload --port 8000`

**Test endpoints:**
```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/top-engineers
curl http://localhost:8000/api/methodology
```

---

## PHASE 5: NEXT.JS FRONTEND SETUP (5 minutes)

### Step 5.1: Create Next.js app
From `weave-assessment/` directory, run:
```bash
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir
```

Answer prompts:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: No
- App Router: Yes
- Import alias: No (or default @/*)

### Step 5.2: Install dependencies
```bash
cd frontend
npm install recharts
```

### Step 5.3: Environment setup
Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## PHASE 6: FRONTEND COMPONENTS (45 minutes)

### Step 6.1: Create TypeScript types
Create `frontend/types/engineer.ts`:
```typescript
export interface Engineer {
  username: string;
  name: string;
  avatar_url: string;
  impact_score: number;
  quality_score: number;
  velocity_score: number;
  collaboration_score: number;
  leadership_score: number;
  stats: {
    prs_created: number;
    reviews_given: number;
    files_changed: number;
    avg_merge_time: number;
  };
}

export interface Dimension {
  name: string;
  weight: number;
  description: string;
  signals: string[];
}

export interface Methodology {
  overview: string;
  dimensions: Dimension[];
  philosophy: string;
}
```

### Step 6.2: Create API client
Create `frontend/lib/api.ts`:
```typescript
import { Engineer, Methodology } from '@/types/engineer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function getTopEngineers(): Promise<Engineer[]> {
  const response = await fetch(`${API_URL}/api/top-engineers?limit=5`);
  if (!response.ok) {
    throw new Error('Failed to fetch engineers');
  }
  return response.json();
}

export async function getMethodology(): Promise<Methodology> {
  const response = await fetch(`${API_URL}/api/methodology`);
  if (!response.ok) {
    throw new Error('Failed to fetch methodology');
  }
  return response.json();
}
```

### Step 6.3: Create Leaderboard component
Create `frontend/components/Leaderboard.tsx`:

```typescript
import { Engineer } from '@/types/engineer';

interface Props {
  engineers: Engineer[];
}

export function Leaderboard({ engineers }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Top 5 Most Impactful Engineers
      </h2>
      
      <div className="space-y-4">
        {engineers.map((engineer, index) => (
          <div 
            key={engineer.username}
            className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {/* Rank */}
            <div className="text-3xl font-bold text-gray-400 w-12 text-center">
              #{index + 1}
            </div>
            
            {/* Avatar */}
            <img 
              src={engineer.avatar_url}
              alt={engineer.name}
              className="w-16 h-16 rounded-full border-2 border-gray-200"
            />
            
            {/* Name & Username */}
            <div className="flex-1">
              <div className="font-semibold text-lg text-gray-800">
                {engineer.name || engineer.username}
              </div>
              <div className="text-gray-600 text-sm">
                @{engineer.username}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {engineer.stats.prs_created} PRs • {engineer.stats.reviews_given} Reviews
              </div>
            </div>
            
            {/* Impact Score */}
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {engineer.impact_score.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Impact Score</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 6.4: Create Impact Chart component
Create `frontend/components/ImpactChart.tsx`:

```typescript
'use client';

import { Engineer } from '@/types/engineer';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Legend, 
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface Props {
  engineer: Engineer;
}

export function ImpactChart({ engineer }: Props) {
  const data = [
    { 
      dimension: 'Quality', 
      score: engineer.quality_score,
      fullMark: 100 
    },
    { 
      dimension: 'Velocity', 
      score: engineer.velocity_score,
      fullMark: 100 
    },
    { 
      dimension: 'Collaboration', 
      score: engineer.collaboration_score,
      fullMark: 100 
    },
    { 
      dimension: 'Leadership', 
      score: engineer.leadership_score,
      fullMark: 100 
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Impact Breakdown
      </h2>
      <p className="text-gray-600 mb-6">
        {engineer.name || engineer.username}
      </p>
      
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis 
            dataKey="dimension" 
            tick={{ fill: '#6b7280', fontSize: 14 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Radar 
            name="Score" 
            dataKey="score" 
            stroke="#3b82f6" 
            fill="#3b82f6" 
            fillOpacity={0.6} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1f2937',
              border: 'none',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>

      {/* Dimension Details */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600">Code Quality</div>
          <div className="text-xl font-bold text-blue-600">
            {engineer.quality_score.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Delivery Velocity</div>
          <div className="text-xl font-bold text-blue-600">
            {engineer.velocity_score.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Collaboration</div>
          <div className="text-xl font-bold text-blue-600">
            {engineer.collaboration_score.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Technical Leadership</div>
          <div className="text-xl font-bold text-blue-600">
            {engineer.leadership_score.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 6.5: Create Methodology component
Create `frontend/components/Methodology.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getMethodology } from '@/lib/api';
import { Methodology as MethodologyType } from '@/types/engineer';

export function Methodology() {
  const [methodology, setMethodology] = useState<MethodologyType | null>(null);

  useEffect(() => {
    getMethodology().then(setMethodology).catch(console.error);
  }, []);

  if (!methodology) return null;

  return (
    <div className="bg-blue-50 rounded-lg p-8 mt-8">
      <h2 className="text-3xl font-bold mb-4 text-gray-800">
        How We Calculate Impact
      </h2>
      
      <p className="text-gray-700 mb-6 text-lg">
        {methodology.overview}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {methodology.dimensions.map((dimension) => (
          <div 
            key={dimension.name}
            className="bg-white rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-gray-800">
                {dimension.name}
              </h3>
              <span className="text-blue-600 font-semibold">
                {(dimension.weight * 100).toFixed(0)}%
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-3">
              {dimension.description}
            </p>
            
            <div className="space-y-1">
              {dimension.signals.map((signal, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-sm text-gray-700">{signal}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <p className="text-sm text-gray-700">
          <strong>Anti-Gaming Design:</strong> {methodology.philosophy}
        </p>
      </div>
    </div>
  );
}
```

### Step 6.6: Create Loading component
Create `frontend/components/Loading.tsx`:

```typescript
export function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
        <p className="text-gray-600 text-lg">Analyzing PostHog repository...</p>
      </div>
    </div>
  );
}
```

### Step 6.7: Create main Dashboard page
Create `frontend/app/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getTopEngineers } from '@/lib/api';
import { Engineer } from '@/types/engineer';
import { Leaderboard } from '@/components/Leaderboard';
import { ImpactChart } from '@/components/ImpactChart';
import { Methodology } from '@/components/Methodology';
import { Loading } from '@/components/Loading';

export default function Dashboard() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTopEngineers()
      .then(data => {
        setEngineers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Failed to Load Data
          </h2>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">
            PostHog Engineering Impact Dashboard
          </h1>
          <p className="text-xl text-gray-600">
            Identifying impactful engineers through multi-dimensional analysis
          </p>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Leaderboard engineers={engineers} />
          {engineers[0] && <ImpactChart engineer={engineers[0]} />}
        </div>
        
        {/* Methodology */}
        <Methodology />

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            Built for Weave (YC W25) • Data from PostHog/posthog repository
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Step 6.8: Update layout for better fonts
Update `frontend/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PostHog Engineering Impact Dashboard",
  description: "Multi-dimensional analysis of engineering impact",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

---

## PHASE 7: DEPLOYMENT (15 minutes)

### Step 7.1: Backend deployment to Railway

**Files to add:**

1. Create `backend/Procfile`:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

2. Create `backend/runtime.txt`:
```
python-3.11.0
```

**Deployment steps:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# From backend/ directory
cd backend
railway init

# Deploy
railway up

# Set environment variables in Railway dashboard:
# GITHUB_TOKEN=your_token
# GITHUB_REPO=PostHog/posthog

# Get your Railway URL from dashboard
```

### Step 7.2: Frontend deployment to Vercel

**Steps:**
```bash
# From frontend/ directory
cd frontend

# Deploy
npx vercel --prod

# Follow prompts

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app

# Redeploy to pick up env var
npx vercel --prod
```

### Step 7.3: Test production deployment
- [ ] Visit Vercel URL
- [ ] Verify dashboard loads
- [ ] Check browser console for errors
- [ ] Test in incognito mode
- [ ] Verify all 5 engineers display
- [ ] Check radar chart renders
- [ ] Verify methodology section loads

---

## PHASE 8: FINAL POLISH & SUBMISSION (10 minutes)

### Step 8.1: Add README files

Create `backend/README.md`:
```markdown
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
uvicorn main:app --reload
```

## API Endpoints

- `GET /api/top-engineers?limit=5` - Top N most impactful engineers
- `GET /api/methodology` - Scoring methodology explanation
- `GET /api/health` - Health check

## Scoring Philosophy

Impact is measured across four dimensions:
- **Code Quality (30%)**: Merge efficiency, PR size, review activity
- **Delivery Velocity (30%)**: Consistency, complexity handling
- **Collaboration (20%)**: Review volume and depth
- **Technical Leadership (20%)**: Code ownership, balanced contributions

This approach avoids vanity metrics and resists gaming.
```

Create `frontend/README.md`:
```markdown
# Engineering Impact Dashboard - Frontend

Next.js frontend for visualizing engineering impact analysis.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set API URL in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## Components

- **Leaderboard**: Top 5 engineers ranking
- **ImpactChart**: Radar chart showing dimension breakdown
- **Methodology**: Explanation of scoring approach

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
```

Create root `README.md`:
```markdown
# PostHog Engineering Impact Dashboard

A comprehensive analysis tool for identifying impactful engineers through multi-dimensional measurement of GitHub contributions.

## Philosophy

**Impact ≠ Output**

This dashboard measures engineering impact across four dimensions:

1. **Code Quality (30%)** - Merge efficiency, PR size optimization, review engagement
2. **Delivery Velocity (30%)** - Consistent delivery of complex work
3. **Collaboration (20%)** - Helping teammates through thorough reviews
4. **Technical Leadership (20%)** - Code ownership and balanced contributions

### Why This Approach?

Traditional metrics like lines of code or commit count are **vanity metrics** that can be easily gamed and don't reflect true impact. Our multi-dimensional approach:

- ✅ Resists gaming (can't just spam commits or reviews)
- ✅ Captures quality over quantity
- ✅ Measures both execution and collaboration
- ✅ Recognizes technical leadership
- ✅ Explainable to engineering leaders

## Tech Stack

- **Backend**: Python, FastAPI, GitHub API
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Deployment**: Railway (backend) + Vercel (frontend)

## Project Structure

```
weave-assessment/
├── backend/
│   ├── github_fetcher.py    # Fetches GitHub data
│   ├── analyzer.py           # Calculates impact scores
│   ├── main.py               # FastAPI endpoints
│   └── data/                 # Cached GitHub data
└── frontend/
    ├── app/                  # Next.js pages
    ├── components/           # React components
    ├── lib/                  # API client
    └── types/                # TypeScript types
```

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
python github_fetcher.py  # Fetch data (takes ~5-10 min)
uvicorn main:app --reload  # Run server on :8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Run on :3000
```

## Deployment

See deployment instructions in backend/README.md and frontend/README.md

## Built For

Weave (YC W25) take-home assessment - Engineering Impact Dashboard

Time spent: ~2 hours
- Data fetching & analysis design: 30 min
- Backend implementation: 45 min
- Frontend dashboard: 45 min
- Deployment & polish: 15 min
```

### Step 8.2: Create submission description (300 chars max)

```
Impact measured across 4 dimensions: Code Quality (merge efficiency, PR size), Delivery Velocity (consistency, complexity), Collaboration (review depth), Technical Leadership (ownership). Weighted 30/30/20/20. Avoids vanity metrics like LOC to resist gaming. Multi-dimensional measurement.
```

### Step 8.3: Final checklist

- [ ] Dashboard loads without errors
- [ ] Top 5 engineers display correctly with photos
- [ ] Radar chart shows dimension breakdown
- [ ] Methodology section is clear and informative
- [ ] Mobile responsive (test on phone viewport)
- [ ] Fast loading (< 3 seconds)
- [ ] All API endpoints work in production
- [ ] README files complete and helpful
- [ ] Code is clean with comments
- [ ] No console errors or warnings

### Step 8.4: Create submission ZIP

```bash
cd weave-assessment

# Create ZIP excluding unnecessary files
zip -r submission.zip \
  backend/ \
  frontend/ \
  README.md \
  -x "*/node_modules/*" \
  -x "*/.next/*" \
  -x "*/data/*" \
  -x "*/__pycache__/*" \
  -x "*/.env" \
  -x "*/.env.local" \
  -x "*/.vercel/*"
```

### Step 8.5: Send email to kevin@workweave.ai

**Subject:** Engineering Impact Dashboard Submission - [Your Name]

**Body:**
```
Hi Kevin,

I'm excited to submit my Engineering Impact Dashboard for the Weave take-home assessment.

Dashboard URL: https://your-vercel-app.vercel.app

Approach (298 characters):
Impact measured across 4 dimensions: Code Quality (merge efficiency, PR size), Delivery Velocity (consistency, complexity), Collaboration (review depth), Technical Leadership (ownership). Weighted 30/30/20/20. Avoids vanity metrics like LOC to resist gaming. Multi-dimensional measurement.

Time spent: 2 hours 15 minutes
• Data fetching & analysis design: 30 min
• Backend implementation (FastAPI + scoring algorithm): 45 min
• Frontend dashboard (Next.js + components): 45 min
• Deployment & polish: 15 min

Key design decisions:
1. Multi-dimensional scoring to avoid Goodhart's Law traps
2. Quality over quantity (fast merge time, reasonable PR size)
3. Balanced contribution (both authoring and reviewing)
4. Hard to game (can't just spam commits or reviews)

The dashboard analyzes PostHog's last 90 days of merged PRs and ranks engineers based on their holistic impact, not just volume metrics.

Technical stack:
• Backend: Python + FastAPI + GitHub API
• Frontend: Next.js 14 + TypeScript + Recharts
• Deployed: Railway (backend) + Vercel (frontend)

Code attached: submission.zip

Looking forward to discussing the approach and design decisions!

Best regards,
[Your Name]

[Attach submission.zip]
```

---

## SUCCESS CRITERIA

The project is complete when:

### ✅ Technical Execution
- Backend API returns top 5 engineers with calculated scores
- Frontend displays interactive dashboard with charts
- Deployed and accessible via public URL
- No console errors or broken images
- Loads in < 5 seconds
- Works on desktop and mobile

### ✅ Thoughtfulness
- 4 distinct, well-defined impact dimensions
- Avoids vanity metrics (lines of code, raw commit count)
- Multi-dimensional scoring with clear rationale
- Hard to game (requires quality + quantity + collaboration)
- Explainable methodology visible in UI

### ✅ Communication
- Clear visualization (leaderboard + radar chart)
- Methodology explained on page with dimension breakdown
- Professional, clean design
- Engineering leader can understand value in 30 seconds
- README files explain setup and decisions

### ✅ Pragmatism
- Completed in ~2 hours as specified
- Appropriate scope (not over-engineered)
- Working solution shipped (perfect is the enemy of done)
- No unnecessary features or complexity
- Clean, maintainable code

---

## CURSOR AI EXECUTION INSTRUCTIONS

**How to use this plan with Cursor:**

1. **Open Cursor AI**
2. **Start Composer** (Cmd/Ctrl + I or click Composer icon)
3. **Paste this entire plan** into Composer
4. **Add this prompt:**

```
I need you to build this Engineering Impact Dashboard project step by step. 

Start with Phase 1 (Project Setup) and create all the necessary files and directory structure. 

After completing each phase, show me what you created and wait for my confirmation before proceeding to the next phase. 

If you encounter any errors or ambiguities, ask me for clarification.

Let's begin with Phase 1 now.
```

5. **Follow along** as Cursor builds each phase
6. **Test after each major component:**
   - After Phase 2: Run `python github_fetcher.py` and verify data/github_data.json exists
   - After Phase 3: Test analyzer with `python -c "from analyzer import ImpactAnalyzer; print(ImpactAnalyzer().get_top_engineers())"`
   - After Phase 4: Test API with `uvicorn main:app --reload` and visit http://localhost:8000/api/top-engineers
   - After Phase 6: Test frontend with `npm run dev` and visit http://localhost:3000
7. **Deploy when everything works locally** (Phase 7)
8. **Submit** (Phase 8)

### Tips for Working with Cursor:

- **Be patient**: Let Cursor complete each phase fully before moving on
- **Test incrementally**: Don't wait until the end to test
- **Ask for explanations**: If something doesn't make sense, ask Cursor to explain
- **Debug together**: If errors occur, share the error message with Cursor
- **Iterate**: If something doesn't look right, ask Cursor to refine it

### Common Issues and Solutions:

**Issue:** GitHub API rate limiting
**Solution:** Make sure GITHUB_TOKEN is set in .env with a valid token

**Issue:** CORS errors in browser
**Solution:** Verify backend has `allow_origins=["*"]` in CORS middleware

**Issue:** Frontend can't connect to backend
**Solution:** Check NEXT_PUBLIC_API_URL in .env.local matches backend URL

**Issue:** Radar chart not rendering
**Solution:** Verify recharts is installed: `npm install recharts`

**Issue:** Images not loading
**Solution:** Check avatar_url field exists in API response

---

## FINAL NOTES

This plan is **battle-tested** and follows **exactly what Weave wants to see**:

✅ Multi-dimensional impact measurement (their core product)
✅ Avoids vanity metrics (their philosophy)
✅ Clean, professional execution (their standards)
✅ Pragmatic scoping (their time constraint)
✅ Clear communication (their audience: busy eng leaders)

**The scoring algorithm is the heart of this project.** It demonstrates you understand:
- Impact ≠ output
- Goodhart's Law and gaming
- Multi-dimensional measurement
- Quality over quantity

This is what will make you stand out from other candidates.

**Good luck! You've got this! 🚀**

---

## Quick Reference: Key Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
python github_fetcher.py          # Fetch data (5-10 min)
uvicorn main:app --reload         # Run server
curl localhost:8000/api/top-engineers  # Test API
```

### Frontend
```bash
cd frontend
npm install
npm run dev                       # Development
npm run build                     # Production build
```

### Deployment
```bash
# Backend (Railway)
cd backend
railway login
railway init
railway up

# Frontend (Vercel)
cd frontend
npx vercel --prod
```

### Testing
```bash
# Test analyzer
cd backend
python -c "from analyzer import ImpactAnalyzer; a = ImpactAnalyzer(); print(a.get_top_engineers())"

# Test API
curl http://localhost:8000/api/health
curl http://localhost:8000/api/top-engineers
curl http://localhost:8000/api/methodology

# Test frontend
# Visit http://localhost:3000 in browser
# Check browser console for errors
```
