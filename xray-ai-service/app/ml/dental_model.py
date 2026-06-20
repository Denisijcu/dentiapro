
"""
DentiaPro — Dental AI Model
EfficientNet-B4 fine-tuned para detección de patologías dentales.
Detecta: caries, pérdida ósea, abscesos, fracturas, impactaciones.

Vertex Coders LLC
"""
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Clases de patologías dentales
# ---------------------------------------------------------------------------
DENTAL_CONDITIONS = [
    "caries",              # 0 — Caries dental
    "bone_loss",           # 1 — Pérdida ósea periodontal
    "periapical_lesion",   # 2 — Lesión periapical / absceso
    "crown_fracture",      # 3 — Fractura de corona
    "root_fracture",       # 4 — Fractura de raíz
    "impaction",           # 5 — Diente impactado
    "calculus",            # 6 — Cálculo / sarro
    "missing_tooth",       # 7 — Diente ausente
    "overhang",            # 8 — Desbordamiento de restauración
    "healthy",             # 9 — Estructura sana
]

CONDITION_SEVERITY = {
    "caries": {"mild": 0.3, "moderate": 0.6, "severe": 0.8},
    "bone_loss": {"mild": 0.25, "moderate": 0.5, "severe": 0.75},
    "periapical_lesion": {"mild": 0.3, "moderate": 0.6, "severe": 0.85},
    "crown_fracture": {"mild": 0.3, "moderate": 0.6, "severe": 0.8},
    "root_fracture": {"moderate": 0.5, "severe": 0.75},
    "impaction": {"moderate": 0.4, "severe": 0.7},
    "calculus": {"mild": 0.2, "moderate": 0.5, "severe": 0.75},
    "missing_tooth": {"severe": 0.9},
    "overhang": {"mild": 0.3, "moderate": 0.6},
    "healthy": {"none": 0.0},
}

CONDITION_RECOMMENDATIONS = {
    "caries": "Restauración dental recomendada. Evaluar profundidad mediante sondaje. Considerar protección pulpar si la caries es profunda.",
    "bone_loss": "Evaluación periodontal completa recomendada. Considerar raspaje y alisado radicular. Derivar a periodoncista si la pérdida supera el 30%.",
    "periapical_lesion": "Tratamiento endodóntico (canal) indicado. Descartar absceso activo con evaluación clínica. Posible extracción si el pronóstico es desfavorable.",
    "crown_fracture": "Restauración con resina o corona según extensión. Evaluar vitalidad pulpar. Considerar corona completa si la fractura compromete más del 50% de la corona.",
    "root_fracture": "Extracción probable. Evaluar nivel de fractura con CBCT. Considerar implante posterior.",
    "impaction": "Evaluación ortopantomográfica completa. Consulta con cirujano oral. Exodoncia preventiva si hay riesgo de complicaciones.",
    "calculus": "Profilaxis dental y detartraje profesional recomendados. Reforzar instrucciones de higiene oral. Control cada 6 meses.",
    "missing_tooth": "Evaluar opciones de rehabilitación: implante, puente fijo o prótesis removible. Considerar derivación a especialista en prótesis.",
    "overhang": "Ajuste o reemplazo de restauración existente. Evaluar estado periodontal del área afectada.",
    "healthy": "No se detectan patologías significativas. Continuar con controles preventivos regulares.",
}


