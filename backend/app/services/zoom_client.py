"""
Zoom recording download helper.

Zoom provides a short-lived download_token in the recording.completed webhook payload.
It is sent as a Bearer token in the Authorization header when fetching recording files.
"""

import httpx


def download_recording(url: str, download_token: str | None) -> bytes:
    """
    Fetch recording bytes from a Zoom download URL.

    download_token is the short-lived JWT from the webhook payload top-level
    'download_token' field. If None (e.g., in test environments), the URL is
    fetched without auth and will fail if Zoom requires it.

    Raises httpx.HTTPStatusError on non-2xx responses.
    Raises httpx.RequestError on network failures.
    """
    headers = {}
    if download_token:
        headers["Authorization"] = f"Bearer {download_token}"

    with httpx.Client(follow_redirects=True, timeout=120.0) as client:
        response = client.get(url, headers=headers)
        response.raise_for_status()
        return response.content


def pick_recording_url(recording_files: list[dict]) -> str | None:
    """
    Given the list of recording_files from a Zoom webhook payload, pick the best
    file for transcription: prefer M4A (audio-only, smaller), fall back to MP4.

    Returns None if no usable recording file is found.
    """
    preference = ("M4A", "MP4", "m4a", "mp4")
    by_type: dict[str, str] = {}

    for f in recording_files:
        if f.get("status") != "completed":
            continue
        ftype = (f.get("file_type") or "").upper()
        url = f.get("download_url") or f.get("play_url")
        if ftype in ("M4A", "MP4") and url:
            by_type[ftype] = url

    for preferred in preference:
        if preferred.upper() in by_type:
            return by_type[preferred.upper()]

    return None
