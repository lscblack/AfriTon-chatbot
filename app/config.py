import os


DATABASE_URL = os.getenv("DATABASE_URL")

# Model paths
EMBEDDER_PATH = "./processed-v6/embedder_allMiniLM"
FAISS_INDEX_PATH = "./processed-v6/faiss.index"
CORPUS_PATH = "./processed-v6/corpus_texts.npy"
SEQ2SEQ_MODEL_PATH = "./processed-v6/t5_health_final"
