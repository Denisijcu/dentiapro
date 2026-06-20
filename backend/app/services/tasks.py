"""
DentiaPro — Celery Tasks
Vertex Coders LLC
"""
from app.services.celery_app import celery_app


@celery_app.task(name="send_appointment_reminder")
def send_appointment_reminder(appointment_id: int):
    # TODO Fase 2: integrar con email service
    print(f"[TASK] Reminder for appointment {appointment_id}")
    return {"status": "sent", "appointment_id": appointment_id}


@celery_app.task(name="process_xray_retry")
def process_xray_retry(xray_id: int):
    # TODO Fase 2: retry del análisis IA
    print(f"[TASK] Retry xray analysis {xray_id}")
    return {"status": "queued", "xray_id": xray_id}