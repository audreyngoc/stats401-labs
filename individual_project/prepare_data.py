import pandas as pd

INPUT = "data/covid_cases_deaths_raw.csv"
OUTPUT = "data/covid_mortality.csv"

COUNTRIES = [
    "China",
    "France",
    "Germany",
    "Italy",
    "Spain",
    "United Kingdom",
    "United States",
]

START_DATE = "2020-01-23"
END_DATE = "2020-04-20"


df = pd.read_csv(INPUT)

df["date"] = pd.to_datetime(df["date"])
df["new_deaths"] = pd.to_numeric(df["new_deaths"], errors="coerce")

df = df[df["country"].isin(COUNTRIES)].copy()

df = df.sort_values(["country", "date"])


df["avg_deaths"] = (
    df.groupby("country")["new_deaths"]
    .transform(
        lambda x: x.rolling(
            window=3,
            center=True,
            min_periods=3
        ).mean()
    )
)


df["rate_change"] = (
    df.groupby("country")["avg_deaths"]
    .transform(
        lambda x: (x.shift(-1) - x.shift(1)) / 2
    )
)


df = df[
    (df["date"] >= START_DATE) &
    (df["date"] <= END_DATE)
].copy()


df = df[
    [
        "country",
        "date",
        "new_deaths",
        "avg_deaths",
        "rate_change"
    ]
]


df.to_csv(OUTPUT, index=False)

print(f"Saved {len(df)} rows to {OUTPUT}")
print()
print("Rows per country:")
print(df["country"].value_counts())
print()
print("Date range:")
print(df["date"].min().date(), "to", df["date"].max().date())
print()
print("Missing values:")
print(df.isna().sum())
print()
print("Rate of change range:")
print(df["rate_change"].min(), "to", df["rate_change"].max())
print()
print(df.head(10))