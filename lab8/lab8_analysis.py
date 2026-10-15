import json
import os

import numpy as np
import pandas as pd
import umap

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


INPUT_FILE = "../data/bulletin_passages.csv"

OUTPUT_STATS = "../data/lab8_corpus_stats.json"
OUTPUT_MAP = "../data/lab8_embedding_map.csv"
OUTPUT_MATRIX = "../data/lab8_topic_section_matrix.csv"
OUTPUT_REVIEW = "../data/lab8_cluster_review.txt"
OUTPUT_SECTION_SUMMARY = "../data/lab8_section_summary.csv"
OUTPUT_TOP_TERMS = "../data/lab8_top_terms.csv"

N_CLUSTERS = 8
N_NEIGHBORS = 5
RANDOM_STATE = 401


def clean_corpus(df):
    required = [
        "passage_id",
        "chapter",
        "section",
        "subsection",
        "page",
        "text"
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Missing required columns: "
            + ", ".join(missing)
        )

    raw_count = len(df)

    df = df.dropna(
        subset=["text"]
    ).copy()

    df["text"] = (
        df["text"]
        .astype(str)
        .str.replace(
            r"\s+",
            " ",
            regex=True
        )
        .str.strip()
    )

    df = df[
        df["text"].str.len() > 0
    ].copy()

    df = df.drop_duplicates(
        subset=["text"]
    ).copy()

    df["text_clean"] = df["text"]

    df["word_count"] = (
        df["text_clean"]
        .str.split()
        .str.len()
    )

    return df, raw_count


def create_corpus_summaries(df):
    section_summary = (
        df.groupby("section")
        .agg(
            passage_count=(
                "passage_id",
                "count"
            ),
            average_word_count=(
                "word_count",
                "mean"
            ),
            total_words=(
                "word_count",
                "sum"
            )
        )
        .reset_index()
        .sort_values(
            "passage_count",
            ascending=False
        )
    )

    section_summary[
        "average_word_count"
    ] = section_summary[
        "average_word_count"
    ].round(1)

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=5000,
        ngram_range=(1, 2)
    )

    tfidf_matrix = vectorizer.fit_transform(
        df["text_clean"]
    )

    terms = np.array(
        vectorizer.get_feature_names_out()
    )

    mean_scores = np.asarray(
        tfidf_matrix.mean(axis=0)
    ).ravel()

    top_indices = (
        mean_scores
        .argsort()[::-1]
    )

    top_terms = pd.DataFrame(
        {
            "term": terms[top_indices[:30]],
            "tfidf_score": mean_scores[
                top_indices[:30]
            ]
        }
    )

    top_terms["tfidf_score"] = (
        top_terms["tfidf_score"]
        .round(5)
    )

    return (
        section_summary,
        top_terms
    )


def generate_embeddings(df):
    print()
    print("Loading embedding model...")

    model = SentenceTransformer(
        "sentence-transformers/all-MiniLM-L6-v2",
        device="cpu"
    )

    print()
    print("Generating semantic embeddings...")

    embeddings = model.encode(
        df["text_clean"].tolist(),
        normalize_embeddings=True,
        show_progress_bar=True
    )

    print(
        f"Embedding shape: {embeddings.shape}"
    )

    return embeddings

def calculate_neighbors(
    embeddings,
    n_neighbors=5
):
    print()
    print(
        "Calculating semantic neighbors..."
    )

    similarity = cosine_similarity(
        embeddings
    )

    neighbor_ids = []
    neighbor_scores = []

    for i in range(
        len(embeddings)
    ):
        scores = similarity[i].copy()

        scores[i] = -1

        nearest = np.argsort(
            scores
        )[
            -(n_neighbors):
        ][::-1]

        neighbor_ids.append(
            nearest.tolist()
        )

        neighbor_scores.append(
            [
                round(
                    float(scores[index]),
                    4
                )
                for index in nearest
            ]
        )

    return (
        neighbor_ids,
        neighbor_scores
    )


def project_umap(
    embeddings
):
    print()
    print(
        "Running UMAP..."
    )

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=RANDOM_STATE
    )

    coordinates = reducer.fit_transform(
        embeddings
    )

    return coordinates


