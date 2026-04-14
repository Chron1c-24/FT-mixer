import numpy as np
import cv2

def normalize_weights(weights):
    total = sum(weights)
    if total == 0:
        return [0.0 for _ in weights]
    return [w / total for w in weights]


def mix_mag_phase(images_ft, mag_weights, phase_weights, region_pct=1.0, region_inner=True):
    mag_weights = normalize_weights(mag_weights)
    phase_weights = normalize_weights(phase_weights)

    magnitudes = [np.abs(img.freq_shifted) for img in images_ft]
    phases = [np.angle(img.freq_shifted) for img in images_ft]

    mixed_magnitude = sum(w * m for w, m in zip(mag_weights, magnitudes))
    mixed_phase = sum(w * p for w, p in zip(phase_weights, phases))

    # region mask
    h, w = mixed_magnitude.shape
    cx, cy = w // 2, h // 2
    rw = int((w * region_pct) / 2)
    rh = int((h * region_pct) / 2)

    mask = np.zeros((h, w), dtype=np.float32)
    x1, x2 = max(0, cx - rw), min(w, cx + rw)
    y1, y2 = max(0, cy - rh), min(h, cy + rh)
    mask[y1:y2, x1:x2] = 1.0

    if not region_inner:
        mask = 1.0 - mask

    mixed_magnitude *= mask
    mixed_phase *= mask

    mixed_freq = mixed_magnitude * np.exp(1j * mixed_phase)
    mixed_spatial = np.fft.ifft2(np.fft.ifftshift(mixed_freq))
    mixed_spatial = np.abs(mixed_spatial)

    mixed_spatial = (mixed_spatial - mixed_spatial.min()) / (
        mixed_spatial.max() - mixed_spatial.min() + 1e-8
    )
    mixed_spatial = (mixed_spatial * 255).astype(np.uint8)

    return mixed_spatial


class ImageFT:
    def __init__(self, image: np.ndarray):
        self.original_color = image.copy()

        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        self.spatial = gray.astype(np.float32)
        self.freq_complex = np.fft.fft2(self.spatial)
        self.freq_shifted = np.fft.fftshift(self.freq_complex)

    def get_magnitude(self) -> np.ndarray:
        return np.abs(self.freq_shifted)
        
    def get_phase(self) -> np.ndarray:
        return np.angle(self.freq_shifted)

    def get_real(self) -> np.ndarray:
        return np.real(self.freq_shifted)

    def get_imaginary(self) -> np.ndarray:
        return np.imag(self.freq_shifted)

class FTMixer:
    @staticmethod
    def mix(images: list[ImageFT], weights: list[dict], region: dict) -> np.ndarray:
        """
        Mix multiple images by weights in freq domain, optionally inside/outside an inner region.
        weights -> list of dict: [{'mag': 0.5, 'phase': 0.0}, ...] or [{'real': 0.5, 'imag': 0.0}, ...]
        region -> dict: {'inner': bool, 'x': int, 'y': int, 'w': int, 'h': int} or None
        """
        if not images:
            return np.zeros((10, 10), dtype=np.uint8)
            
        shape = images[0].spatial.shape
        mixed_freq = np.zeros(shape, dtype=np.complex128)
        # Determine mix mode based on first weight dict
        is_mag_phase = 'mag' in weights[0] and 'phase' in weights[0]
        
        if is_mag_phase:
            total_mag = np.zeros(shape, dtype=np.float64)
            total_phase = np.zeros(shape, dtype=np.float64)
            for img, w in zip(images, weights):
                total_mag += img.get_magnitude() * (w['mag'] / 100.0)
                total_phase += img.get_phase() * (w['phase'] / 100.0)
            
            # Combine Magnitude and Phase into Complex Exponential
            mixed_freq = total_mag * np.exp(1j * total_phase)
        else:
            real_part = np.zeros(shape, dtype=np.float64)
            imag_part = np.zeros(shape, dtype=np.float64)
            for img, w in zip(images, weights):
                real_part += img.get_real() * (w.get('real', 0) / 100.0)
                imag_part += img.get_imaginary() * (w.get('imag', 0) / 100.0)
            mixed_freq = real_part + 1j * imag_part
                
        # region masking
        if region:
            pct = region.get('pct', 100.0)
            is_inner = region.get('inner', True)
            
            mask = np.zeros(shape, dtype=bool) if is_inner else np.ones(shape, dtype=bool)
            rows, cols = shape
            
            w_val = int(cols * (pct / 100.0))
            h_val = int(rows * (pct / 100.0))
            x = (cols - w_val) // 2
            y = (rows - h_val) // 2
            
            if is_inner:
                mask[y:y+h_val, x:x+w_val] = True
            else:
                mask[y:y+h_val, x:x+w_val] = False
                
            mixed_freq = np.where(mask, mixed_freq, 0)
        
        mixed_spatial = np.fft.ifft2(np.fft.ifftshift(mixed_freq))
        
        # normalize to uint8
        out = np.abs(mixed_spatial)
        out = cv2.normalize(out, None, 0, 255, cv2.NORM_MINMAX)
        return out.astype(np.uint8)
