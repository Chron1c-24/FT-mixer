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

@router.get("/component/{port_id}/{component_type}")
def get_component(port_id: str, component_type: str):
    if port_id not in image_cache:
        raise HTTPException(status_code=404, detail=f"No image loaded in port {port_id}")

    img_ft = image_cache[port_id]
    component_type = component_type.lower()

    if component_type == "magnitude":
        comp = np.log1p(np.abs(img_ft.freq_shifted))
    elif component_type == "phase":
        comp = np.angle(img_ft.freq_shifted)
    elif component_type == "real":
        comp = np.real(img_ft.freq_shifted)
    elif component_type == "imaginary":
        comp = np.imag(img_ft.freq_shifted)
    else:
        raise HTTPException(status_code=400, detail="Invalid component type")

    comp = comp.astype(np.float32)
    comp = comp - comp.min()
    if comp.max() > 0:
        comp = comp / comp.max()
    comp = (comp * 255).astype(np.uint8)

    _, encoded = cv2.imencode(".png", comp)
    image_b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")

    return {"image_b64": image_b64}
    
@router.post("/mix")
def mix_images(req: MixRequest):
    active_images = []

    for port in req.ports:
        if port not in raw_image_cache:
            raise HTTPException(
                status_code=400,
                detail=f"Please load an image in port {port} before mixing."
            )
        active_images.append(raw_image_cache[port])

    min_h = min(img.shape[0] for img in active_images)
    min_w = min(img.shape[1] for img in active_images)

    resized_images = [
        cv2.resize(img, (min_w, min_h), interpolation=cv2.INTER_AREA)
        for img in active_images
    ]

    images_ft = [ImageFT(img) for img in resized_images]

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