# ---------------------------------------------------------------------------
# Arquitectura del modelo
# ---------------------------------------------------------------------------
class DentalEfficientNet(nn.Module):
    """
    EfficientNet-B4 adaptado para clasificación multi-label de patologías dentales.
    Multi-label porque una misma RX puede mostrar múltiples condiciones.
    """

    def __init__(self, num_classes: int = len(DENTAL_CONDITIONS), pretrained: bool = True):
        super().__init__()

        # Backbone: EfficientNet-B4
        weights = models.EfficientNet_B4_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = models.efficientnet_b4(weights=weights)

        # Feature extractor (todo menos el clasificador final)
        self.features = backbone.features
        self.avgpool = backbone.avgpool

        # Clasificador personalizado para radiografías dentales
        in_features = backbone.classifier[1].in_features
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(512, num_classes),
        )

        # Hook para Grad-CAM
        self._gradients: Optional[torch.Tensor] = None
        self._activations: Optional[torch.Tensor] = None
        self._register_hooks()

    def _register_hooks(self):
        """Registra hooks para extraer gradientes y activaciones (Grad-CAM)."""
        def forward_hook(module, input, output):
            self._activations = output.detach()

        def backward_hook(module, grad_in, grad_out):
            self._gradients = grad_out[0].detach()

        # Hook en la última capa convolucional
        last_conv = self.features[-1]
        last_conv.register_forward_hook(forward_hook)
        last_conv.register_full_backward_hook(backward_hook)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.classifier(x)
        return x

    def get_gradcam(
        self,
        x: torch.Tensor,
        target_class: int,
    ) -> np.ndarray:
        """
        Genera el mapa de activación Grad-CAM para la clase indicada.
        Visualiza QUÉ parte de la RX activó el diagnóstico.
        """
        self.eval()
        x.requires_grad_(True)

        output = self.forward(x)
        self.zero_grad()
        output[0, target_class].backward()

        if self._gradients is None or self._activations is None:
            return np.zeros((14, 14), dtype=np.float32)

        # Grad-CAM: promedio de gradientes × activaciones
        weights = self._gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self._activations).sum(dim=1).squeeze()
        cam = F.relu(cam).cpu().numpy()

        # Normalizar
        if cam.max() > 0:
            cam = cam / cam.max()

        return cam.astype(np.float32)


# ---------------------------------------------------------------------------
# Model Manager — Singleton
# ---------------------------------------------------------------------------
class DentalModelManager:
    """
    Gestiona la carga y ciclo de vida del modelo.
    Singleton pattern — se carga una sola vez al startup.
    """
    _instance: Optional["DentalModelManager"] = None
    _model: Optional[DentalEfficientNet] = None
    _loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self, weights_path: str, device: str = "cpu") -> bool:
        """
        Carga el modelo desde los pesos guardados.
        Si no hay pesos (primera vez), inicializa con pesos ImageNet pre-entrenados.
        """
        self._device = device
        self._model = DentalEfficientNet(pretrained=not Path(weights_path).exists())
        self._model.to(device)

        if Path(weights_path).exists():
            try:
                state_dict = torch.load(weights_path, map_location=device)
                self._model.load_state_dict(state_dict)
                logger.info(f"✅ Dental model loaded from {weights_path}")
            except Exception as e:
                logger.warning(f"⚠️ Could not load weights: {e}. Using pretrained ImageNet weights.")
        else:
            logger.warning(
                "⚠️ No fine-tuned weights found. Using ImageNet pretrained backbone. "
                "Predictions will be suboptimal until fine-tuning with dental dataset."
            )

        self._model.eval()
        self._loaded = True
        return True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def device(self) -> str:
        return getattr(self, "_device", "cpu")

    def predict(
        self,
        tensor_input: np.ndarray,
        threshold: float = 0.5,
    ) -> Tuple[Dict[str, float], float]:
        """
        Ejecuta inferencia sobre el tensor preprocesado.

        Args:
            tensor_input: array float32 (3, 512, 512) — salida de full_pipeline()
            threshold: umbral de confianza para reportar una condición

        Returns:
            findings: dict {condition: confidence}
            global_confidence: confianza global del análisis
        """
        if not self._loaded or self._model is None:
            raise RuntimeError("Model not loaded. Call load() first.")

        # Agregar batch dimension: (3, 512, 512) → (1, 3, 512, 512)
        tensor = torch.from_numpy(tensor_input).unsqueeze(0).to(self._device)

        with torch.no_grad():
            logits = self._model(tensor)
            probs = torch.sigmoid(logits).squeeze().cpu().numpy()

        findings = {}
        for i, condition in enumerate(DENTAL_CONDITIONS):
            confidence = float(probs[i])
            if condition != "healthy" and confidence >= threshold:
                findings[condition] = round(confidence, 4)

        # Si no hay hallazgos, reportar como healthy
        if not findings:
            findings["healthy"] = round(float(probs[DENTAL_CONDITIONS.index("healthy")]), 4)

        global_confidence = float(np.mean(list(findings.values())))
        return findings, global_confidence

    def get_gradcam_for_finding(
        self,
        tensor_input: np.ndarray,
        condition: str,
    ) -> np.ndarray:
        """Genera Grad-CAM para una condición específica."""
        if condition not in DENTAL_CONDITIONS:
            return np.zeros((14, 14), dtype=np.float32)

        target_class = DENTAL_CONDITIONS.index(condition)
        tensor = torch.from_numpy(tensor_input).unsqueeze(0).to(self._device)
        return self._model.get_gradcam(tensor, target_class)


# Global instance
model_manager = DentalModelManager()