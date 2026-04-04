from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import numpy as np
import cv2
import base64
from core.fourier import ImageFT, FTMixer
from pydantic import BaseModel
import json

router = APIRouter()

image_cache = {}
raw_image_cache = {}

global_settings = {
    "size_mode": "smallest", # "smallest", "largest", "fixed"
    "keep_aspect": False
}

def sync_all_images():
    if not raw_image_cache:
        return
        
    shapes = [img.shape[:2] for img in raw_image_cache.values()]
    
    if global_settings["size_mode"] == "smallest":
        target_shape = (min([s[1] for s in shapes]), min([s[0] for s in shapes])) # (w, h)
    elif global_settings["size_mode"] == "largest":
        target_shape = (max([s[1] for s in shapes]), max([s[0] for s in shapes]))
    else:
        target_shape = (512, 512)
        
    for pid, raw_img in list(raw_image_cache.items()):
        if global_settings["keep_aspect"]:
            # Basic resize with aspect ratio padding/crop
            h, w = raw_img.shape[:2]
            scale = min(target_shape[0]/w, target_shape[1]/h)
            new_w, new_h = int(w*scale), int(h*scale)
            resized = cv2.resize(raw_img, (new_w, new_h))
            padded = np.zeros((target_shape[1], target_shape[0]), dtype=np.uint8)
            y_off = (target_shape[1] - new_h) // 2
            x_off = (target_shape[0] - new_w) // 2
            padded[y_off:y_off+new_h, x_off:x_off+new_w] = resized
            final_img = padded
        else:
            final_img = cv2.resize(raw_img, target_shape)
            
        image_cache[pid] = ImageFT(final_img)

class PolicyRequest(BaseModel):
    size_mode: str
    keep_aspect: bool

@router.post("/policy")
def update_policy(req: PolicyRequest):
    global_settings["size_mode"] = req.size_mode
    global_settings["keep_aspect"] = req.keep_aspect
    sync_all_images()
    return {"status": "success"}

@router.post("/upload/{port_id}")
async def upload_image(port_id: str, file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    raw_image_cache[port_id] = img
    sync_all_images()
    
    final_img = image_cache[port_id].spatial
    _, encoded_img = cv2.imencode('.png', final_img.astype(np.uint8))
    b64_str = base64.b64encode(encoded_img).decode('utf-8')
    
    return {"port": port_id, "image_b64": b64_str}

@router.get("/component/{port_id}/{component_type}")
def get_component(port_id: str, component_type: str):
    if port_id not in image_cache:
        raise HTTPException(status_code=404, detail="Image not found for this port")
        
    img_ft = image_cache[port_id]
    
    if component_type == "magnitude":
        comp = img_ft.get_magnitude()
        comp = 20 * np.log(comp + 1)
    elif component_type == "phase":
        comp = img_ft.get_phase()
    elif component_type == "real":
        comp = img_ft.get_real()
    elif component_type == "imaginary":
        comp = img_ft.get_imaginary()
    else:
        raise HTTPException(status_code=400, detail="Invalid component type")
        
    comp_norm = cv2.normalize(comp, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    _, encoded_comp = cv2.imencode('.png', comp_norm)
    b64_str = base64.b64encode(encoded_comp).decode('utf-8')
    
    spatial = img_ft.spatial.astype(np.uint8)
    _, enc_spat = cv2.imencode('.png', spatial)
    spat_b64 = base64.b64encode(enc_spat).decode('utf-8')
    
    return {"port": port_id, "component": component_type, "image_b64": b64_str, "spatial_b64": spat_b64}

class MixRequest(BaseModel):
    ports: list[str]
    weights: list[dict]
    region: dict | None = None

@router.post("/mix")
def mix_images(req: MixRequest):
    aligned_images = []
    aligned_weights = []
    
    for port, weight in zip(req.ports, req.weights):
        if port in image_cache:
            aligned_images.append(image_cache[port])
            aligned_weights.append(weight)

    if not aligned_images:
        raise HTTPException(status_code=400, detail="No images are loaded")
        
    mixed_img = FTMixer.mix(aligned_images, aligned_weights, req.region)
    _, encoded_mix = cv2.imencode('.png', mixed_img)
    b64_str = base64.b64encode(encoded_mix).decode('utf-8')
    
    return {"mixed_image_b64": b64_str}
