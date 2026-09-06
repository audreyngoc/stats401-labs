import pandas as pd
import re
from pathlib import Path
from transformers import pipeline


PROJECT_ROOT = Path(__file__).resolve().parents[1]

CLEAN_FILE = PROJECT_ROOT / "data" / "lab4_clean_tweets.csv"


print("Loading cleaned dataset...")

df = pd.read_csv(CLEAN_FILE)

print(f"Dataset shape: {df.shape}")


# Check required column

if "tweet_text_raw" not in df.columns:
    raise ValueError(
        "Column 'tweet_text_raw' was not found."
    )


# Prepare tweet text for RoBERTa

def prepare_for_roberta(text):
    text = str(text)

    text = re.sub(
        r"@\w+",
        "@user",
        text
    )

    text = re.sub(
        r"https?://\S+|www\.\S+",
        "http",
        text
    )

    return text.strip()


df["sentiment_text"] = (
    df["tweet_text_raw"]
    .fillna("")
    .apply(prepare_for_roberta)
)


print("\nExample text preparation")

print(
    df[
        [
            "tweet_text_raw",
            "sentiment_text"
        ]
    ].head(5).to_string()
)


# Load RoBERTa sentiment model

print("\nLoading RoBERTa sentiment model...")

sentiment_model = pipeline(
    "sentiment-analysis",
    model=(
        "cardiffnlp/"
        "twitter-roberta-base-sentiment-latest"
    ),
    top_k=None
)

print("RoBERTa model loaded.")


# Run sentiment analysis

print(
    f"\nRunning sentiment analysis "
    f"on {len(df):,} tweets..."
)

results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)

print("Sentiment analysis complete.")


# Convert model output to dictionaries

def scores_to_dict(scores):
    return {
        item["label"].lower(): item["score"]
        for item in scores
    }


score_dicts = [
    scores_to_dict(scores)
    for scores in results
]


# Extract sentiment probabilities

df["sentiment_negative"] = [
    scores.get("negative", 0)
    for scores in score_dicts
]

df["sentiment_neutral"] = [
    scores.get("neutral", 0)
    for scores in score_dicts
]

df["sentiment_positive"] = [
    scores.get("positive", 0)
    for scores in score_dicts
]


# Determine predicted sentiment

def predicted_label(scores):
    return max(
        scores,
        key=scores.get
    ).capitalize()


df["sentiment"] = [
    predicted_label(scores)
    for scores in score_dicts
]


# Calculate continuous sentiment score

df["sentiment_score"] = (
    df["sentiment_positive"]
    - df["sentiment_negative"]
)


# Check sentiment results

print("\nSENTIMENT DISTRIBUTION")

print(
    df["sentiment"]
    .value_counts()
    .to_string()
)


print("\nSENTIMENT PROBABILITY SUMMARY")

print(
    df[
        [
            "sentiment_negative",
            "sentiment_neutral",
            "sentiment_positive",
            "sentiment_score"
        ]
    ].describe()
)


print("\nSAMPLE SENTIMENT RESULTS")

print(
    df[
        [
            "company",
            "tweet_text_raw",
            "sentiment_negative",
            "sentiment_neutral",
            "sentiment_positive",
            "sentiment",
            "sentiment_score"
        ]
    ].head(10).to_string()
)


# Check for missing sentiment results

sentiment_columns = [
    "sentiment_negative",
    "sentiment_neutral",
    "sentiment_positive",
    "sentiment",
    "sentiment_score"
]

print("\nMISSING SENTIMENT VALUES")

print(
    df[sentiment_columns]
    .isna()
    .sum()
    .to_string()
)


# Save final visualization-ready dataset

df.to_csv(
    CLEAN_FILE,
    index=False
)


print("\nFinal dataset shape:")
print(df.shape)

print("\nSaved final dataset to:")
print(CLEAN_FILE)