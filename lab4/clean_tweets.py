import pandas as pd
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_FILE = PROJECT_ROOT / "data" / "lab4_raw_tweets.csv"
CLEAN_FILE = PROJECT_ROOT / "data" / "lab4_clean_tweets.csv"

RANDOM_SEED = 401
TOP_N_COMPANIES = 10
TWEETS_PER_COMPANY = 500


print("Loading raw dataset...")

df = pd.read_csv(RAW_FILE)

print(f"Raw dataset shape: {df.shape}")


# Check required columns

required_columns = [
    "tweet_id",
    "author_id",
    "inbound",
    "created_at",
    "text",
    "response_tweet_id",
    "in_response_to_tweet_id"
]

missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )


# Inspect data quality

print("\nDATA QUALITY CHECKS")

print("\nMissing values:")
print(
    df.isna()
    .sum()
    .to_string()
)

print(
    f"\nDuplicate rows: "
    f"{df.duplicated().sum()}"
)

print(
    f"Duplicate tweet IDs: "
    f"{df['tweet_id'].duplicated().sum()}"
)

print(
    f"Missing tweet text: "
    f"{df['text'].isna().sum()}"
)

empty_text = (
    df["text"]
    .astype("string")
    .str.strip()
    .eq("")
    .sum()
)

print(
    f"Empty tweet text: "
    f"{empty_text}"
)


# Remove duplicate tweet IDs

df = df.drop_duplicates(
    subset=["tweet_id"],
    keep="first"
).copy()


# Clean tweet text

df["text"] = (
    df["text"]
    .astype("string")
    .str.replace(
        r"\s+",
        " ",
        regex=True
    )
    .str.strip()
)

df = df[
    df["text"].notna()
    & df["text"].ne("")
].copy()


# Parse dates

df["created_at"] = pd.to_datetime(
    df["created_at"],
    format="%a %b %d %H:%M:%S %z %Y",
    errors="coerce"
)

invalid_dates = df["created_at"].isna().sum()

print(
    f"\nInvalid dates after parsing: "
    f"{invalid_dates}"
)

df = df[
    df["created_at"].notna()
].copy()


# Clean tweet ID

df["tweet_id"] = pd.to_numeric(
    df["tweet_id"],
    errors="coerce"
).astype("Int64")


# Clean parent tweet ID

df["in_response_to_tweet_id"] = pd.to_numeric(
    df["in_response_to_tweet_id"],
    errors="coerce"
).astype("Int64")


# Clean response tweet ID

df["response_id"] = pd.to_numeric(
    df["response_tweet_id"],
    errors="coerce"
).astype("Int64")


# Clean author IDs

df["author_id"] = (
    df["author_id"]
    .astype("string")
    .str.strip()
)


# Ensure inbound is Boolean

df["inbound"] = df["inbound"].astype(bool)


print("\nCLEANED DATA TYPES")
print(
    df.dtypes
    .to_string()
)


# Separate customer and company tweets

customer_tweets = df[
    df["inbound"] == True
].copy()

company_tweets = df[
    df["inbound"] == False
].copy()


print("\nTWEET TYPES")

print(
    f"Customer tweets: "
    f"{len(customer_tweets):,}"
)

print(
    f"Company tweets: "
    f"{len(company_tweets):,}"
)

print(
    f"Company accounts: "
    f"{company_tweets['author_id'].nunique():,}"
)


# Create company response lookup

company_lookup = (
    company_tweets[
        [
            "tweet_id",
            "author_id"
        ]
    ]
    .drop_duplicates(
        subset=["tweet_id"]
    )
    .rename(
        columns={
            "author_id": "company"
        }
    )
)


# Link customer tweets to company responses

linked = customer_tweets.merge(
    company_lookup,
    left_on="response_id",
    right_on="tweet_id",
    how="left",
    suffixes=("", "_response")
)


# Keep customer tweets with identifiable companies

linked_customer_tweets = linked[
    linked["company"].notna()
].copy()


print("\nCOMPANY LINKING")

print(
    f"Customer tweets: "
    f"{len(customer_tweets):,}"
)

print(
    f"Linked to company: "
    f"{len(linked_customer_tweets):,}"
)

print(
    f"Not linked to company: "
    f"{len(customer_tweets) - len(linked_customer_tweets):,}"
)


# Count linked customer tweets by company

company_counts = (
    linked_customer_tweets[
        "company"
    ]
    .value_counts()
)


print(
    "\nTOP COMPANIES BY "
    "LINKED CUSTOMER TWEETS"
)

print(
    company_counts
    .head(30)
    .to_string()
)


# Select top companies

selected_companies = (
    company_counts
    .head(TOP_N_COMPANIES)
    .index
    .tolist()
)


print(
    f"\nSELECTED TOP "
    f"{TOP_N_COMPANIES} COMPANIES"
)

for rank, company in enumerate(
    selected_companies,
    start=1
):
    print(
        f"{rank:2}. "
        f"{company:<25} "
        f"{company_counts[company]:,}"
    )


# Keep only selected companies

analysis_pool = linked_customer_tweets[
    linked_customer_tweets["company"].isin(
        selected_companies
    )
].copy()


# Sample equal number of tweets per company

available_per_company = (
    analysis_pool
    .groupby("company")
    .size()
)

tweets_per_company = min(
    TWEETS_PER_COMPANY,
    available_per_company.min()
)


print(
    f"\nSampling "
    f"{tweets_per_company} tweets "
    f"per company"
)


analysis_df = (
    analysis_pool
    .groupby(
        "company",
        group_keys=False
    )
    .sample(
        n=tweets_per_company,
        random_state=RANDOM_SEED
    )
    .copy()
)


# Shuffle final dataset

analysis_df = (
    analysis_df
    .sample(
        frac=1,
        random_state=RANDOM_SEED
    )
    .reset_index(drop=True)
)


# Keep visualization-ready fields

analysis_df = analysis_df[
    [
        "tweet_id",
        "author_id",
        "company",
        "inbound",
        "created_at",
        "text"
    ]
].copy()


# Preserve tweet text for RoBERTa

analysis_df = analysis_df.rename(
    columns={
        "text": "tweet_text_raw"
    }
)


# Convert datetime to a consistent CSV format

analysis_df["created_at"] = (
    analysis_df["created_at"]
    .dt.strftime(
        "%Y-%m-%d %H:%M:%S%z"
    )
)


# Final quality checks

print("\nFINAL DATASET")

print(
    f"Rows: "
    f"{len(analysis_df):,}"
)

print(
    f"Columns: "
    f"{analysis_df.columns.tolist()}"
)

print(
    f"\nDuplicate rows: "
    f"{analysis_df.duplicated().sum()}"
)

print(
    f"Duplicate tweet IDs: "
    f"{analysis_df['tweet_id'].duplicated().sum()}"
)

print("\nMissing values:")

print(
    analysis_df.isna()
    .sum()
    .to_string()
)


print("\nTWEETS PER COMPANY")

print(
    analysis_df["company"]
    .value_counts()
    .sort_index()
    .to_string()
)


# Save cleaned dataset

analysis_df.to_csv(
    CLEAN_FILE,
    index=False
)


print(
    "\nSaved cleaned dataset to:"
)

print(CLEAN_FILE)