import httpx
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid

logger = logging.getLogger("orbitra7.live_data")

# In-memory database for hazards (potholes, closures)
class HazardDB:
    def __init__(self):
        self._hazards: Dict[str, Dict[str, Any]] = {}

    def add_hazard(self, lat: float, lon: float, hazard_type: str, description: str, severity: str = "medium") -> Dict[str, Any]:
        hazard_id = str(uuid.uuid4())
        hazard = {
            "id": hazard_id,
            "type": hazard_type,
            "description": description,
            "severity": severity,
            "coordinates": [lon, lat],
            "reported_at": datetime.now(timezone.utc).isoformat(),
            "verified": False,
            "status": "active"
        }
        self._hazards[hazard_id] = hazard
        return hazard

    def get_active_hazards(self) -> List[Dict[str, Any]]:
        return [h for h in self._hazards.values() if h["status"] == "active"]

    def mark_resolved(self, hazard_id: str):
        if hazard_id in self._hazards:
            self._hazards[hazard_id]["status"] = "resolved"

hazard_db = HazardDB()

# Seed with some realistic local hazards for demonstration if empty
if not hazard_db.get_active_hazards():
    # Adding a simulated hazard near Kochi (for the Kerala 2018 scenario context)
    hazard_db.add_hazard(9.970, 76.280, "pothole", "Severe road damage from recent waterlogging.", "high")
    hazard_db.add_hazard(9.980, 76.290, "closure", "Debris blocking road.", "high")


async def fetch_live_weather(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches real-time weather from Open-Meteo.
    Free tier: no API key, 10k requests/day.
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=precipitation,weathercode&timezone=auto"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            # Parse response
            current = data.get("current_weather", {})
            return {
                "status": "success",
                "source": "Open-Meteo API",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "temperature": current.get("temperature"),
                    "windspeed": current.get("windspeed"),
                    "weathercode": current.get("weathercode"),
                    "observation_time": current.get("time")
                }
            }
    except Exception as e:
        logger.error(f"Weather API fetch failed: {e}")
        return {
            "status": "error",
            "source": "Open-Meteo API",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "fallback": True,
            "data": {
                "temperature": None,
                "windspeed": None,
                "weathercode": None
            }
        }
