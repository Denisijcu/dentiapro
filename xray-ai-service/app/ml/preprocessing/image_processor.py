
"""
DentiaPro — X-Ray Image Preprocessor
Pipeline de preprocesamiento para radiografías dentales.
Soporta JPEG, PNG, WebP y DICOM.
Vertex Coders LLC
"""
import io
import logging
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageEnhance

logger = logging.getLogger(__name__)

# Tamaño estándar para el modelo
TARGET_SIZE = (512, 512)


def load_image_from_bytes(data: bytes, filename: str = "") -> np.ndarray:
    """
    Carga una imagen desde bytes.
    Soporta JPEG, PNG, WebP y DICOM (.dcm).
    """
    ext = Path(filename).suffix.lower() if filename else ""

    if ext == ".dcm" or _is_dicom(data):
        return _load_dicom(data)

    # Standard image formats
    pil_img = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(pil_img)


def load_image_from_url_bytes(data: bytes) -> np.ndarray:
    """Carga imagen desde bytes descargados de URL."""
    try:
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        return np.array(pil_img)
    except Exception:
        return _load_dicom(data)


def _is_dicom(data: bytes) -> bool:
    """Detecta si los bytes corresponden a un archivo DICOM."""
    return len(data) > 132 and data[128:132] == b"DICM"


def _load_dicom(data: bytes) -> np.ndarray:
    """Lee un archivo DICOM y extrae el array de píxeles."""
    import pydicom
    from pydicom.filebase import DicomBytesIO

    ds = pydicom.dcmread(DicomBytesIO(data))
    pixel_array = ds.pixel_array.astype(np.float32)

    # Normalizar a 0-255
    pixel_min = pixel_array.min()
    pixel_max = pixel_array.max()
    if pixel_max > pixel_min:
        pixel_array = (pixel_array - pixel_min) / (pixel_max - pixel_min) * 255.0

    img_uint8 = pixel_array.astype(np.uint8)

    # Convertir a RGB si es escala de grises
    if img_uint8.ndim == 2:
        img_uint8 = cv2.cvtColor(img_uint8, cv2.COLOR_GRAY2RGB)
    elif img_uint8.ndim == 3 and img_uint8.shape[2] == 1:
        img_uint8 = cv2.cvtColor(img_uint8.squeeze(), cv2.COLOR_GRAY2RGB)

    return img_uint8


def enhance_dental_xray(img: np.ndarray) -> np.ndarray:
    """
    Mejora el contraste de la radiografía dental para
    facilitar la detección de caries y pérdida ósea.
    """
    # Convertir a LAB para mejorar luminosidad independientemente del color
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l_channel, a, b = cv2.split(lab)

    # CLAHE — mejora el contraste local
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)

    # Reconstruir imagen
    enhanced_lab = cv2.merge([l_enhanced, a, b])
    enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)

    return enhanced


def normalize_for_model(img: np.ndarray) -> np.ndarray:
    """
    Normaliza la imagen para inferencia con PyTorch.
    Retorna array float32 en rango [0, 1] con forma (3, H, W).
    Usa ImageNet mean/std para modelos pre-entrenados.
    """
    # Resize al tamaño del modelo
    resized = cv2.resize(img, TARGET_SIZE, interpolation=cv2.INTER_LANCZOS4)

    # Normalizar a [0, 1]
    img_float = resized.astype(np.float32) / 255.0

    # ImageNet normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    normalized = (img_float - mean) / std

    # HWC → CHW (PyTorch format)
    chw = normalized.transpose(2, 0, 1)
    return chw


def full_pipeline(raw_bytes: bytes, filename: str = "") -> Tuple[np.ndarray, np.ndarray]:
    """
    Pipeline completo: bytes → (imagen_enhanced, tensor_normalizado)
    Retorna:
        - enhanced: np.ndarray RGB uint8 para visualización / heatmap
        - tensor_input: np.ndarray float32 CHW para el modelo
    """
    raw_img = load_image_from_bytes(raw_bytes, filename)
    enhanced = enhance_dental_xray(raw_img)
    tensor_input = normalize_for_model(enhanced)
    return enhanced, tensor_input


def generate_gradcam_heatmap(
    img_enhanced: np.ndarray,
    attention_map: np.ndarray,
    alpha: float = 0.5,
) -> np.ndarray:
    """
    Superpone el mapa de atención del modelo sobre la imagen.
    Genera el heatmap de diagnóstico que ve el doctor.

    Args:
        img_enhanced: imagen RGB uint8 (H, W, 3)
        attention_map: mapa de atención float32 (H, W) en [0, 1]
        alpha: transparencia del heatmap

    Returns:
        Imagen RGB uint8 con heatmap superpuesto
    """
    h, w = img_enhanced.shape[:2]

    # Resize attention map al tamaño de la imagen
    heatmap_resized = cv2.resize(attention_map, (w, h))

    # Normalizar
    heatmap_norm = (heatmap_resized - heatmap_resized.min())
    if heatmap_norm.max() > 0:
        heatmap_norm = heatmap_norm / heatmap_norm.max()

    # Colormap JET (azul→verde→rojo)
    heatmap_color = cv2.applyColorMap(
        (heatmap_norm * 255).astype(np.uint8),
        cv2.COLORMAP_JET,
    )
    heatmap_rgb = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)

    # Blend
    overlay = cv2.addWeighted(img_enhanced, 1 - alpha, heatmap_rgb, alpha, 0)
    return overlay


def ndarray_to_bytes(img: np.ndarray, format: str = "PNG") -> bytes:
    """Convierte np.ndarray RGB a bytes PNG/JPEG."""
    pil_img = Image.fromarray(img.astype(np.uint8))
    buf = io.BytesIO()
    pil_img.save(buf, format=format)
    return buf.getvalue()