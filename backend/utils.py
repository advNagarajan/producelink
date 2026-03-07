from bson import ObjectId
from datetime import datetime


def serialize_doc(doc):
    """Convert a MongoDB document to a JSON-serializable dict."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [
                serialize_doc(i) if isinstance(i, dict)
                else str(i) if isinstance(i, ObjectId)
                else i
                for i in v
            ]
        else:
            out[k] = v
    return out
