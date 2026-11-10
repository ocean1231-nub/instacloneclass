"""Storage operations run only on the server using its secret key."""
from urllib.parse import quote
import httpx

BUCKET = "post-images"


class Storage:
    def __init__(self, settings):
        self.base = settings.supabase_url.rstrip("/")
        self.client = httpx.Client(base_url=f"{self.base}/storage/v1", headers={
            "apikey": settings.supabase_secret_key.get_secret_value(),
            "Authorization": f"Bearer {settings.supabase_secret_key.get_secret_value()}",
        }, timeout=30)

    def upload_if_missing(self, path, content):
        encoded = quote(path, safe="/")
        response = self.client.post(f"/object/{BUCKET}/{encoded}", content=content,
                                    headers={"Content-Type": "image/png", "x-upsert": "false"})
        if response.status_code not in (200, 201, 409):
            response.raise_for_status()
        return f"{self.base}/storage/v1/object/public/{BUCKET}/{encoded}"

    def close(self):
        self.client.close()

    def upload(self, path, content, content_type):
        encoded = quote(path, safe="/")
        response = self.client.post(f"/object/{BUCKET}/{encoded}", content=content,
                                    headers={"Content-Type": content_type, "x-upsert": "false"})
        response.raise_for_status()
        return f"{self.base}/storage/v1/object/public/{BUCKET}/{encoded}"

    def delete(self, path):
        response = self.client.delete(f"/object/{BUCKET}/{quote(path, safe='/')}")
        response.raise_for_status()


def ensure_bucket(settings):
    storage = Storage(settings)
    try:
        response = storage.client.get(f"/bucket/{BUCKET}")
        if response.status_code == 404 or (response.status_code == 400 and response.json().get('code') == 'NoSuchBucket'):
            response = storage.client.post("/bucket", json={"id": BUCKET, "name": BUCKET, "public": True})
            if response.status_code not in (200, 201, 409):
                response.raise_for_status()
            response = storage.client.get(f"/bucket/{BUCKET}")
        response.raise_for_status()
        if not response.json().get("public"):
            raise RuntimeError("기존 post-images 버킷이 비공개입니다. 공개 설정을 확인해 주세요.")
        return storage
    except Exception:
        storage.close()
        raise
