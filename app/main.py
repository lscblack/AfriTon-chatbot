# main.py - Fixed endpoints with proper HTTP methods
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from . import database, models, schemas, crud, chatbot
from .chatbot import compute_reward, save_reward_to_db
from app.train_reinforce import start_reinforcement_job
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Health Chatbot API", version="1.0.0")
models.Base.metadata.create_all(bind=database.engine)

# Configure CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Session creation - support both GET and POST for flexibility
@app.post("/api/chat/session", response_model=schemas.SessionResponse)
def create_new_chat_session(request: schemas.ChatSessionCreate, db: Session = Depends(get_db)):
    """Create new session via POST with JSON body"""
    print("Creating session via POST:", request.title, request.user_id)
    return crud.create_session(db, request.user_id, title=request.title)

@app.get("/api/chat/session", response_model=schemas.SessionResponse)
def create_new_chat_session_get(user_id: str, title: str = "New Chat", db: Session = Depends(get_db)):
    """Create new session via GET with query parameters"""
    print("Creating session via GET:", title, user_id)
    return crud.create_session(db, user_id, title=title)

@app.get("/api/chat/sessions", response_model=list[schemas.SessionResponse])
def get_sessions(user_id: str, db: Session = Depends(get_db)):
    """Get all sessions for a user"""
    return crud.get_user_sessions(db, user_id)

@app.get("/api/chat/history", response_model=list[schemas.MessageResponse])
def get_chat_history(session_id: int, db: Session = Depends(get_db)):
    """Get chat history for a session"""
    msgs = crud.get_chat_history(db, session_id)
    return [
        {"id": m.id, "role": m.role, "message": m.message, "score": m.score, "timestamp": m.timestamp}
        for m in msgs
    ]

# UPDATED CHAT ENDPOINT - Handles session creation automatically
@app.post("/api/chat", response_model=schemas.ChatResponse)
def chat(req: schemas.ChatRequest, db: Session = Depends(get_db)):
    """
    Chat with the model. Creates a new session if none exists or provided.
    """
    session_id = req.session_id
    
    # If no session_id provided, check for existing sessions or create new one
    if not session_id:
        user_sessions = crud.get_user_sessions(db, req.user_id)
        if user_sessions:
            # Use the most recent session
            session_id = user_sessions[0].id
        else:
            # Create a new session
            new_session = crud.create_session(db, req.user_id)
            session_id = new_session.id
    
    # Verify session exists and belongs to user
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id,
        models.ChatSession.user_id == req.user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Generate answer with session memory
    res = chatbot.answer_with_memory(session_id, req.message, db)

    # Save user message
    user_msg = crud.create_message(db, session_id, req.user_id, "user", req.message)

    # Save assistant message
    assistant_msg = crud.create_message(
        db,
        session_id,
        req.user_id,
        "assistant",
        res["answer"],
        res.get("score")
    )

    # Include session_id in response for frontend
    res["session_id"] = session_id
    return res

@app.put("/api/chat/edit/{msg_id}", response_model=schemas.ChatResponse)
def edit_and_resend(msg_id: int, request: dict, db: Session = Depends(get_db)):
    """Edit a message and regenerate response"""
    new_message = request.get("new_message")
    if not new_message:
        raise HTTPException(status_code=422, detail="new_message field is required")
    
    msg = crud.edit_message(db, msg_id, new_message)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Regenerate using session memory
    res = chatbot.answer_with_memory(msg.session_id, new_message, db)

    # Save assistant response
    crud.create_message(
        db,
        msg.session_id,
        msg.user_id,
        "assistant",
        res["answer"],
        res.get("score")
    )
    
    res["session_id"] = msg.session_id
    return res

@app.get("/api/metrics", response_model=schemas.MetricResponse)
def metrics(db: Session = Depends(get_db)):
    """Get system metrics"""
    return crud.get_metrics(db)

@app.post("/api/feedback")
def give_feedback(request: schemas.FeedbackRequest, db: Session = Depends(get_db)):
    """Submit feedback for a message"""
    msg = db.query(models.ChatHistory).filter(models.ChatHistory.id == request.message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Use `msg.role` instead of `msg.source`
    new_reward = compute_reward(msg.message, msg.role, feedback=request.rating)
    save_reward_to_db(db, request.message_id, new_reward)

    # Save feedback record
    crud.save_feedback(db, request.user_id, request.message_id, request.rating, request.comment)

    return {"success": True, "new_reward": new_reward}

@app.post("/api/train/reinforce")
async def trigger_reinforcement(background_tasks: BackgroundTasks):
    """Trigger reinforcement learning training"""
    background_tasks.add_task(lambda: print("RL training result:", start_reinforcement_job()))
    return {"message": "Reinforcement training started in background."}