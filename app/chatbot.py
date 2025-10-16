import os
import math
import numpy as np
from typing import List, Dict, Tuple, Optional
from datetime import datetime

import faiss
from sentence_transformers import SentenceTransformer, CrossEncoder, util
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from sqlalchemy.orm import Session

from .config import EMBEDDER_PATH, FAISS_INDEX_PATH, CORPUS_PATH, SEQ2SEQ_MODEL_PATH
from .models import ChatHistory

# ================================================================
# LOAD MODELS
# ================================================================
embedder = SentenceTransformer(EMBEDDER_PATH)
index = faiss.read_index(FAISS_INDEX_PATH)
corpus_texts = np.load(CORPUS_PATH, allow_pickle=True)
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

tokenizer = AutoTokenizer.from_pretrained(SEQ2SEQ_MODEL_PATH)
seq2seq_model = AutoModelForSeq2SeqLM.from_pretrained(SEQ2SEQ_MODEL_PATH)

# ================================================================
# CONFIGURATION
# ================================================================
DEFAULT_TOP_K = 50
RERANK_THRESHOLD = 0.85
MIN_COS_SIM = 0.2
MAX_PROMPT_TOKENS = 10240
RECENT_MESSAGES_LIMIT = 500

CRISIS_KEYWORDS = {
    "suicid", "kill myself", "harm myself", "self-harm", "overdose", "hurt myself","pregancy"
}

SYSTEM_PROMPT = (
    "You are a concise, factual, and empathetic health assistant. "
    "You must answer only using verified medical facts whenever possible. "
    "If uncertain, state that you don’t know and recommend consulting a professional. "
    "Keep answers short, accurate, and compassionate."
)

# ================================================================
# HELPERS
# ================================================================
def num_tokens(text: str) -> int:
    return len(tokenizer.encode(text, add_special_tokens=False))

def contains_crisis(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in CRISIS_KEYWORDS)

# ================================================================
# DATABASE HELPERS
# ================================================================
def get_session_history(session_id: int, db: Session, limit: int = 1000) -> List[Dict]:
    rows = (
        db.query(ChatHistory)
        .filter(ChatHistory.session_id == session_id)
        .order_by(ChatHistory.timestamp.asc())
        .limit(limit)
        .all()
    )
    return [{"id": r.id, "role": r.role, "message": r.message, "score": r.score} for r in rows]

def save_reward_to_db(db: Session, message_id: int, reward: float):
    msg = db.query(ChatHistory).filter(ChatHistory.id == message_id).first()
    if msg:
        msg.score = reward
        db.commit()

# ================================================================
# REWARD COMPUTATION
# ================================================================
def compute_reward(answer: str, retrieved: Optional[str], feedback: Optional[int] = None) -> float:
    sim = util.cos_sim(embedder.encode(answer), embedder.encode(retrieved)).item() if retrieved else 0.0
    auto_reward = 2 * sim - 1  # map 0–1 → -1–1
    if feedback is not None:
        reward = 0.7 * feedback + 0.3 * auto_reward
    else:
        reward = auto_reward
    return float(round(reward, 3))

# ================================================================
# RETRIEVAL & RERANKING
# ================================================================
def retrieve_top_k(query: str, k: int = DEFAULT_TOP_K) -> Tuple[List[str], np.ndarray]:
    q_emb = embedder.encode([query], convert_to_numpy=True)
    faiss.normalize_L2(q_emb)
    D, I = index.search(q_emb, k)
    return [corpus_texts[idx] for idx in I[0]], D[0]

def rerank_and_select(question: str, candidates: List[str]) -> Tuple[Optional[str], float, List[float]]:
    if not candidates:
        return None, 0.0, []
    pairs = [[question, c] for c in candidates]
    scores = reranker.predict(pairs)
    best_idx = int(np.argmax(scores))
    best_score = float(scores[best_idx])
    if best_score < RERANK_THRESHOLD:
        return None, best_score, list(scores)
    return candidates[best_idx], best_score, list(scores)

# ================================================================
# GENERATION FUNCTION (UPDATED)
# ================================================================
def generate_answer(question: str, context: str) -> str:
    """Generate high-quality, controlled answers."""
    prompt = f"Answer this health question: {question} [CONTEXT: {context}]"
    inputs = tokenizer(prompt, return_tensors='pt', truncation=True, max_length=512).to(seq2seq_model.device)

    out = seq2seq_model.generate(
        **inputs,
        max_length=500,
        num_beams=16,
        early_stopping=True,
        no_repeat_ngram_size=14,
        length_penalty=0.2,
        temperature=0.2,
        do_sample=False,
    )
    gen_ans = tokenizer.decode(out[0], skip_special_tokens=True)
    return gen_ans.strip()

# ================================================================
# MAIN CHAT LOGIC (WITH MEMORY)
# ================================================================
def answer_with_memory(session_id: int, question: str, db: Session, top_k: int = DEFAULT_TOP_K) -> Dict:
    history = get_session_history(session_id, db)
    context_messages = [{"role": m["role"], "message": m["message"]} for m in history]

    # Crisis detection
    if contains_crisis(question) or any(contains_crisis(m["message"]) for m in context_messages[-3:]):
        return {
            "answer": (
                "If you are thinking about harming yourself or others, please seek immediate help. "
                "Contact local emergency services or a mental health professional. "
                "If you are in Rwanda, call your local hotline for urgent support. "
                "I cannot provide emergency intervention."
            ),
            "flagged": True,
            "score": None,
            "source": None,
        }

    # Retrieve and rerank
    candidates, _ = retrieve_top_k(question, k=top_k)
    best_passage, best_score, _ = rerank_and_select(question, candidates)

    # Fallback on low confidence
    if best_passage is None or best_score < RERANK_THRESHOLD:
        return {
            "answer": "I'm not sure about that. Please consult a qualified health professional or provide more details.",
            "score": best_score,
            "source": None,
            "flagged": False,
        }

    # Generate controlled answer
    gen_answer = generate_answer(question, best_passage)
    reward_value = compute_reward(gen_answer, best_passage)

    # Save reward
    last_message = (
        db.query(ChatHistory)
        .filter(ChatHistory.session_id == session_id)
        .order_by(ChatHistory.timestamp.desc())
        .first()
    )
    if last_message:
        save_reward_to_db(db, last_message.id, reward_value)

    return {
        "answer": gen_answer,
        "score": best_score,
        "source": best_passage,
        "reward": reward_value,
        "flagged": False,
    }

# ================================================================
# STATELESS MODE
# ================================================================
def answer_stateless(question: str, top_k: int = DEFAULT_TOP_K) -> Dict:
    candidates, _ = retrieve_top_k(question, k=top_k)
    best_passage, best_score, _ = rerank_and_select(question, candidates)

    if best_passage is None or best_score < RERANK_THRESHOLD:
        return {"answer": "I’m not confident enough to answer that. Please consult a healthcare provider.", "score": best_score, "source": None}

    gen_answer = generate_answer(question, best_passage)
    return {"answer": gen_answer, "score": best_score, "source": best_passage}

print("✅ Chatbot updated with enhanced cross-encoder reranking and controlled generation.")
