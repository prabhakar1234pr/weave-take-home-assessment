from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from analyzer import ImpactAnalyzer
from collections import defaultdict
from datetime import datetime

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
            "/api/all-engineers",
            "/api/trends",
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


@app.get("/api/all-engineers")
def get_all_engineers():
    """
    Get all engineers ranked by impact score
    """
    return analyzer.get_all_engineers()


@app.get("/api/trends")
def get_trends(top: int = 5):
    """
    Get weekly PR activity trends for top N engineers.
    Returns a list of {week, engineer1_count, engineer2_count, ...} objects.
    """
    top = min(top, 10)
    top_engineers = analyzer.get_top_engineers(top)
    top_usernames = {e["username"] for e in top_engineers}

    # Group PRs by ISO week and author
    weekly: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for pr in analyzer.prs:
        author = pr.get("author_username", "")
        if author not in top_usernames:
            continue
        merged_at = pr.get("merged_at")
        if not merged_at:
            continue
        dt = datetime.fromisoformat(merged_at.replace("Z", "+00:00"))
        week_label = dt.strftime("%b %d")
        # Use Monday of that week for consistent sorting
        iso = dt.isocalendar()
        week_key = f"{iso[0]}-W{iso[1]:02d}"
        weekly[week_key][author] += 1

    # Sort weeks chronologically
    sorted_weeks = sorted(weekly.keys())

    # Build chart-friendly data
    series = []
    for wk in sorted_weeks:
        # Convert week key back to a readable label
        yr, w = wk.split("-W")
        dt = datetime.strptime(f"{yr} {w} 1", "%Y %W %w")
        label = dt.strftime("%b %d")
        row: dict = {"week": label}
        for eng in top_engineers:
            row[eng["username"]] = weekly[wk].get(eng["username"], 0)
        series.append(row)

    return {
        "engineers": [{"username": e["username"], "name": e["name"]} for e in top_engineers],
        "series": series,
    }


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
