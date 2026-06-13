from datetime import datetime
import logging
import asyncio

import httpx

from app.core.config import settings
from app.services.octomatic import parse_utc

logger = logging.getLogger(__name__)


class NoestClient:
    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ):
        self.base_url = (base_url or settings.noest_base_url).rstrip("/")
        self.username = username or settings.noest_username
        self.password = password or settings.noest_password
        self._token: str | None = None

    async def _get_token(self) -> str:
        if self._token:
            return self._token
        url = f"{self.base_url}/auth/login"
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(url, json={
                    "username": self.username,
                    "password": self.password,
                })
                resp.raise_for_status()
                data = resp.json()
                self._token = data.get("token") or data.get("access_token") or ""
                if self._token:
                    return self._token
                logger.error("NoEST login response missing token: %s", data)
                raise ValueError("No token in response")
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    self._token = None
                logger.error("NoEST login HTTP error: %s - %s", e.response.status_code, e.response.text)
                raise
            except Exception as e:
                logger.error("NoEST login error: %s", e)
                raise

    async def _invalidate_token(self):
        self._token = None

    async def track(self, tracking_code: str) -> dict:
        token = await self._get_token()
        url = f"{self.base_url}/tracking/{tracking_code}"
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    await self._invalidate_token()
                logger.error("NoEST track HTTP error %s for code %s: %s", e.response.status_code, tracking_code, e.response.text)
                raise
            except Exception as e:
                logger.error("NoEST track error for code %s: %s", tracking_code, e)
                raise

    async def track_batch(self, codes: list[str]) -> dict[str, list[dict]]:
        if not codes:
            return {}
        results: dict[str, list[dict]] = {}
        semaphore = asyncio.Semaphore(5)

        async def _track_one(code: str):
            async with semaphore:
                try:
                    data = await self.track(code)
                    events = data if isinstance(data, list) else data.get("events", data.get("data", []))
                    results[code] = events
                except Exception as e:
                    logger.warning("Failed to track code %s: %s", code, e)
                    results[code] = []

        tasks = [_track_one(code) for code in codes]
        await asyncio.gather(*tasks, return_exceptions=True)
        return results

    @staticmethod
    def map_events(order_id: str, tracking_code: str, raw_events: list[dict]) -> list[dict]:
        mapped = []
        for event in raw_events:
            mapped.append({
                "order_id": order_id,
                "tracking_code": tracking_code,
                "status": event.get("status_code", ""),
                "status_label": event.get("status", ""),
                "location": event.get("center") or event.get("location"),
                "event_date": parse_utc(event.get("date")),
            })
        return mapped
