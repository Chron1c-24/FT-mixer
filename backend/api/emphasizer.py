from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import cv2
import base64
from api.mixer import image_cache
from core.fourier import ImageFT

router = APIRouter()

class EmphasizeRequest(BaseModel):
    port: str
    action: str
    domain: str
    # Add parameters later if needed, hardcode defaults for now

@router.post("/process")
def process_emphasizer(req: EmphasizeRequest):
    if req.port not in image_cache:
        raise HTTPException(status_code=400, detail="Original image not loaded")
        
    img_ft = image_cache[req.port]
    spatial = img_ft.spatial.copy()
    
    transformed_spatial = spatial
    
    if req.action == "shift":
        transformed_spatial = np.roll(spatial, 50, axis=0)
        transformed_spatial = np.roll(transformed_spatial, 50, axis=1)
    elif req.action == "mirror":
        transformed_spatial = np.fliplr(spatial)
    elif req.action == "rotate":
        rows, cols = spatial.shape
        M = cv2.getRotationMatrix2D((cols/2, rows/2), 45, 1)
        transformed_spatial = cv2.warpAffine(spatial, M, (cols, rows))
    else:
        # Fallback to returning the same image if unimplemented
        pass
        
    # Instantiate the new ImageFT struct and assign to Port 6
    new_ft = ImageFT(transformed_spatial)
    image_cache["6"] = new_ft
    
    # Return base64 spatial
    out_img = transformed_spatial.astype(np.uint8)
    _, encoded_img = cv2.imencode('.png', out_img)
    b64_str = base64.b64encode(encoded_img).decode('utf-8')
    
    return {"success": True, "spatial_b64": b64_str, "target_port": "6"}
