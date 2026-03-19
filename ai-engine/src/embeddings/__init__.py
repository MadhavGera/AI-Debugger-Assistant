import time

for i in range(5):
    try:
        self.chroma_client = chromadb.HttpClient(
            host=CHROMA_HOST,
            port=CHROMA_PORT,
        )
        break
    except Exception as e:
        print("Retrying Chroma connection...", e)
        time.sleep(2)