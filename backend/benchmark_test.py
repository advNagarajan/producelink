"""
Performance Benchmark Test for ProduceLink API
Tests response times, throughput, and identifies bottlenecks
"""
import asyncio
import time
import statistics
import httpx
from typing import List, Dict
import json

BASE_URL = "http://localhost:8000"

class PerformanceTester:
    def __init__(self):
        self.results = []
        
    async def test_endpoint(self, client: httpx.AsyncClient, method: str, endpoint: str, 
                           headers: Dict | None = None, json_data: Dict | None = None, iterations: int = 10):
        """Test a single endpoint multiple times"""
        times = []
        
        for _ in range(iterations):
            start = time.perf_counter()
            try:
                if method == "GET":
                    response = await client.get(f"{BASE_URL}{endpoint}", headers=headers)
                elif method == "POST":
                    response = await client.post(f"{BASE_URL}{endpoint}", headers=headers, json=json_data)
                
                end = time.perf_counter()
                elapsed = (end - start) * 1000  # Convert to ms
                
                if response.status_code < 400:
                    times.append(elapsed)
            except Exception as e:
                print(f"Error testing {endpoint}: {e}")
        
        if times:
            return {
                "endpoint": endpoint,
                "method": method,
                "avg_ms": statistics.mean(times),
                "min_ms": min(times),
                "max_ms": max(times),
                "median_ms": statistics.median(times),
                "iterations": len(times)
            }
        return None
    
    async def run_benchmarks(self):
        """Run all benchmark tests"""
        print("🚀 Starting Performance Benchmark Tests\n")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test 1: Root endpoint
            print("Testing root endpoint...")
            result = await self.test_endpoint(client, "GET", "/", iterations=20)
            if result:
                self.results.append(result)
            
            # Test 2: Market endpoint (without auth - should fail gracefully)
            print("Testing market endpoint (unauth)...")
            result = await self.test_endpoint(client, "GET", "/api/market", iterations=10)
            if result:
                self.results.append(result)
        
        self.print_results()
    
    def print_results(self):
        """Print benchmark results in a formatted table"""
        print("\n" + "="*80)
        print("📊 PERFORMANCE BENCHMARK RESULTS")
        print("="*80)
        
        if not self.results:
            print("No results collected")
            return
        
        print(f"\n{'Endpoint':<30} {'Method':<8} {'Avg (ms)':<12} {'Min (ms)':<12} {'Max (ms)':<12}")
        print("-"*80)
        
        for result in self.results:
            print(f"{result['endpoint']:<30} {result['method']:<8} "
                  f"{result['avg_ms']:<12.2f} {result['min_ms']:<12.2f} {result['max_ms']:<12.2f}")
        
        print("\n" + "="*80)
        print("🎯 PERFORMANCE ANALYSIS")
        print("="*80)
        
        # Analyze results
        slow_endpoints = [r for r in self.results if r['avg_ms'] > 100]
        if slow_endpoints:
            print("\n⚠️  SLOW ENDPOINTS (>100ms average):")
            for endpoint in slow_endpoints:
                print(f"  - {endpoint['endpoint']}: {endpoint['avg_ms']:.2f}ms average")
        else:
            print("\n✅ All endpoints performing well (<100ms)")
        
        # Best and worst performers
        if len(self.results) > 1:
            fastest = min(self.results, key=lambda x: x['avg_ms'])
            slowest = max(self.results, key=lambda x: x['avg_ms'])
            print(f"\n🏆 Fastest: {fastest['endpoint']} ({fastest['avg_ms']:.2f}ms)")
            print(f"🐌 Slowest: {slowest['endpoint']} ({slowest['avg_ms']:.2f}ms)")

if __name__ == "__main__":
    tester = PerformanceTester()
    asyncio.run(tester.run_benchmarks())
