import os
import time
import requests
from datetime import datetime, timedelta, timezone
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
        self.repo = _parse_repo_url(os.getenv("Github_repo", ""))
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
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_str = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
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
        url = f"{self.base_url}/repos/{self.repo}/pulls/{pr_number}"
        return self._request(url)

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
        """
        Build a dict of contributors with their stats.
        """
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
                    if r_username:
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

        print()
        print("Aggregating data...")
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
