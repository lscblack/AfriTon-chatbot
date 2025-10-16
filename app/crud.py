from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from . import models

def create_session(db: Session, user_id: str, title: str ):
    new_session = models.ChatSession(user_id=user_id, title=title)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

def get_user_sessions(db: Session, user_id: str):
    return db.query(models.ChatSession).filter(models.ChatSession.user_id == user_id).order_by(models.ChatSession.created_at.desc()).all()

def create_message(db: Session, session_id: int, user_id: str, role: str, message: str, score: float = None):
    new_msg = models.ChatHistory(session_id=session_id, user_id=user_id, role=role, message=message, score=score)
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg

def get_chat_history(db: Session, session_id: int):
    return db.query(models.ChatHistory).filter(models.ChatHistory.session_id == session_id).order_by(models.ChatHistory.timestamp.asc()).all()

def edit_message(db: Session, msg_id: int, new_message: str):
    msg = db.query(models.ChatHistory).filter(models.ChatHistory.id == msg_id).first()
    if msg:
        msg.message = new_message
        db.commit()
        db.refresh(msg)
    return msg

def get_metrics(db: Session):
    total_sessions = db.query(models.ChatSession).count()
    total_messages = db.query(models.ChatHistory).count()
    avg_score = db.query(func.avg(models.ChatHistory.score)).scalar()
    return {"total_sessions": total_sessions, "total_messages": total_messages, "avg_score": avg_score}

def save_feedback(db: Session, user_id: str, message_id: int, rating: int, comment: str = None):
    from .models import Feedback
    fb = Feedback(user_id=user_id, message_id=message_id, rating=rating, comment=comment)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb
