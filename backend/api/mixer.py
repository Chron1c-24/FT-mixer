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

def resize_with_aspect(img, target_w, target_h):
    h, w = img.shape[:2]
    scale = min(target_w / w, target_h / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))

    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    x_off = (target_w - new_w) // 2
    y_off = (target_h - new_h) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized
    return canvas


def resize_ignore_aspect(img, target_w, target_h):
    return cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)


def unify_images_by_policy(images, resize_cfg):
    mode = resize_cfg.get("mode", "smallest")
    aspect = resize_cfg.get("aspect", "keep")
    fixed_width = int(resize_cfg.get("fixed_width", 512))
    fixed_height = int(resize_cfg.get("fixed_height", 512))

    widths = [img.shape[1] for img in images]
    heights = [img.shape[0] for img in images]

    if mode == "smallest":
        target_w = min(widths)
        target_h = min(heights)
    elif mode == "largest":
        target_w = max(widths)
        target_h = max(heights)
    elif mode == "fixed":
        target_w = fixed_width
        target_h = fixed_height
    else:
        target_w = min(widths)
        target_h = min(heights)

    resized_images = []
    for img in images:
        if aspect == "keep":
            resized = resize_with_aspect(img, target_w, target_h)
        else:
            resized = resize_ignore_aspect(img, target_w, target_h)
        resized_images.append(resized)

    return resized_images


class MixRequest(BaseModel):
    ports: List[str]
    mag_weights: List[float]
    phase_weights: List[float]
    target_port: str | None = None
    region: Dict[str, Any]
    resize: Dict[str, Any]
    simulate_slow: bool = False


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

    # ✅ resize step
    resized_images = unify_images_by_policy(active_images, req.resize)

    # ✅ build FT
    images_ft = [ImageFT(img) for img in resized_images]

    # ✅ region config
    region_pct = req.region.get("pct", 100) / 100.0
    region_inner = req.region.get("inner", True)
    offset_x = req.region.get("offset_x", 0)
    offset_y = req.region.get("offset_y", 0)

    if req.simulate_slow:
        import time
        time.sleep(5)

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