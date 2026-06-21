import uuid
import os
import aiofiles
import magic
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, UploadFile, status
from app.config import settings

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-tar",
    "application/gzip",
}

MAX_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
_UPLOAD_DIR = Path(settings.UPLOAD_DIR).resolve()


def _is_within_upload_dir(path: Path) -> bool:
    """True if `path` resolves to a location inside the upload directory."""
    try:
        return path.resolve().is_relative_to(_UPLOAD_DIR)
    except (ValueError, OSError):
        return False


def _get_file_path(owner_key: str, file_id: uuid.UUID, filename: str) -> Path:
    """Build the on-disk path for an attachment. `owner_key` is a server-side
    identifier (e.g. a subtask UUID or "task/<uuid>"), never raw user input."""
    owner_dir = _UPLOAD_DIR / owner_key
    owner_dir.mkdir(parents=True, exist_ok=True)
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ").strip()
    path = (owner_dir / f"{file_id}_{safe_filename}").resolve()
    if not _is_within_upload_dir(path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    return path


async def save_file(
    owner_key: str,
    file: UploadFile,
) -> Tuple[uuid.UUID, str, str, int, str]:
    """
    Save uploaded file to disk. Validates MIME type via libmagic (content-based).
    `owner_key` scopes the storage directory (subtask UUID or "task/<uuid>").
    Returns: (file_id, filename, content_type, size_bytes, path)
    """
    header = await file.read(2048)
    detected_mime = magic.from_buffer(header, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{detected_mime}' is not allowed. Allowed: {sorted(ALLOWED_MIME_TYPES)}",
        )

    file_id = uuid.uuid4()
    file_path = _get_file_path(owner_key, file_id, file.filename or "unnamed")

    size_bytes = len(header)
    chunk_size = 64 * 1024
    too_large = False

    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            await out_file.write(header)
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > MAX_SIZE_BYTES:
                    too_large = True
                    break
                await out_file.write(chunk)
    except Exception:
        if file_path.exists():
            os.unlink(file_path)
        raise

    if too_large:
        os.unlink(file_path)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit",
        )

    return file_id, file.filename or "unnamed", detected_mime, size_bytes, str(file_path)


async def delete_file(path: str) -> None:
    """Delete a file from disk, silently ignore if not found."""
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to delete file {path}: {e}")


def get_file_path(path: str) -> Path:
    """Return Path for a stored file; raises 404 if missing, 400 on traversal attempt."""
    resolved = Path(path).resolve()
    if not _is_within_upload_dir(resolved):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path")
    if not resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    return resolved
