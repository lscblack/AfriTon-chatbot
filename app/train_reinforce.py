import os
import pandas as pd
from sqlalchemy.orm import Session
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, Trainer, TrainingArguments, Seq2SeqTrainingArguments, Seq2SeqTrainer
from datasets import Dataset
from app.database import SessionLocal
from app.models import ChatHistory
from app.config import SEQ2SEQ_MODEL_PATH

"""
This script implements Reinforcement Learning Lite (RLL) fine-tuning.

It periodically fetches the best user interactions (high-reward samples) from your
database and uses them to slightly fine-tune your seq2seq model, reinforcing good
answers and gradually improving your chatbot's quality.
"""

# --------------------------
# Load model and tokenizer
# --------------------------
tokenizer = AutoTokenizer.from_pretrained(SEQ2SEQ_MODEL_PATH)
model = AutoModelForSeq2SeqLM.from_pretrained(SEQ2SEQ_MODEL_PATH)

# --------------------------
# Fetch positive examples
# --------------------------
def collect_positive_samples(db: Session, min_score: float = 0.5, limit: int = 1000):
    """
    Collect chat samples with score > min_score.
    These represent 'rewarded' high-quality responses.
    """
    samples = (
        db.query(ChatHistory)
        .filter(ChatHistory.score != None)
        .filter(ChatHistory.score > min_score)
        .filter(ChatHistory.role == "assistant")
        .limit(limit)
        .all()
    )

    data = []
    for s in samples:
        # Retrieve context (last user message)
        user_msg = (
            db.query(ChatHistory)
            .filter(ChatHistory.session_id == s.session_id)
            .filter(ChatHistory.timestamp < s.timestamp)
            .order_by(ChatHistory.timestamp.desc())
            .first()
        )
        if user_msg:
            data.append({"question": user_msg.message, "answer": s.message})
    return data

# --------------------------
# Main training pipeline
# --------------------------
def run_reinforcement_training(output_dir="../models/finetuned_reinforced"):
    db = SessionLocal()
    samples = collect_positive_samples(db)
    if not samples:
        print("No positive samples found with score > threshold.")
        return

    df = pd.DataFrame(samples)
    print(f"Collected {len(df)} positive samples for fine-tuning.")

    # Tokenize
    inputs = [f"question: {q}" for q in df["question"].tolist()]
    labels = df["answer"].tolist()

    dataset = Dataset.from_dict({"input_text": inputs, "target_text": labels})
    def preprocess(batch):
        model_inputs = tokenizer(batch["input_text"], truncation=True, padding="max_length", max_length=256)
        labels_enc = tokenizer(batch["target_text"], truncation=True, padding="max_length", max_length=256)
        model_inputs["labels"] = labels_enc["input_ids"]
        return model_inputs

    tokenized = dataset.map(preprocess, batched=True)

    # Training args
    args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        num_train_epochs=1,
        per_device_train_batch_size=8,
        learning_rate=1e-5,
        save_strategy="epoch",
        logging_dir="./logs",
        save_total_limit=2,
        predict_with_generate=True,
        eval_strategy="no",
    )

    trainer = Seq2SeqTrainer(
        model=model,
        args=args,
        train_dataset=tokenized,
        tokenizer=tokenizer,
    )

    # Train
    print("Starting reinforcement fine-tuning...")
    trainer.train()

    # Save updated model
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"✅ Reinforced model saved to: {output_dir}")

    db.close()

def start_reinforcement_job():
    """
    Exposed function to be triggered via API.
    Returns summary and model save path.
    """
    try:
        output_dir = "../models/finetuned_reinforced"
        run_reinforcement_training(output_dir=output_dir)
        return {"success": True, "message": "Reinforcement training completed.", "model_path": output_dir}
    except Exception as e:
        return {"success": False, "error": str(e)}

