from datetime import datetime
import logging
from typing import AsyncGenerator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def parse_utc(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=__import__("zoneinfo").ZoneInfo("UTC"))
        return dt
    except (ValueError, TypeError):
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=__import__("zoneinfo").ZoneInfo("UTC"))
        except (ValueError, TypeError):
            continue
    logger.warning("Could not parse date: %s", s)
    return None


def _map_octomatic_order(item: dict) -> dict:
    status_map = {
        "pending": "pending",
        "confirmed": "confirmed",
        "shipped": "shipped",
        "delivered": "delivered",
        "cancelled": "cancelled",
        "returned": "returned",
        "waiting": "pending",
    }
    raw_status = (item.get("status") or "").lower()
    mapped_status = status_map.get(raw_status, "pending")

    confirmed_by = None
    if item.get("confirmed_by") and isinstance(item["confirmed_by"], dict):
        confirmed_by = item["confirmed_by"].get("fullname")

    return {
        "id": str(item.get("id", "")),
        "reference": item.get("reference", ""),
        "customer_name": item.get("client_name", "") or item.get("name", ""),
        "customer_phone": item.get("phone", ""),
        "wilaya": item.get("wilaya", ""),
        "commune": item.get("commune"),
        "address": item.get("address"),
        "total": float(item.get("total_price", 0) or 0),
        "status": mapped_status,
        "confirmed_by": confirmed_by,
        "date_created": parse_utc(item.get("date_and_time") or item.get("created_at")),
        "tracking_code": item.get("tracking_code"),
        "raw_json": item,
    }


class OctomaticClient:
    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        store_slug: str | None = None,
    ):
        self.base_url = (base_url or settings.octomatic_base_url).rstrip("/")
        self.api_key = api_key or settings.octomatic_api_key
        self.store_slug = store_slug or settings.octomatic_store_slug

    async def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    async def get_orders(
        self,
        page: int = 1,
        per_page: int = 100,
        status: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        url = f"{self.base_url}/orders"
        params: dict = {"page": page, "per_page": per_page}
        if status:
            params["status"] = status
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to
        headers = await self._get_headers()

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(url, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list):
                    return {"data": data, "meta": {"last_page": 1, "total": len(data)}}
                return data
            except httpx.HTTPStatusError as e:
                logger.error("Octomatic get_orders HTTP error: %s - %s", e.response.status_code, e.response.text)
                raise
            except Exception as e:
                logger.error("Octomatic get_orders error: %s", e)
                raise

    async def get_order(self, order_id: str) -> dict:
        url = f"{self.base_url}/orders/{order_id}"
        headers = await self._get_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.error("Octomatic get_order HTTP error: %s - %s", e.response.status_code, e.response.text)
                raise
            except Exception as e:
                logger.error("Octomatic get_order error: %s", e)
                raise

    async def get_all_orders_paginated(
        self, date_from: str | None = None
    ) -> AsyncGenerator[list[dict], None]:
        page = 1
        while True:
            try:
                data = await self.get_orders(page=page, per_page=100, date_from=date_from)
                items = data.get("data", [])
                if not items:
                    break
                yield [_map_octomatic_order(item) for item in items]
                meta = data.get("meta", {})
                last_page = meta.get("last_page", 1)
                if page >= last_page:
                    break
                page += 1
            except Exception as e:
                logger.error("Error fetching page %d: %s", page, e)
                break
