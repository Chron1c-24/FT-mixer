from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import numpy as np
import cv2
import base64

from core.fourier import ImageFT, mix_mag_phase

router = APIRouter()

image_cache: dict[str, ImageFT] = {}
raw_image_cache: dict[str, np.ndarray] = {}


class MixRequest(BaseModel):
    ports: List[str]
    mag_weights: List[float]
    phase_weights: List[float]
    target_port: str | None = None
    region: Dict[str, Any]


@router.post("/upload/{port_id}")
async def upload_image(port_id: str, file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image.")

    raw_image_cache[port_id] = img
    image_cache[port_id] = ImageFT(img)

    return {"message": f"Image uploaded to port {port_id}"}


@router.post("/mix")
def mix_images(req: MixRequest):
    images_ft = []

    for port in req.ports:
        if port not in image_cache:
            raise HTTPException(
                status_code=400,
                detail=f"Please load an image in port {port} before mixing."
            )
        images_ft.append(image_cache[port])

    region_pct = req.region.get("pct", 100) / 100.0
    region_inner = req.region.get("inner", True)
    offset_x = req.region.get("offset_x", 0)
    offset_y = req.region.get("offset_y", 0)

    result = mix_mag_phase(
        images_ft=images_ft,
        mag_weights=req.mag_weights,
        phase_weights=req.phase_weights,
        region_pct=region_pct,
        region_inner=region_inner,
        offset_x=offset_x,
        offset_y=offset_y,
    )

    _, encoded = cv2.imencode(".png", result)
    mixed_image_b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")

    return {"mixed_image_b64": mixed_image_b64}