# schemas.py - Add missing request models
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ChatSessionCreate(BaseModel):
    user_id: str
    title: str = "New Chat"

class MessageBase(BaseModel):
    user_id: str
    session_id: int
    message: str

class ChatRequest(BaseModel):
    user_id: str
    message: str
    session_id: Optional[int] = None  # Make session_id optional

class MessageResponse(BaseModel):
    id: int
    role: str
    message: str
    score: Optional[float]
    timestamp: datetime

class ChatResponse(BaseModel):
    answer: str
    score: Optional[float] = None
    source: Optional[str] = None
    flagged: Optional[bool] = False
    session_id: Optional[int] = None  # Include session_id in response

class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime

class MetricResponse(BaseModel):
    total_sessions: int
    total_messages: int
    avg_score: Optional[float]

class FeedbackRequest(BaseModel):
    user_id: str
    message_id: int
    rating: int
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    success: bool
    message: str