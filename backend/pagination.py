"""
Utility functions for pagination and performance optimization
"""
from typing import Optional, List, Dict, Any
from functools import lru_cache
import time

class PaginationParams:
    """Helper class for pagination parameters"""
    def __init__(self, page: int = 1, page_size: int = 20, max_page_size: int = 100):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), max_page_size)
        
    @property
    def skip(self) -> int:
        """Calculate number of documents to skip"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """Get page size limit"""
        return self.page_size
    
    def paginate_response(self, items: List[Any], total_count: int) -> Dict[str, Any]:
        """Create paginated response"""
        total_pages = (total_count + self.page_size - 1) // self.page_size
        
        return {
            "items": items,
            "pagination": {
                "page": self.page,
                "pageSize": self.page_size,
                "totalItems": total_count,
                "totalPages": total_pages,
                "hasNext": self.page < total_pages,
                "hasPrevious": self.page > 1
            }
        }


# Simple in-memory cache with TTL
_cache = {}
_cache_timestamps = {}

def cached_response(key: str, ttl_seconds: int = 60):
    """
    Simple cache decorator for responses
    Usage: result = cached_response("cache_key", 300) or compute_result()
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            cache_key = f"{key}:{args}:{kwargs}"
            current_time = time.time()
            
            # Check if cached and not expired
            if cache_key in _cache:
                cached_time = _cache_timestamps.get(cache_key, 0)
                if current_time - cached_time < ttl_seconds:
                    return _cache[cache_key]
            
            # Compute and cache result
            result = func(*args, **kwargs)
            _cache[cache_key] = result
            _cache_timestamps[cache_key] = current_time
            
            return result
        return wrapper
    return decorator


def clear_cache(pattern: Optional[str] = None):
    """Clear cache entries matching pattern or all if pattern is None"""
    if pattern is None:
        _cache.clear()
        _cache_timestamps.clear()
    else:
        keys_to_delete = [k for k in _cache.keys() if pattern in k]
        for key in keys_to_delete:
            del _cache[key]
            del _cache_timestamps[key]
