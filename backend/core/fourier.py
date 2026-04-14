import cv2
import numpy as np


def normalize_weights(weights):
    total = sum(weights)
    if total == 0:
        return [0.0 for _ in weights]
    return [w / total for w in weights]


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


def mix_mag_phase(
    images_ft,
    mag_weights,
    phase_weights,
    region_pct=1.0,
    region_inner=True,
    offset_x=0,
    offset_y=0,
):
    mag_weights = normalize_weights(mag_weights)
    phase_weights = normalize_weights(phase_weights)

    magnitudes = [np.abs(img.freq_shifted) for img in images_ft]
    phases = [np.angle(img.freq_shifted) for img in images_ft]

    mixed_magnitude = sum(w * m for w, m in zip(mag_weights, magnitudes))
    mixed_phase = sum(w * p for w, p in zip(phase_weights, phases))

    h, w = mixed_magnitude.shape

    # Rectangle size based on percentage
    rect_w = max(1, int(w * region_pct))
    rect_h = max(1, int(h * region_pct))

    # Start centered
    x1 = (w - rect_w) // 2
    y1 = (h - rect_h) // 2

    # Apply pan offsets coming from frontend
    x1 += int(offset_x)
    y1 += int(offset_y)

    # Clamp inside image bounds
    x1 = max(0, min(x1, w - rect_w))
    y1 = max(0, min(y1, h - rect_h))

    x2 = x1 + rect_w
    y2 = y1 + rect_h

    mask = np.zeros((h, w), dtype=np.float32)
    mask[y1:y2, x1:x2] = 1.0

    if not region_inner:
        mask = 1.0 - mask

    mixed_magnitude = mixed_magnitude * mask
    mixed_phase = mixed_phase * mask

    mixed_freq = mixed_magnitude * np.exp(1j * mixed_phase)
    mixed_spatial = np.fft.ifft2(np.fft.ifftshift(mixed_freq))
    mixed_spatial = np.abs(mixed_spatial)

    mixed_spatial = (mixed_spatial - mixed_spatial.min()) / (
        mixed_spatial.max() - mixed_spatial.min() + 1e-8
    )
    mixed_spatial = (mixed_spatial * 255).astype(np.uint8)

    return mixed_spatial