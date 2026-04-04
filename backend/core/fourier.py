import numpy as np
import cv2

class ImageFT:
    def __init__(self, image: np.ndarray):
        """
        Initialize the ImageFT instance.
        :param image: 2D numpy array representing grayscale image
        """
        self.spatial = image.astype(np.float32)
        # Compute 2D Fourier Transform
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
