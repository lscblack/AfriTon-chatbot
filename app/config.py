import os
from dotenv import load_dotenv
from huggingface_hub import snapshot_download
from sentence_transformers import SentenceTransformer

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

HF_REPO = "lscblack/healthbot"
base_dir = snapshot_download(repo_id=HF_REPO)

EMBEDDER_PATH = os.path.join(base_dir, "embedder_allMiniLM")
SEQ2SEQ_MODEL_PATH = os.path.join(base_dir, "t5_health_final")
FAISS_INDEX_PATH = os.path.join(base_dir, "faiss.index")
CORPUS_PATH = os.path.join(base_dir, "corpus_texts.npy")

embedder = SentenceTransformer(EMBEDDER_PATH)
