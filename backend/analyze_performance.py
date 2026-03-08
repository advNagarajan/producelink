"""
Code Performance Analysis for ProduceLink
Identifies performance issues and optimization opportunities
"""
import os
import re
from pathlib import Path
from typing import List, Dict

class PerformanceAnalyzer:
    def __init__(self, backend_dir: str):
        self.backend_dir = Path(backend_dir)
        self.issues = []
        
    def analyze_all(self):
        """Run all analysis checks"""
        print("🔍 Starting Code Performance Analysis\n")
        
        self.check_database_queries()
        self.check_missing_indexes()
        self.check_n_plus_one()
        self.check_missing_caching()
        self.check_large_list_loads()
        
        self.print_report()
    
    def check_database_queries(self):
        """Check for inefficient database queries"""
        print("Checking database query patterns...")
        
        for py_file in self.backend_dir.rglob("*.py"):
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                
                # Check for .find() without projection
                for i, line in enumerate(lines, 1):
                    if re.search(r'\.find\([^)]*\)\.', line) and '{' not in line:
                        if '_id' in line or 'ObjectId' in line:
                            continue  # Skip if already using specific query
                        self.issues.append({
                            "type": "Query Optimization",
                            "severity": "Medium",
                            "file": str(py_file.relative_to(self.backend_dir)),
                            "line": i,
                            "message": "Consider adding field projection to reduce data transfer",
                            "line_content": line.strip()
                        })
    
    def check_missing_indexes(self):
        """Check if database indexes are defined"""
        print("Checking for database index definitions...")
        
        # Check if there's an indexes file or index creation code
        index_files = list(self.backend_dir.rglob("*index*.py"))
        
        if not index_files:
            self.issues.append({
                "type": "Missing Indexes",
                "severity": "High",
                "file": "database",
                "line": 0,
                "message": "No database indexes defined. Add indexes for frequently queried fields (farmerId, harvestId, status, createdAt, etc.)",
                "line_content": ""
            })
    
    def check_n_plus_one(self):
        """Check for potential N+1 query problems"""
        print("Checking for N+1 query patterns...")
        
        for py_file in self.backend_dir.rglob("*.py"):
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                
                # Look for sequential find_one calls
                sequential_queries = 0
                query_block_start = 0
                
                for i, line in enumerate(lines, 1):
                    if 'find_one' in line and 'await' in line:
                        if sequential_queries == 0:
                            query_block_start = i
                        sequential_queries += 1
                    elif sequential_queries > 0 and line.strip() and not line.strip().startswith('#'):
                        if sequential_queries >= 3:
                            self.issues.append({
                                "type": "N+1 Query Problem",
                                "severity": "High",
                                "file": str(py_file.relative_to(self.backend_dir)),
                                "line": query_block_start,
                                "message": f"Found {sequential_queries} sequential queries. Consider using $lookup aggregation or batch queries",
                                "line_content": f"Lines {query_block_start}-{i-1}"
                            })
                        sequential_queries = 0
    
    def check_missing_caching(self):
        """Check if caching is implemented"""
        print("Checking for caching implementation...")
        
        # Check if any caching library is used
        has_cache = False
        for py_file in self.backend_dir.rglob("*.py"):
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'cache' in content.lower() or 'redis' in content.lower() or 'lru_cache' in content:
                    has_cache = True
                    break
        
        if not has_cache:
            self.issues.append({
                "type": "Missing Caching",
                "severity": "Medium",
                "file": "general",
                "line": 0,
                "message": "No caching implementation found. Consider adding response caching for frequently accessed data",
                "line_content": ""
            })
    
    def check_large_list_loads(self):
        """Check for large list loads into memory"""
        print("Checking for large list operations...")
        
        for py_file in self.backend_dir.rglob("*.py"):
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                
                for i, line in enumerate(lines, 1):
                    # Check for .to_list(large_number)
                    match = re.search(r'\.to_list\((\d+)\)', line)
                    if match:
                        limit = int(match.group(1))
                        if limit >= 100:
                            self.issues.append({
                                "type": "Large List Load",
                                "severity": "Medium",
                                "file": str(py_file.relative_to(self.backend_dir)),
                                "line": i,
                                "message": f"Loading {limit} documents into memory. Consider pagination or cursor-based approach",
                                "line_content": line.strip()
                            })
    
    def print_report(self):
        """Print analysis report"""
        print("\n" + "="*100)
        print("📋 PERFORMANCE ANALYSIS REPORT")
        print("="*100)
        
        if not self.issues:
            print("\n✅ No major performance issues found!")
            return
        
        # Group by severity
        high_priority = [i for i in self.issues if i['severity'] == 'High']
        medium_priority = [i for i in self.issues if i['severity'] == 'Medium']
        
        print(f"\n⚠️  Found {len(self.issues)} potential issues:")
        print(f"  - High Priority: {len(high_priority)}")
        print(f"  - Medium Priority: {len(medium_priority)}")
        
        # Print high priority issues
        if high_priority:
            print("\n🔴 HIGH PRIORITY ISSUES:")
            print("-"*100)
            for issue in high_priority:
                print(f"\n[{issue['type']}] {issue['file']}")
                if issue['line'] > 0:
                    print(f"  Line {issue['line']}: {issue['message']}")
                else:
                    print(f"  {issue['message']}")
                if issue['line_content']:
                    print(f"  Code: {issue['line_content']}")
        
        # Print medium priority issues
        if medium_priority:
            print("\n🟡 MEDIUM PRIORITY ISSUES:")
            print("-"*100)
            for issue in medium_priority:
                print(f"\n[{issue['type']}] {issue['file']}")
                if issue['line'] > 0:
                    print(f"  Line {issue['line']}: {issue['message']}")
                else:
                    print(f"  {issue['message']}")
        
        print("\n" + "="*100)
        print("\n💡 RECOMMENDED OPTIMIZATIONS:")
        print("="*100)
        print("""
1. Add database indexes for frequently queried fields
2. Implement response caching with Redis or in-memory cache
3. Use aggregation pipelines to reduce N+1 queries
4. Add field projections to database queries
5. Implement pagination for large result sets
6. Add connection pooling configuration
7. Enable GZIP compression middleware
8. Add request rate limiting
        """)

if __name__ == "__main__":
    analyzer = PerformanceAnalyzer(".")
    analyzer.analyze_all()