def cluster_embeddings(
    embeddings
):
    print()
    print(
        "Running KMeans..."
    )

    kmeans = KMeans(
        n_clusters=N_CLUSTERS,
        random_state=RANDOM_STATE,
        n_init="auto"
    )

    clusters = kmeans.fit_predict(
        embeddings
    )

    return clusters


def get_cluster_terms(
    df,
    top_n=10
):
    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=5000,
        ngram_range=(1, 2)
    )

    matrix = vectorizer.fit_transform(
        df["text_clean"]
    )

    terms = np.array(
        vectorizer.get_feature_names_out()
    )

    cluster_terms = {}

    for cluster in sorted(
        df["cluster"].unique()
    ):

        indices = np.where(
            df["cluster"].to_numpy()
            == cluster
        )[0]

        cluster_matrix = matrix[
            indices
        ]

        scores = np.asarray(
            cluster_matrix.mean(axis=0)
        ).ravel()

        top_indices = (
            scores
            .argsort()[::-1]
        )[:top_n]

        cluster_terms[cluster] = [
            terms[index]
            for index in top_indices
        ]

    return cluster_terms



def create_cluster_labels(df):
    labels = {
        0: "Molecular Bioscience and Physical Sciences",
        1: "Academic Support and Career Development",
        2: "Politics, Culture, and Social Thought",
        3: "Academic Policies and Credit Requirements",
        4: "China Studies and Global History",
        5: "Mathematics, Computing, and Data Science",
        6: "Economics, Public Policy, and Global Health",
        7: "Media, Arts, and Digital Culture",
    }

    df["cluster_name"] = (
        pd.to_numeric(df["cluster"], errors="coerce")
        .map(labels)
        .fillna("Unclassified Topic")
    )

    return df


def create_cluster_review(
    df,
    cluster_terms
):
    print()
    print(
        "Creating cluster review..."
    )

    with open(
        OUTPUT_REVIEW,
        "w",
        encoding="utf-8"
    ) as file:

        file.write(
            "LAB 8 CLUSTER REVIEW\n"
        )

        file.write(
            "Inspect representative passages "
            "and TF-IDF terms before assigning "
            "final topic labels.\n\n"
        )

        for cluster in sorted(
            df["cluster"].unique()
        ):

            subset = df[
                df["cluster"] == cluster
            ].copy()

            file.write(
                f"CLUSTER {cluster}\n"
            )

            file.write(
                f"Passages: {len(subset)}\n"
            )

            file.write(
                "TF-IDF terms: "
                + ", ".join(
                    cluster_terms.get(
                        cluster,
                        []
                    )
                )
                + "\n\n"
            )

            representative = (
                subset
                .sort_values(
                    "word_count",
                    ascending=False
                )
                .head(10)
            )

            for _, row in representative.iterrows():

                file.write(
                    f"[{row['passage_id']}] "
                    f"{row['chapter']} | "
                    f"{row['section']} | "
                    f"{row['subsection']} | "
                    f"Page {row['page']}\n"
                )

                file.write(
                    f"{row['text_clean']}\n\n"
                )

            file.write(
                "-" * 70
            )

            file.write(
                "\n\n"
            )


def create_matrix(df):
    matrix_df = (
        df.groupby(
            [
                "section",
                "cluster_name"
            ]
        )
        .size()
        .reset_index(
            name="count"
        )
    )

    section_totals = (
        df.groupby("section")
        .size()
        .reset_index(
            name="section_total"
        )
    )

    matrix_df = matrix_df.merge(
        section_totals,
        on="section",
        how="left"
    )

    matrix_df["proportion"] = (
        matrix_df["count"]
        / matrix_df["section_total"]
    )

    return matrix_df


def save_statistics(
    df,
    raw_count,
    section_summary,
    top_terms
):
    statistics = {
        "raw_count": int(
            raw_count
        ),
        "clean_count": int(
            len(df)
        ),
        "average_word_count": round(
            float(
                df["word_count"].mean()
            ),
            1
        ),
        "section_count": int(
            df["section"].nunique()
        ),
        "chapter_count": int(
            df["chapter"].nunique()
        ),
        "subsection_count": int(
            df["subsection"].nunique()
        ),
        "page_count": int(
            df["page"].nunique()
        ),
        "embedding_model":
            "all-MiniLM-L6-v2",
        "umap": {
            "n_components": 2,
            "n_neighbors": 15,
            "min_dist": 0.15,
            "metric": "cosine",
            "random_state": RANDOM_STATE
        },
        "clustering": {
            "method": "KMeans",
            "n_clusters": N_CLUSTERS,
            "random_state": RANDOM_STATE,
            "n_init": "auto"
        }
    }

    with open(
        OUTPUT_STATS,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            statistics,
            file,
            indent=2
        )

    section_summary.to_csv(
        OUTPUT_SECTION_SUMMARY,
        index=False
    )

    top_terms.to_csv(
        OUTPUT_TOP_TERMS,
        index=False
    )


