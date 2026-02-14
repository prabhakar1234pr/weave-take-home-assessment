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
    
    def get_all_engineers(self) -> List[Dict]:
        """Get all engineers ranked by impact"""
        scores = []
        for username in self.contributors:
            contributor = self.contributors[username]
            if contributor["prs_created"] < 2:
                continue
            score_data = self.calculate_impact_score(username)
            scores.append(score_data)
        scores.sort(key=lambda x: x["impact_score"], reverse=True)
        return scores

    def get_top_engineers(self, limit: int = 5) -> List[Dict]:
        """Get top N engineers ranked by impact"""
        return self.get_all_engineers()[:limit]