def save_embedding_map(df):
    columns = [
        "passage_id",
        "chapter",
        "section",
        "subsection",
        "page",
        "text",
        "word_count",
        "cluster",
        "cluster_name",
        "x",
        "y",
        "neighbor_ids",
        "neighbor_scores"
    ]

    # Copy only the columns needed for the visualization
    export_df = df[columns].copy()

    # Convert neighbor lists to pipe-separated strings
    export_df["neighbor_ids"] = export_df["neighbor_ids"].apply(
        lambda values: "|".join(map(str, values))
        if isinstance(values, (list, tuple))
        else str(values)
    )

    export_df["neighbor_scores"] = export_df["neighbor_scores"].apply(
        lambda values: "|".join(map(str, values))
        if isinstance(values, (list, tuple))
        else str(values)
    )

    # Export the map data
    export_df.to_csv(
        OUTPUT_MAP,
        index=False,
        encoding="utf-8"
    )


def main():
    print(
        "Loading bulletin passages..."
    )

    if not os.path.exists(
        INPUT_FILE
    ):
        raise FileNotFoundError(
            f"Could not find "
            f"{INPUT_FILE}"
        )

    df = pd.read_csv(
        INPUT_FILE
    )

    print()
    print(
        "Cleaning corpus..."
    )

    df, raw_count = clean_corpus(
        df
    )

    print(
        f"Raw passages: {raw_count}"
    )

    print(
        f"Clean passages: {len(df)}"
    )

    print()
    print(
        "Creating corpus summaries..."
    )

    (
        section_summary,
        top_terms
    ) = create_corpus_summaries(
        df
    )

    print()
    print(
        "Top meaningful terms:"
    )

    print(
        top_terms.head(15).to_string(
            index=False
        )
    )

    print()
    print(
        "Generating semantic embeddings..."
    )

    embeddings = generate_embeddings(
        df
    )

    print()
    print(
        "Calculating semantic similarity..."
    )

    (
        neighbor_indices,
        neighbor_scores
    ) = calculate_neighbors(
        embeddings,
        N_NEIGHBORS
    )

    df["neighbor_ids"] = [
        [
            df.iloc[index][
                "passage_id"
            ]
            for index in indices
        ]
        for indices in neighbor_indices
    ]

    df["neighbor_scores"] = (
        neighbor_scores
    )

    print()
    print(
        "Running UMAP..."
    )

    coordinates = project_umap(
        embeddings
    )

    df["x"] = coordinates[
        :, 0
    ]

    df["y"] = coordinates[
        :, 1
    ]

    print()
    print(
        "Clustering embeddings..."
    )

    df["cluster"] = (
        cluster_embeddings(
            embeddings
        )
    )

    cluster_terms = (
        get_cluster_terms(
            df
        )
    )

    df = create_cluster_labels(df)

    create_cluster_review(
        df,
        cluster_terms
    )

    matrix_df = create_matrix(
        df
    )

    save_statistics(
        df,
        raw_count,
        section_summary,
        top_terms
    )

    save_embedding_map(
        df
    )

    matrix_df.to_csv(
        OUTPUT_MATRIX,
        index=False,
        encoding="utf-8"
    )

    print()
    print(
        "Analysis complete."
    )

    print()
    print("Saved:")
    print(
        OUTPUT_STATS
    )
    print(
        OUTPUT_MAP
    )
    print(
        OUTPUT_MATRIX
    )
    print(
        OUTPUT_REVIEW
    )
    print(
        OUTPUT_SECTION_SUMMARY
    )
    print(
        OUTPUT_TOP_TERMS
    )


if __name__ == "__main__":
    main()